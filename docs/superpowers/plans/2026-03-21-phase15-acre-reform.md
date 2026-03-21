# Phase 15 — Correction ACRE post-juillet 2026

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> ⚠️ **INTERDICTION DE COMMIT** — Ne jamais exécuter `git commit`. Seul l'utilisateur a le droit de committer. Préparer le code, mais s'arrêter avant le commit.

**Goal:** Corriger le calcul ACRE pour refléter la réforme LSFSS 2026 : le taux de réduction passe de 50 % à 25 % pour les entreprises créées à partir du 1er juillet 2026, et l'accès à l'ACRE devient conditionné à l'appartenance à un public éligible. Corriger également le libellé Factur-X dans les settings.

**Architecture:** Nouvelle migration DB ajoutant `acre_public_eligible` dans `profiles`. Nouvelles constantes ACRE dans `constants.ts`. Logique conditionnelle dans `useCotisations.ts` basée sur `company_created_at` vs `ACRE_REFORM_DATE`. Libellés dynamiques et alerte informative dans `settings.vue` et `index.vue`. Les fonctions `getAcreReductionRate()` et `isAcrePostReform()` sont exportées depuis `useCotisations.ts` pour être testables unitairement.

**Tech Stack:** Vue 3 + TypeScript, Supabase (migration SQL), Zod (validation), Vitest (tests)

**Contexte :**
La réforme ACRE entre en vigueur le 1er juillet 2026 (LSFSS 2026, art. L131-6-4 CSS modifié). Avant cette date, l'ACRE est automatique pour tout créateur de micro-entreprise et réduit les cotisations sociales de 50 % pendant 12 mois. Après cette date, seuls certains publics y ont droit (demandeurs d'emploi indemnisés, inscrits France Travail 6+ mois, RSA/ASS/PreParE, zones QPV/ZRR, 18-26 ans, CAPE) et le taux de réduction passe à 25 %. Sur 30 000 EUR de CA BNC-SSI (25,60 %), la différence entre 50 % et 25 % de réduction représente 1 920 EUR de cotisations sous-estimées. Il est donc critique de corriger ce calcul avant juillet 2026.

---

## Chunk 1 : Migration DB et constantes

### Task 1 : Ajouter `acre_public_eligible` dans `profiles`

**Files:**
- Create: `supabase/migrations/015_acre_reform.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- Migration 015: ACRE reform (LSFSS 2026)
-- After July 1st 2026, ACRE access is restricted to specific eligible populations
-- and the reduction rate drops from 50% to 25%.
-- This field tracks whether the user belongs to an eligible population
-- (only relevant for companies created on or after 2026-07-01).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS acre_public_eligible BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.acre_public_eligible IS
  'ACRE reform (July 2026): true if the user belongs to an eligible population for ACRE (demandeurs emploi, RSA, QPV/ZRR, 18-26 ans, etc.). Only relevant when company_created_at >= 2026-07-01.';
```

- [ ] **Step 2 : Appliquer la migration**

```bash
npx supabase db push
```

---

### Task 2 : Ajouter les constantes ACRE reform dans `constants.ts`

**Files:**
- Modify: `src/lib/constants.ts`

- [ ] **Step 1 : Ajouter les constantes de la réforme ACRE**

Ajouter en fin de fichier, après la fonction `getProratedThreshold` :

```typescript
/**
 * ACRE reform — LSFSS 2026
 * Before July 1st 2026: ACRE is automatic, 50% reduction for 12 months.
 * After July 1st 2026: ACRE restricted to eligible populations, 25% reduction for 12 months.
 */
export const ACRE_REFORM_DATE = '2026-07-01' as const

export const ACRE_RATES = {
  /** Reduction rate before reform: cotisations × (1 - 0.5) = half rate */
  BEFORE_REFORM: 0.5,
  /** Reduction rate after reform: cotisations × (1 - 0.25) = 75% of full rate */
  AFTER_REFORM: 0.25,
} as const
```

---

### Task 3 : Régénérer les types TypeScript

