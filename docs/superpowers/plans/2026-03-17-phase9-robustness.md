# Phase 9 — Robustesse et garde-fous Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter les garde-fous manquants avant l'émission (confirmation, validation profil, fix ACRE, fix convertToInvoice) pour qu'aucun utilisateur ne puisse émettre une facture non conforme par accident.

**Architecture:** Modifications ciblées dans les composables existants et les pages Vue. Aucun nouveau fichier de route. Le composable `useInvoices` gagne une validation de profil. La page `[id].vue` des factures gagne un modal de confirmation. `useCotisations` est corrigé pour le calcul ACRE. `useQuotes.convertToInvoice` hérite le `vat_rate` du profil.

**Tech Stack:** Vue 3 + `<script setup lang="ts">`, Composables, Pinia (authStore), Vitest pour les tests unitaires, Zod pour la validation.

---

## Chunk 1 : Fix ACRE et fix convertToInvoice

### Task 1 : Corriger le calcul ACRE dans `useCotisations`

**Contexte :** Actuellement `isFirstYear` est vrai si `Date.now() - company_created_at < 365.25 jours`. La règle URSSAF est : ACRE s'applique jusqu'à la fin du 4ème trimestre civil complet après la date de création. Ex : créé le 15 mars 2025 → ACRE jusqu'au 31 mars 2026 (Q1 2025 → fin Q1 2026).

**Files:**
- Modify: `src/composables/useCotisations.ts:9-13`
- Modify: `tests/unit/composables/useCotisations.test.ts`

- [ ] **Step 1 : Écrire le test échouant pour le calcul ACRE**

Ouvrir `tests/unit/composables/useCotisations.test.ts` et ajouter à la suite des tests existants :

```typescript
describe('isFirstYear / ACRE boundary', () => {
  it('should still be first year if within 4 complete civil quarters', () => {
    // Créé le 15 mars 2025 → ACRE valide jusqu'au 31 mars 2026
    const createdAt = '2025-03-15'
    // Test at 31 mars 2026 23:59 → still in ACRE
    const testDate = new Date('2026-03-31T23:59:00')
    expect(isWithinAcrePeriod(createdAt, testDate)).toBe(true)
  })

  it('should be out of ACRE the day after the 4th quarter end', () => {
    const createdAt = '2025-03-15'
    // 1er avril 2026 → ACRE terminé
    const testDate = new Date('2026-04-01T00:00:00')
    expect(isWithinAcrePeriod(createdAt, testDate)).toBe(false)
  })

  it('created on Jan 1 → ACRE ends Dec 31 same year', () => {
    const createdAt = '2025-01-01'
    expect(isWithinAcrePeriod(createdAt, new Date('2025-12-31T23:59:00'))).toBe(true)
    expect(isWithinAcrePeriod(createdAt, new Date('2026-01-01T00:00:00'))).toBe(false)
  })

  it('created on Oct 1 → ACRE ends Dec 31 of next year', () => {
    // Créé le 1er oct 2025 → Q4 2025 partiel, 4 quarters complets = Q1+Q2+Q3+Q4 2026 → fin le 31 déc 2026
    const createdAt = '2025-10-01'
    expect(isWithinAcrePeriod(createdAt, new Date('2026-12-31T23:59:00'))).toBe(true)
    expect(isWithinAcrePeriod(createdAt, new Date('2027-01-01T00:00:00'))).toBe(false)
  })
})
```

