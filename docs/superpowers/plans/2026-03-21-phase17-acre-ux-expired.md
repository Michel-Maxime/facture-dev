# Phase 17 — UX ACRE période expirée

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [x]`) syntax for tracking.
>
> ⚠️ **INTERDICTION DE COMMIT** — Ne jamais exécuter `git commit`. Seul l'utilisateur a le droit de committer. Préparer le code, mais s'arrêter avant le commit.

**Goal:** Informer clairement l'utilisateur quand son ACRE est activé mais que la période est expirée, afin qu'il comprenne pourquoi le taux plein est appliqué sur le tableau de bord.

**Architecture:** Extraction d'une fonction pure `getAcreEndDate()` depuis `useCotisations.ts` pour calculer et afficher la date de fin ACRE. Ajout de computed `acreExpired` dans `settings.vue` pour conditionner l'affichage d'un badge "Expiré" et d'une note explicative. Ajout d'une note contextuelle dans la carte cotisations de `index.vue`.

**Tech Stack:** Vue 3 + TypeScript, Vitest (tests)

---

## Contexte UX

Problème actuel : un utilisateur avec `is_acre = true` et une `company_created_at` de plus d'un an voit :
- Dashboard : "Taux appliqué : 25,6 %" — sans explication
- Settings : toggle ACRE activé avec le texte "Réduit les cotisations de 50 %"

Il pense que l'ACRE est actif alors qu'il est expiré. Confusion garantie.

**Solution :**
- Settings : badge "Expiré" + texte "Période ACRE terminée le [date]" quand la période est passée
- Dashboard : note discrète "(ACRE activé — période expirée)" sous le taux appliqué

---

## Récapitulatif des fichiers

| Fichier | Action |
|---|---|
| `src/composables/useCotisations.ts` | Extraire `getAcreEndDate()` — réutilisée par `isWithinAcrePeriod` et l'UI |
| `src/pages/settings.vue` | `acreExpired` computed + badge + texte dynamique |
| `src/pages/index.vue` | Note "(ACRE expiré)" dans la carte cotisations |
| `tests/unit/composables/useCotisations.test.ts` | Tests pour `getAcreEndDate()` |

---

## Chunk 1 : Extraction de `getAcreEndDate`

### Task 1 : Refactoriser `useCotisations.ts` pour exposer la date de fin ACRE

**Files:**
- Modify: `src/composables/useCotisations.ts`
- Modify: `tests/unit/composables/useCotisations.test.ts`

- [x] **Step 1 : Écrire les tests pour `getAcreEndDate`**

Dans `tests/unit/composables/useCotisations.test.ts` :

1. Mettre à jour l'import existant (ligne 3) pour ajouter `getAcreEndDate` :

```typescript
import { isWithinAcrePeriod, getAcreEndDate, getAcreReductionRate, isAcrePostReform } from '@/composables/useCotisations'
```

2. Ajouter le bloc de tests après le `describe('isWithinAcrePeriod', ...)` existant :

```typescript
describe('getAcreEndDate', () => {
  it('created Jan 1 → end date is Dec 31 same year', () => {
    const end = getAcreEndDate('2025-01-01')
    expect(end.getFullYear()).toBe(2025)
    expect(end.getMonth()).toBe(11) // December (0-indexed)
    expect(end.getDate()).toBe(31)
  })

  it('created Mar 15 (Q1) → end date is Mar 31 next year', () => {
    const end = getAcreEndDate('2025-03-15')
    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(2) // March (0-indexed)
    expect(end.getDate()).toBe(31)
  })

  it('created Oct 1 (Q4) → end date is Dec 31 next year', () => {
    const end = getAcreEndDate('2025-10-01')
    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(11) // December (0-indexed)
    expect(end.getDate()).toBe(31)
  })

  it('isWithinAcrePeriod is consistent with getAcreEndDate', () => {
    const createdAt = '2025-03-15'
    const endDate = getAcreEndDate(createdAt)
    // One second before end → still in period
    const beforeEnd = new Date(endDate.getTime() - 1000)
    expect(isWithinAcrePeriod(createdAt, beforeEnd)).toBe(true)
    // One second after end → out of period
    const afterEnd = new Date(endDate.getTime() + 1000)
    expect(isWithinAcrePeriod(createdAt, afterEnd)).toBe(false)
  })
})
```

- [x] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

```bash
pnpm test -- --run tests/unit/composables/useCotisations.test.ts
```

Résultat attendu : FAIL — `getAcreEndDate is not a function`

- [x] **Step 3 : Extraire `getAcreEndDate` et refactoriser `isWithinAcrePeriod`**

Dans `src/composables/useCotisations.ts`, remplacer la fonction `isWithinAcrePeriod` par :

```typescript
/**
 * Returns the date at which the ACRE period ends for a given company creation date.
 * URSSAF rule: ACRE applies until the end of the 4th complete civil quarter
 * following the creation date.
 *
 * Special case: created on Jan 1 → ACRE ends Dec 31 of the same year (4 full quarters Q1→Q4).
 * General case: ACRE ends at the end of the same quarter, the following year.
 *
 * Examples:
 * - created Mar 15 2025 (Q1) → end of Q1 2026 = Mar 31 2026
 * - created Jan 1 2025       → end of Q4 2025 = Dec 31 2025
 * - created Oct 1 2025 (Q4)  → end of Q4 2026 = Dec 31 2026
 */