**Files:**
- Modify: `src/lib/types.ts` (after regeneration)

- [ ] **Step 1 : Régénérer les types**

```bash
npx supabase gen types typescript --local > src/lib/types.ts
```

Vérifier que `acre_public_eligible: boolean | null` apparaît dans `profiles.Row`, `profiles.Insert`, et `profiles.Update`.

---

## Chunk 2 : Logique de calcul ACRE

### Task 4 : Corriger `useCotisations.ts` pour le taux ACRE conditionnel

**Files:**
- Modify: `src/composables/useCotisations.ts`

- [ ] **Step 1 : Ajouter les imports des nouvelles constantes**

Remplacer la ligne d'import :

```typescript
import { COTISATION_RATES_2026 } from '@/lib/constants'
```

par :

```typescript
import { COTISATION_RATES_2026, ACRE_REFORM_DATE, ACRE_RATES } from '@/lib/constants'
```

- [ ] **Step 2 : Créer la fonction `getAcreReductionRate` (exportée, testable)**

Ajouter cette fonction juste après la fonction `isWithinAcrePeriod`, avant `useCotisations` :

```typescript
/**
 * Returns the ACRE reduction factor based on company creation date.
 *
 * LSFSS 2026 reform:
 * - Created before 2026-07-01: 50% reduction (base × 0.5)
 * - Created on/after 2026-07-01: 25% reduction (base × 0.75)
 *
 * @param companyCreatedAt - ISO date string of company creation
 * @returns The factor to multiply the base cotisation rate by.
 *          0.5 means "multiply base by 0.5" (50% reduction).
 *          0.75 means "multiply base by 0.75" (25% reduction).
 */
export function getAcreReductionRate(companyCreatedAt: string): number {
  const created = new Date(companyCreatedAt)
  const reformDate = new Date(ACRE_REFORM_DATE)
  if (created >= reformDate) {
    return 1 - ACRE_RATES.AFTER_REFORM  // 0.75
  }
  return 1 - ACRE_RATES.BEFORE_REFORM   // 0.5
}

/**
 * Returns true if the company was created on or after the ACRE reform date.
 * Used by the UI to display the correct labels and alerts.
 */
export function isAcrePostReform(companyCreatedAt: string): boolean {
  return new Date(companyCreatedAt) >= new Date(ACRE_REFORM_DATE)
}
```

- [ ] **Step 3 : Modifier le computed `rate` pour utiliser `getAcreReductionRate`**

Remplacer le computed `rate` existant :

```typescript
  const rate = computed(() => {
    const base = authStore.profile?.cotisation_rate ?? COTISATION_RATES_2026.BNC_SSI
    if (authStore.profile?.is_acre && isFirstYear.value) return base / 2
    return base
  })
```

par :

```typescript
  const rate = computed(() => {
    const base = authStore.profile?.cotisation_rate ?? COTISATION_RATES_2026.BNC_SSI
    if (authStore.profile?.is_acre && isFirstYear.value) {
      const created = authStore.profile?.company_created_at
      if (!created) return base
      return base * getAcreReductionRate(created)
    }
    return base
  })
```

---

## Chunk 3 : Mise à jour de l'UI Settings

### Task 5 : Libellé ACRE dynamique et correction Factur-X

**Files:**
- Modify: `src/utils/validators.ts`
- Modify: `src/pages/settings.vue`

- [ ] **Step 1 : Ajouter `acre_public_eligible` au schéma Zod du profil**

Dans `src/utils/validators.ts`, dans `profileSchema`, ajouter après `is_acre: z.boolean().default(false),` :

```typescript
  acre_public_eligible: z.boolean().default(false),
```

- [ ] **Step 2 : Ajouter les imports et computed dans `settings.vue`**

Dans `<script setup>`, ajouter les imports :

```typescript
import { isAcrePostReform } from '@/composables/useCotisations'
import { ACRE_RATES } from '@/lib/constants'
```

Ajouter les computed après les `defineField` :