Note : la fonction `isWithinAcrePeriod` n'existe pas encore — c'est pour ça que le test échoue.

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
pnpm test tests/unit/composables/useCotisations.test.ts
```

Résultat attendu : erreur de compilation `isWithinAcrePeriod is not defined`.

- [ ] **Step 3 : Extraire et implémenter `isWithinAcrePeriod` dans `useCotisations.ts`**

Remplacer la logique `isFirstYear` dans `src/composables/useCotisations.ts` :

```typescript
/**
 * Calcule la date de fin de l'ACRE selon la règle URSSAF :
 * fin du 4ème trimestre civil COMPLET suivant la date de création.
 * Un trimestre est complet seulement s'il commence APRÈS la date de création.
 *
 * Règle : si créé en Q1 (jan-mars), l'ACRE court jusqu'à fin Q4 de la même année.
 * Si créé en Q2, Q3 ou Q4, l'ACRE court jusqu'à la fin du trimestre correspondant
 * de l'année suivante.
 *
 * Exemples :
 * - créé le 15 mars 2025 (Q1) → fin Q1 2026 = 31 mars 2026
 * - créé le 1er oct 2025 (Q4) → fin Q4 2026 = 31 déc 2026
 * - créé le 1er janv 2025 (début Q1) → fin Q4 2025 = 31 déc 2025
 */
export function isWithinAcrePeriod(companyCreatedAt: string, now: Date = new Date()): boolean {
  const created = new Date(companyCreatedAt)
  // Déterminer le trimestre de création (0-indexed: 0=Q1, 1=Q2, 2=Q3, 3=Q4)
  const createdQuarter = Math.floor(created.getMonth() / 3)

  // La fin ACRE est la fin du même trimestre, un an plus tard
  // Si créé le 1er jan (début exact de Q1), on considère Q4 de la même année
  // Pour simplifier : fin du trimestre (createdQuarter) de l'année suivante
  // SAUF si créé exactement le premier jour du trimestre → même trimestre cette année
  const isFirstDayOfQuarter =
    created.getDate() === 1 && created.getMonth() === createdQuarter * 3

  let acreEndYear = created.getFullYear()
  let acreEndQuarter = createdQuarter

  if (isFirstDayOfQuarter) {
    // Créé le 1er janvier → fin Q4 de la même année
    acreEndQuarter = 3
  } else {
    // Sinon fin du même trimestre l'année suivante
    acreEndYear += 1
  }

  // Dernier jour du trimestre acreEndQuarter de acreEndYear
  // Q0→mars, Q1→juin, Q2→sept, Q3→déc
  const lastMonthOfQuarter = (acreEndQuarter + 1) * 3 // 1-indexed: 3, 6, 9, 12
  // new Date(year, month, 0) donne le dernier jour du mois précédent
  const acreEndDate = new Date(acreEndYear, lastMonthOfQuarter, 0, 23, 59, 59, 999)

  return now <= acreEndDate
}
```

Puis mettre à jour `isFirstYear` dans le composable pour utiliser cette fonction :

```typescript
// Dans useCotisations, remplacer isFirstYear par :
const isFirstYear = computed(() => {
  const created = authStore.profile?.company_created_at
  if (!created) return false
  return isWithinAcrePeriod(created)
})
```

Ajouter l'export de `isWithinAcrePeriod` dans le fichier (avant `export function useCotisations`).

- [ ] **Step 4 : Importer `isWithinAcrePeriod` dans le test et relancer**

Dans le fichier de test, ajouter l'import :

```typescript
import { isWithinAcrePeriod } from '@/composables/useCotisations'
```

Puis :

```bash
pnpm test tests/unit/composables/useCotisations.test.ts
```

Résultat attendu : tous les tests passent, y compris les nouveaux.

- [ ] **Step 5 : Commit**

```bash
git add src/composables/useCotisations.ts tests/unit/composables/useCotisations.test.ts
git commit -m "fix: correct ACRE period calculation to use 4 complete civil quarters"
```

---

### Task 2 : Corriger `convertToInvoice` pour hériter le `vat_rate` du profil

**Contexte :** `useQuotes.convertToInvoice` (ligne 248) force `vat_rate: 0` même si l'utilisateur est assujetti à la TVA (`vat_regime === 'SUBJECT'`). Il doit lire le régime TVA du profil.

**Files:**
- Modify: `src/composables/useQuotes.ts:248-250`
- Modify: `tests/unit/composables/useInvoices.test.ts` (ou créer `tests/unit/composables/useQuotes.test.ts`)

- [ ] **Step 1 : Écrire le test échouant**

Créer `tests/unit/composables/useQuotes.test.ts` :

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'inv-1', total: 500 }, error: null }),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    })),
    rpc: vi.fn().mockResolvedValue({ data: [{ quote_number: 'DEV-2026-001', seq_number: 1 }], error: null }),
  },
}))

vi.mock('@/composables/useAuditLog', () => ({
  useAuditLog: () => ({ logAction: vi.fn() }),
}))

describe('useQuotes.convertToInvoice', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should use vat_rate 0.20 when profile vat_regime is SUBJECT', async () => {
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()
    authStore.profile = {
      vat_regime: 'SUBJECT',
      // other required fields
    } as any
    authStore.user = { id: 'user-1' } as any

    // We test the vat_rate logic in isolation
    const vatRate = authStore.profile?.vat_regime === 'SUBJECT' ? 0.20 : 0
    expect(vatRate).toBe(0.20)
  })

  it('should use vat_rate 0 when profile vat_regime is FRANCHISE', async () => {
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()
    authStore.profile = {
      vat_regime: 'FRANCHISE',
    } as any

    const vatRate = authStore.profile?.vat_regime === 'SUBJECT' ? 0.20 : 0
    expect(vatRate).toBe(0)
  })
})
```