export function getAcreEndDate(companyCreatedAt: string): Date {
  const created = new Date(companyCreatedAt)

  // Special case: created exactly on Jan 1 → end of Q4 same year
  if (created.getMonth() === 0 && created.getDate() === 1) {
    return new Date(created.getFullYear(), 11, 31, 23, 59, 59, 999)
  }

  // General rule: end of same quarter, next year
  const createdQuarter = Math.floor(created.getMonth() / 3) // 0=Q1..3=Q4
  // Last month of quarter (1-indexed): Q0→3, Q1→6, Q2→9, Q3→12
  const lastMonthOfQuarter = (createdQuarter + 1) * 3
  // new Date(year, month, 0) = last day of previous month
  return new Date(created.getFullYear() + 1, lastMonthOfQuarter, 0, 23, 59, 59, 999)
}

export function isWithinAcrePeriod(companyCreatedAt: string, now: Date = new Date()): boolean {
  return now <= getAcreEndDate(companyCreatedAt)
}
```

- [x] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

```bash
pnpm test -- --run
```

Résultat attendu : tous les tests passent (214+ tests, 0 failure)

---

## Chunk 2 : Settings — badge "Expiré" et texte dynamique

### Task 2 : Indiquer visuellement que la période ACRE est expirée

**Files:**
- Modify: `src/pages/settings.vue`

- [x] **Step 1 : Ajouter les imports et les computed**

Dans `<script setup>`, mettre à jour l'import depuis `useCotisations` :

```typescript
import { isAcrePostReform, isWithinAcrePeriod, getAcreEndDate } from '@/composables/useCotisations'
```

Ajouter ces deux computed après `acreReductionPercent` :

```typescript
const acreExpired = computed(() => {
  const created = companyCreatedAt.value
  if (!created || !isAcre.value) return false
  return !isWithinAcrePeriod(created)
})