```typescript
const postReform = computed(() => {
  const created = companyCreatedAt.value
  if (!created) return false
  return isAcrePostReform(created)
})

const acreReductionPercent = computed(() => {
  return postReform.value
    ? Math.round(ACRE_RATES.AFTER_REFORM * 100)
    : Math.round(ACRE_RATES.BEFORE_REFORM * 100)
})
```

- [ ] **Step 3 : Ajouter `acre_public_eligible` dans `buildInitialValues` et le submit**

Dans `buildInitialValues` :
```typescript
    acre_public_eligible: p?.acre_public_eligible ?? false,
```

Déclarer le champ :
```typescript
const [acrePublicEligible, acrePublicEligibleAttrs] = defineField('acre_public_eligible')
```

Dans `onSubmit` :
```typescript
      acre_public_eligible: values.acre_public_eligible,
```

- [ ] **Step 4 : Remplacer le bloc toggle ACRE dans le template**

Remplacer le bloc ACRE existant par :

```vue
          <!-- ACRE toggle -->
          <div class="flex items-center justify-between gap-4 pt-1">
            <div>
              <p class="text-sm font-medium text-[#374151]">Bénéficiaire ACRE</p>
              <p class="text-xs text-[#6B7280] mt-0.5">
                <template v-if="postReform">
                  Réduit les cotisations de {{ acreReductionPercent }} % pendant la 1re année (sous conditions d'éligibilité)
                </template>
                <template v-else>
                  Réduit les cotisations de {{ acreReductionPercent }} % pendant la 1re année d'activité
                </template>
              </p>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="isAcre"
              v-bind="isAcreAttrs"
              :class="[
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:ring-offset-2',
                isAcre ? 'bg-[#7C3AED]' : 'bg-[#D1D5DB]',
              ]"
              @click="isAcre = !isAcre"
            >
              <span
                :class="[
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  isAcre ? 'translate-x-5' : 'translate-x-0',
                ]"
              />
            </button>
          </div>

          <!-- ACRE post-reform alert -->
          <div
            v-if="postReform && isAcre"
            class="flex items-start gap-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg px-4 py-3"
            role="alert"
          >
            <svg class="h-5 w-5 text-[#3B82F6] shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
            <div>
              <p class="text-sm font-semibold text-[#1E40AF]">Réforme ACRE — juillet 2026</p>
              <p class="text-xs text-[#1E40AF] mt-0.5">
                Pour les entreprises créées à partir du 1er juillet 2026, l'ACRE est réservée à certains publics (demandeurs d'emploi, RSA, zones QPV/ZRR, moins de 26 ans, CAPE) et le taux de réduction passe à 25 %.
              </p>
            </div>
          </div>

          <!-- ACRE public eligible checkbox (post-reform only) -->
          <div v-if="postReform && isAcre" class="flex items-center gap-3 pl-8">
            <input
              id="acre-public-eligible"
              v-model="acrePublicEligible"
              v-bind="acrePublicEligibleAttrs"
              type="checkbox"
              class="h-4 w-4 rounded border-[#D1D5DB] text-[#7C3AED] focus:ring-[#7C3AED]"
            />
            <label for="acre-public-eligible" class="text-sm text-[#374151]">
              Je confirme appartenir à un public éligible à l'ACRE
            </label>
          </div>
```

- [ ] **Step 5 : Corriger le libellé Factur-X**

Remplacer le texte du toggle Factur-X :

```
Embarque un XML Factur-X MINIMUM dans vos PDFs. Requis pour l'obligation légale de 2026/2027.
```

par :

```
Embarque un XML Factur-X MINIMUM dans vos PDFs. Prépare vos factures pour la facturation électronique (profil MINIMUM — mise à niveau EN 16931 planifiée).
```

---

## Chunk 4 : Alerte ACRE sur le tableau de bord

### Task 6 : Alerte informative dans `index.vue`

**Files:**
- Modify: `src/pages/index.vue`

- [ ] **Step 1 : Ajouter les imports et computed**