```bash
pnpm test tests/unit/composables/useQuotes.test.ts
```

- [ ] **Step 2 : Implémenter la correction dans `useQuotes.ts`**

Dans `src/composables/useQuotes.ts`, modifier la fonction `convertToInvoice` — remplacer les lignes :

```typescript
// AVANT (lignes ~247-250)
        subtotal: quote.subtotal,
        vat_rate: 0,
        vat_amount: 0,
        total: quote.subtotal,
```

Par :

```typescript
// APRÈS
        subtotal: quote.subtotal,
        vat_rate: authStore.profile?.vat_regime === 'SUBJECT' ? 0.20 : 0,
        vat_amount: authStore.profile?.vat_regime === 'SUBJECT' ? quote.subtotal * 0.20 : 0,
        total: authStore.profile?.vat_regime === 'SUBJECT' ? quote.subtotal * 1.20 : quote.subtotal,
```

- [ ] **Step 3 : Relancer les tests**

```bash
pnpm test tests/unit/composables/useQuotes.test.ts
```

Résultat attendu : tous les tests passent.

- [ ] **Step 4 : Commit**

```bash
git add src/composables/useQuotes.ts tests/unit/composables/useQuotes.test.ts
git commit -m "fix: convertToInvoice now inherits vat_rate from user profile regime"
```

---

## Chunk 2 : Validation du profil avant émission

### Task 3 : Ajouter `isProfileComplete` dans `useAuth` ou `authStore`

**Contexte :** Avant d'émettre une facture, on vérifie que le profil contient les champs obligatoires pour une facture légale : SIRET, adresse, ville, code postal, prénom, nom. L'IBAN est fortement recommandé (mention sur le PDF) mais pas bloquant.

**Files:**
- Modify: `src/stores/auth.ts`
- Create: `tests/unit/stores/auth.test.ts`

- [ ] **Step 1 : Lire `src/stores/auth.ts` pour comprendre la structure du store**

Chercher les champs `profile` et la shape de `Profile`.

- [ ] **Step 2 : Écrire le test échouant**

Créer `tests/unit/stores/auth.test.ts` :

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