const acreEndDateFormatted = computed(() => {
  const created = companyCreatedAt.value
  if (!created) return ''
  const endDate = getAcreEndDate(created)
  if (isNaN(endDate.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(endDate)
})
```

- [x] **Step 2 : Remplacer le bloc ACRE toggle dans le template**

Remplacer le bloc `<!-- ACRE toggle -->` **et les blocs qui le suivent** (`<!-- ACRE post-reform alert -->` et `<!-- ACRE public eligible checkbox -->`) par le code ci-dessous.

Les blocs post-reform sont conditionnés à `!acreExpired` pour ne pas afficher une alerte et une checkbox d'éligibilité quand la période est déjà terminée — ce serait trompeur.

```vue
<!-- ACRE toggle -->
<div class="flex items-center justify-between gap-4 pt-1">
  <div class="flex-1">
    <div class="flex items-center gap-2">
      <p class="text-sm font-medium text-[#374151]">Bénéficiaire ACRE</p>
      <span
        v-if="acreExpired"
        class="inline-flex items-center rounded-full bg-[#F3F4F6] px-2 py-0.5 text-xs font-medium text-[#6B7280]"
      >
        Expiré
      </span>
    </div>
    <p class="text-xs text-[#6B7280] mt-0.5">
      <template v-if="acreExpired">
        Période ACRE terminée le {{ acreEndDateFormatted }} — taux plein appliqué
      </template>
      <template v-else-if="postReform">
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
      isAcre && !acreExpired ? 'bg-[#7C3AED]' : 'bg-[#D1D5DB]',
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

<!-- ACRE post-reform alert (masqué si période expirée) -->
<div
  v-if="postReform && isAcre && !acreExpired"
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

<!-- ACRE public eligible checkbox (post-reform uniquement, masqué si expiré) -->
<div v-if="postReform && isAcre && !acreExpired" class="flex items-center gap-3 pl-8">
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

---

## Chunk 3 : Dashboard — note contextuelle

### Task 3 : Ajouter une note "(ACRE expiré)" dans la carte cotisations

**Files:**
- Modify: `src/pages/index.vue`

- [x] **Step 1 : Ajouter les imports et le computed**

Dans `<script setup>`, mettre à jour l'import :

```typescript
import { useCotisations, isAcrePostReform, isWithinAcrePeriod } from '@/composables/useCotisations'
```

Ajouter le computed après `showAcreReformAlert` :

```typescript
const showAcreExpiredNote = computed(() => {
  const profile = authStore.profile
  if (!profile?.is_acre) return false
  if (!profile.company_created_at) return false
  return !isWithinAcrePeriod(profile.company_created_at)
})
```

- [x] **Step 2 : Ajouter la note dans le template**

Dans la carte "Cotisations estimées", remplacer la ligne du taux :

```vue
<p class="text-xs text-[#9CA3AF]">
  Taux appliqué : {{ formatPercentage(cotisations.rate.value) }}
</p>
```

par :

```vue
<p class="text-xs text-[#9CA3AF]">
  Taux appliqué : {{ formatPercentage(cotisations.rate.value) }}
  <span
    v-if="showAcreExpiredNote"
    class="text-[#D97706]"
  >
    — ACRE expiré
  </span>
</p>
```

---

## Chunk 4 : Validation finale

### Task 4 : Vérifier les tests et le rendu visuel

- [x] **Step 1 : Lancer la suite complète**

```bash
pnpm test -- --run
```

Résultat attendu : tous les tests passent, 0 régression.

- [x] **Step 2 : Vérification visuelle**

Pour tester avec le profil existant (`company_created_at = 2025-01-01`, `is_acre = true`) :

1. **Settings** : le toggle ACRE doit afficher le badge gris "Expiré" et le texte "Période ACRE terminée le 31 décembre 2025 — taux plein appliqué". La couleur du toggle doit être grise même si `is_acre = true`.
2. **Dashboard** : sous "Taux appliqué : 25,6 %", affiche "— ACRE expiré" en orange.
3. **Settings avec date récente** : changer temporairement `company_created_at` à `2025-06-01` en DB → le badge "Expiré" doit disparaître et le taux réduit s'appliquer.

---

## Critères de succès

- [x] `getAcreEndDate('2025-01-01')` retourne le 31 décembre 2025
- [x] `getAcreEndDate('2025-03-15')` retourne le 31 mars 2026
- [x] `isWithinAcrePeriod` reste cohérent avec `getAcreEndDate`
- [x] Settings : badge "Expiré" visible quand période passée
- [x] Settings : texte affiche la date de fin exacte
- [x] Settings : couleur du toggle est grise quand expiré
- [x] Dashboard : note "— ACRE expiré" visible en orange
- [x] `pnpm test` : 0 failures