```typescript
import { isAcrePostReform } from '@/composables/useCotisations'

const showAcreReformAlert = computed(() => {
  const profile = authStore.profile
  if (!profile?.is_acre) return false
  if (!profile.company_created_at) return false
  return isAcrePostReform(profile.company_created_at)
})
```

- [ ] **Step 2 : Ajouter l'alerte dans le template**

Après le bloc d'alerte "compte bancaire dédié" existant :

```vue
    <div
      v-if="showAcreReformAlert"
      class="flex items-start gap-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-4 py-3"
      role="alert"
    >
      <svg class="h-5 w-5 text-[#3B82F6] shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
      </svg>
      <div>
        <p class="text-sm font-semibold text-[#1E40AF]">Réforme ACRE active</p>
        <p class="text-xs text-[#1E40AF] mt-0.5">
          Votre entreprise a été créée après le 1er juillet 2026 : vos cotisations ACRE sont réduites de 25 % (au lieu de 50 % avant la réforme). Le taux appliqué ci-dessous en tient compte.
        </p>
      </div>
    </div>
```

---

## Chunk 5 : Tests unitaires

### Task 7 : Tests pour les fonctions pures

**Files:**
- Modify: `tests/unit/composables/useCotisations.test.ts`

- [ ] **Step 1 : Ajouter les imports**

```typescript
import { isWithinAcrePeriod, getAcreReductionRate, isAcrePostReform } from '@/composables/useCotisations'
import { ACRE_RATES } from '@/lib/constants'
```

- [ ] **Step 2 : Ajouter les suites de tests**

```typescript
describe('getAcreReductionRate', () => {
  it('returns 0.5 (50% reduction) for company created before July 2026', () => {
    expect(getAcreReductionRate('2026-06-30')).toBe(0.5)
    expect(getAcreReductionRate('2024-01-15')).toBe(0.5)
  })

  it('returns 0.75 (25% reduction) for company created on July 1st 2026', () => {
    expect(getAcreReductionRate('2026-07-01')).toBe(0.75)
  })

  it('returns 0.75 for company created after July 2026', () => {
    expect(getAcreReductionRate('2026-09-15')).toBe(0.75)
    expect(getAcreReductionRate('2027-03-01')).toBe(0.75)
  })

  it('correctly impacts cotisation calculation: before reform', () => {
    // 30000 EUR CA x 25.6% BNC_SSI = 7680 EUR base → x 0.5 = 3840 EUR
    const base = 30000 * 0.256
    expect(base * getAcreReductionRate('2026-03-15')).toBeCloseTo(3840, 0)
  })

  it('correctly impacts cotisation calculation: after reform', () => {
    // 30000 EUR CA x 25.6% BNC_SSI = 7680 EUR base → x 0.75 = 5760 EUR
    const base = 30000 * 0.256
    expect(base * getAcreReductionRate('2026-08-01')).toBeCloseTo(5760, 0)
  })

  it('difference between pre and post reform is 1920 EUR on 30k CA', () => {
    const base = 30000 * 0.256
    const preReform = base * getAcreReductionRate('2026-06-15')
    const postReform = base * getAcreReductionRate('2026-07-15')
    expect(postReform - preReform).toBeCloseTo(base * 0.25, 0)
  })
})

describe('isAcrePostReform', () => {
  it('returns false for company created before July 2026', () => {
    expect(isAcrePostReform('2026-06-30')).toBe(false)
    expect(isAcrePostReform('2025-01-01')).toBe(false)
  })

  it('returns true for company created on July 1st 2026', () => {
    expect(isAcrePostReform('2026-07-01')).toBe(true)
  })

  it('returns true for company created after July 2026', () => {
    expect(isAcrePostReform('2026-12-01')).toBe(true)
    expect(isAcrePostReform('2027-06-01')).toBe(true)
  })
})
```

### Task 8 : Tests composable avec ACRE reform

**Files:**
- Modify: `tests/unit/composables/useCotisations.composable.test.ts`

- [ ] **Step 1 : Ajouter `acre_public_eligible` dans `makeProfile`**