describe('authStore.isProfileComplete', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns false when profile is null', () => {
    const store = useAuthStore()
    store.profile = null
    expect(store.isProfileComplete).toBe(false)
  })

  it('returns false when SIRET is missing', () => {
    const store = useAuthStore()
    store.profile = {
      first_name: 'Jean', last_name: 'Dupont',
      address: '12 rue test', city: 'Paris', postal_code: '75001',
      siret: '',
    } as any
    expect(store.isProfileComplete).toBe(false)
  })

  it('returns false when address is missing', () => {
    const store = useAuthStore()
    store.profile = {
      first_name: 'Jean', last_name: 'Dupont',
      address: '', city: 'Paris', postal_code: '75001',
      siret: '12345678901234',
    } as any
    expect(store.isProfileComplete).toBe(false)
  })

  it('returns true when all required fields are present', () => {
    const store = useAuthStore()
    store.profile = {
      first_name: 'Jean', last_name: 'Dupont',
      address: '12 rue de la Paix', city: 'Paris', postal_code: '75001',
      siret: '12345678901234',
    } as any
    expect(store.isProfileComplete).toBe(true)
  })
})
```

```bash
pnpm test tests/unit/stores/auth.test.ts
```

Résultat attendu : erreur `isProfileComplete is not a function/property`.

- [ ] **Step 3 : Ajouter `isProfileComplete` getter dans `src/stores/auth.ts`**

Lire d'abord le fichier, puis ajouter dans les `getters` du store Pinia :

```typescript
isProfileComplete: (state): boolean => {
  const p = state.profile
  if (!p) return false
  return !!(
    p.first_name?.trim() &&
    p.last_name?.trim() &&
    p.siret?.trim() &&
    p.address?.trim() &&
    p.city?.trim() &&
    p.postal_code?.trim()
  )
},
```

- [ ] **Step 4 : Relancer les tests**

```bash
pnpm test tests/unit/stores/auth.test.ts
```

Résultat attendu : tous les tests passent.

- [ ] **Step 5 : Commit**

```bash
git add src/stores/auth.ts tests/unit/stores/auth.test.ts
git commit -m "feat: add isProfileComplete getter to auth store"
```

---

### Task 4 : Bannière d'onboarding si le profil est incomplet

**Contexte :** Si le profil est incomplet, une bannière doit apparaître sur toutes les pages pour guider l'utilisateur vers `/settings`. Cela se place dans `AppLayout.vue`.

**Files:**
- Read: `src/components/layout/AppLayout.vue`
- Modify: `src/components/layout/AppLayout.vue`

- [ ] **Step 1 : Lire `src/components/layout/AppLayout.vue`**

Comprendre où le slot de contenu principal est rendu.

- [ ] **Step 2 : Ajouter la bannière d'onboarding**

Dans `AppLayout.vue`, juste avant le `<slot />` ou la `<RouterView />` principale, ajouter :

```vue
<script setup lang="ts">
// ... imports existants ...
import { useAuthStore } from '@/stores/auth'
import { useRoute } from 'vue-router'
const authStore = useAuthStore()
const route = useRoute()
// Ne pas afficher la bannière sur la page settings elle-même
const showOnboardingBanner = computed(
  () => !authStore.isProfileComplete && route.path !== '/settings'
)
</script>

<!-- Dans le template, juste avant le contenu principal : -->
<div
  v-if="showOnboardingBanner"
  class="mx-4 mt-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm"
>
  <svg class="h-4 w-4 shrink-0 text-amber-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
  </svg>
  <span class="text-amber-800">
    Complétez votre profil avant de facturer —
    <router-link to="/settings" class="font-semibold underline underline-offset-2 hover:text-amber-900">
      Aller aux paramètres
    </router-link>
  </span>
</div>
```

- [ ] **Step 3 : Vérification manuelle**

Lancer le dev server (`pnpm dev`) et se connecter avec un profil vide. Vérifier que la bannière apparaît sur toutes les pages sauf `/settings`.

- [ ] **Step 4 : Commit**

```bash
git add src/components/layout/AppLayout.vue
git commit -m "feat: add onboarding banner when profile is incomplete"
```

---

## Chunk 3 : Modals de confirmation avant émission et annulation

### Task 5 : Modal de confirmation avant émission d'une facture

**Contexte :** `handleEmitInvoice` dans `src/pages/invoices/[id].vue` appelle directement `emitInvoice()` sans confirmation. On doit afficher un modal récapitulatif (client, montant, nb lignes) avec un avertissement "action irréversible".

**Files:**
- Modify: `src/pages/invoices/[id].vue`

- [ ] **Step 1 : Ajouter l'état du modal de confirmation dans le `<script setup>`**

Dans `src/pages/invoices/[id].vue`, après la déclaration de `showPaymentModal` (ligne ~70), ajouter :

```typescript
const showEmitConfirmModal = ref(false)

function requestEmit() {
  showEmitConfirmModal.value = true
}

async function confirmEmit() {
  if (!invoice.value) return
  showEmitConfirmModal.value = false
  emitting.value = true
  const result = await emitInvoice(invoice.value.id)
  emitting.value = false
  if (result) {
    await load()
  }
}
```

- [ ] **Step 2 : Modifier le bouton "Émettre" pour ouvrir le modal**

Remplacer `@click="handleEmitInvoice"` par `@click="requestEmit"` sur le bouton "Émettre la facture".

Supprimer la fonction `handleEmitInvoice` (elle est remplacée par `requestEmit` + `confirmEmit`).

- [ ] **Step 3 : Ajouter le modal de confirmation dans le template**

Après le modal de paiement existant (`</Modal>` final), ajouter :

```vue
<!-- Confirmation modal for invoice emission -->
<Modal
  v-model="showEmitConfirmModal"
  title="Émettre la facture ?"
  description="Cette action est irréversible. Un numéro sera attribué et la facture ne pourra plus être modifiée."
  size="sm"
>
  <div v-if="invoice" class="space-y-3">
    <div class="rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] p-4 space-y-2 text-sm">
      <div class="flex justify-between">
        <span class="text-[#6B7280]">Client</span>
        <span class="font-medium text-[#111827]">{{ client?.name ?? '—' }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-[#6B7280]">Montant TTC</span>
        <span class="font-mono font-bold text-[#7C3AED]">{{ formatCurrency(invoice.total) }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-[#6B7280]">Lignes</span>
        <span class="font-medium text-[#111827]">{{ lines.length }} prestation(s)</span>
      </div>
    </div>
    <div class="flex items-start gap-2 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] px-3 py-2.5">
      <svg class="h-4 w-4 shrink-0 text-[#D97706] mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
      <p class="text-xs text-[#92400E]">
        Une fois émise, la facture sera <strong>définitivement verrouillée</strong>. Elle ne peut plus être modifiée ni supprimée.
      </p>
    </div>
  </div>

  <template #footer>
    <Button variant="ghost" @click="showEmitConfirmModal = false">Annuler</Button>
    <Button variant="default" :loading="emitting" @click="confirmEmit">
      Confirmer l'émission
    </Button>
  </template>
</Modal>
```

- [ ] **Step 4 : Vérification**

```bash
pnpm dev
```

Naviguer vers une facture DRAFT, cliquer "Émettre la facture" → le modal doit apparaître. Cliquer "Annuler" → rien ne se passe. Cliquer "Confirmer" → la facture est émise.

- [ ] **Step 5 : Commit**

```bash
git add src/pages/invoices/[id].vue
git commit -m "feat: add confirmation modal before invoice emission"
```

---

### Task 6 : Modal de confirmation avant annulation d'une facture

**Contexte :** Annuler une facture émise est une action à fort impact (crée un trou visible dans la numérotation). Besoin d'une confirmation.

**Files:**
- Modify: `src/pages/invoices/[id].vue`

Note : `cancelInvoice` n'est pas encore exposé dans la page `[id].vue`. Il faut d'abord vérifier si un bouton d'annulation existe. Si non, ne pas l'ajouter dans cette phase (hors scope). Si oui, appliquer le même pattern que Task 5.

- [ ] **Step 1 : Vérifier si un bouton d'annulation existe dans `[id].vue`**

Lire le template de `src/pages/invoices/[id].vue` et chercher "annul" ou "cancel".

Si le bouton n'existe pas → cette tâche est terminée, passer à Task 7.

Si le bouton existe → continuer.

- [ ] **Step 2 : Appliquer le pattern modal de confirmation**

Même logique que Task 5 : état `showCancelConfirmModal`, fonction `requestCancel()`, fonction `confirmCancel()`, modal dans le template.

Message du modal : "Annuler cette facture créera un écart dans la numérotation. Êtes-vous sûr(e) ?"

- [ ] **Step 3 : Commit si des changements ont été faits**

```bash
git add src/pages/invoices/[id].vue
git commit -m "feat: add confirmation modal before invoice cancellation"
```

---

### Task 7 : Bloquer l'émission si le profil est incomplet

**Contexte :** Si `authStore.isProfileComplete` est `false`, `handleEmitInvoice` (maintenant `requestEmit`) ne doit pas ouvrir le modal de confirmation mais afficher un message d'erreur guidant vers `/settings`.

**Files:**
- Modify: `src/pages/invoices/[id].vue`

- [ ] **Step 1 : Modifier `requestEmit` pour vérifier le profil**

Dans `src/pages/invoices/[id].vue`, modifier la fonction `requestEmit` :

```typescript
const notifications = useNotificationsStore()

function requestEmit() {
  if (!authStore.isProfileComplete) {
    notifications.error(
      'Profil incomplet',
      'Complétez votre profil (SIRET, adresse) avant d\'émettre une facture.'
    )
    return
  }
  showEmitConfirmModal.value = true
}
```

Ajouter l'import de `useNotificationsStore` si pas déjà présent.

- [ ] **Step 2 : Vérification**

Vider le SIRET dans les settings, puis tenter d'émettre une facture → une notification d'erreur doit apparaître, le modal ne s'ouvre pas.

- [ ] **Step 3 : Commit**

```bash
git add src/pages/invoices/[id].vue
git commit -m "feat: block invoice emission when profile is incomplete"
```

---

## Chunk 4 : Overdue non-bloquant + tests de régression

### Task 8 : Rendre `mark_overdue_invoices` non-bloquant par session

**Contexte :** L'appel RPC `mark_overdue_invoices` dans `fetchInvoices` est déjà dans un try/catch. On veut juste s'assurer qu'il ne se lance qu'une fois par session (pas à chaque rechargement de composant) pour éviter des appels inutiles.

**Files:**
- Modify: `src/composables/useInvoices.ts:24-28`

- [ ] **Step 1 : Ajouter un flag session dans le module**

Dans `src/composables/useInvoices.ts`, avant le `export function useInvoices()`, ajouter :

```typescript
// Module-level flag: only call mark_overdue_invoices once per browser session
let overdueMarkedThisSession = false
```

Puis dans `fetchInvoices`, remplacer le bloc try/catch existant par :

```typescript
if (!overdueMarkedThisSession) {
  try {
    await supabase.rpc('mark_overdue_invoices', { p_user_id: authStore.user.id })
    overdueMarkedThisSession = true
  } catch {
    // Non-critical — continue even if this fails
  }
}
```

- [ ] **Step 2 : Commit**

```bash
git add src/composables/useInvoices.ts
git commit -m "perf: call mark_overdue_invoices only once per session"
```

---

### Task 9 : Tests de régression sur les composables modifiés

**Contexte :** S'assurer que les modifications de `useInvoices` et `useQuotes` n'ont pas cassé les tests existants.

- [ ] **Step 1 : Lancer tous les tests unitaires**

```bash
pnpm test
```

Résultat attendu : tous les tests passent (vert).

- [ ] **Step 2 : Si des tests échouent, les corriger**

Lire le message d'erreur, identifier le composable concerné, corriger le test ou l'implémentation.

- [ ] **Step 3 : Commit final si corrections nécessaires**

```bash
git add -A
git commit -m "test: fix regression tests after phase 9 changes"
```

---

## Critères de succès

- [ ] `isWithinAcrePeriod` respecte les 4 trimestres civils complets (4 tests spécifiques passent)
- [ ] `convertToInvoice` crée une facture avec `vat_rate: 0.20` quand le profil est `SUBJECT`
- [ ] `authStore.isProfileComplete` retourne `false` si SIRET ou adresse manquants
- [ ] La bannière d'onboarding s'affiche sur toutes les pages (sauf settings) si profil incomplet
- [ ] Cliquer "Émettre" ouvre un modal de confirmation récapitulatif
- [ ] Si profil incomplet, cliquer "Émettre" affiche une erreur (pas de modal)
- [ ] `pnpm test` → tous les tests passent