```typescript
function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    // ... champs existants ...
    is_acre: null,
    acre_public_eligible: false,  // ← ajouter
    // ...
    ...overrides,
  } as Profile
}
```

- [ ] **Step 2 : Ajouter les tests ACRE reform**

```typescript
describe('useCotisations - ACRE reform rate', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('applies 50% reduction (rate × 0.5) for ACRE before reform', () => {
    const authStore = useAuthStore()
    authStore.setProfile(makeProfile({ is_acre: true, company_created_at: '2026-03-15', cotisation_rate: 0.256 }))
    const { rate } = useCotisations(ref(10000))
    expect(rate.value).toBeCloseTo(0.128, 4) // 0.256 × 0.5
  })

  it('applies 25% reduction (rate × 0.75) for ACRE after reform', () => {
    const authStore = useAuthStore()
    authStore.setProfile(makeProfile({ is_acre: true, company_created_at: '2026-08-01', cotisation_rate: 0.256 }))
    const { rate } = useCotisations(ref(10000))
    expect(rate.value).toBeCloseTo(0.192, 4) // 0.256 × 0.75
  })

  it('applies full rate when ACRE is disabled regardless of creation date', () => {
    const authStore = useAuthStore()
    authStore.setProfile(makeProfile({ is_acre: false, company_created_at: '2026-08-01', cotisation_rate: 0.256 }))
    const { rate } = useCotisations(ref(10000))
    expect(rate.value).toBeCloseTo(0.256, 4)
  })
})
```

---

## Chunk 6 : Validation finale

### Task 9 : Exécuter les tests

- [ ] **Step 1 : Lancer la suite complète**

```bash
pnpm test
```

Résultat attendu : tous les tests passent, 0 régression.

- [ ] **Step 2 : Vérification visuelle**

1. Settings : libellé ACRE change dynamiquement selon la date de création
2. Settings : alerte bleue visible si `company_created_at >= 2026-07-01` ET `is_acre = true`
3. Settings : checkbox "public éligible" visible dans ce même cas
4. Settings : libellé Factur-X corrigé
5. Dashboard : alerte ACRE reform visible quand applicable
6. Dashboard : cotisations reflètent le bon taux (25 % de réduction au lieu de 50 %)

---

## Récapitulatif des fichiers

| Fichier | Action |
|---|---|
| `supabase/migrations/015_acre_reform.sql` | Create |
| `src/lib/constants.ts` | Modify — `ACRE_REFORM_DATE`, `ACRE_RATES` |
| `src/lib/types.ts` | Regenerate |
| `src/composables/useCotisations.ts` | Modify — `getAcreReductionRate()`, `isAcrePostReform()`, computed `rate` |
| `src/utils/validators.ts` | Modify — `acre_public_eligible` dans `profileSchema` |
| `src/pages/settings.vue` | Modify — libellé dynamique, alerte, checkbox, correction Factur-X |
| `src/pages/index.vue` | Modify — alerte ACRE reform |
| `tests/unit/composables/useCotisations.test.ts` | Modify — tests fonctions pures |
| `tests/unit/composables/useCotisations.composable.test.ts` | Modify — tests composable |

## Critères de succès

- [ ] `getAcreReductionRate('2026-06-30')` === `0.5`
- [ ] `getAcreReductionRate('2026-07-01')` === `0.75`
- [ ] `isAcrePostReform('2026-06-30')` === `false`
- [ ] `isAcrePostReform('2026-07-01')` === `true`
- [ ] Composable : rate = `0.128` pour ACRE pre-reform BNC_SSI (0.256 × 0.5)
- [ ] Composable : rate = `0.192` pour ACRE post-reform BNC_SSI (0.256 × 0.75)
- [ ] Différence de 1 920 EUR sur 30k CA entre pre et post reform vérifiée
- [ ] Libellé ACRE dynamique dans settings
- [ ] Alerte bleue ACRE reform dans settings et dashboard
- [ ] Libellé Factur-X corrigé
- [ ] `pnpm test` : 0 failures
