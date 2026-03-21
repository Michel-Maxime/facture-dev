# Phase 14 -- Widget URSSAF : CA declarable par periode

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **INTERDICTION DE COMMIT** -- Ne jamais executer `git commit`. Seul l'utilisateur a le droit de committer. Preparer le code, mais s'arreter avant le commit.

**Goal:** Afficher sur le dashboard un widget URSSAF complet permettant au micro-entrepreneur de connaitre son CA encaisse par periode de declaration, le montant de cotisations correspondant, le countdown jusqu'a la deadline, avec navigation entre periodes et lien direct vers le portail URSSAF.

**Architecture:** Nouveau composable `useUrssafPeriods` pour la logique de calcul par periode (requete Supabase sur `payments.date`). Nouveau composant `UrssafWidget.vue` dans `src/components/dashboard/`. Reutilisation de `useCotisations` avec le CA reel de la periode. Integration dans `index.vue` en remplacement de la card "Prochaine declaration Urssaf" existante.

**Tech Stack:** Vue 3, TypeScript, Supabase (requete sur `payments` jointure `invoices`), Tailwind CSS, shadcn-vue (Card, Badge).

**Contexte :** Les micro-entrepreneurs BNC declarent le CA **encaisse** (dates de paiement, pas de facturation) a l'URSSAF. La confusion CA facture vs encaisse est l'erreur n1 documentee sur les forums. La vue `dashboard_stats` actuelle utilise `invoices.status = 'PAID'` et `invoices.total` sur l'annee complete -- elle ne ventile pas par periode. Le composable `useCotisations` divise le CA annuel par le nombre de periodes, ce qui est faux des que les revenus ne sont pas uniformes. Cette phase corrige ce probleme en requetant les paiements reels par plage de dates.

---

## Analyse des ecarts

### Ce qui existe deja (et qu'on reutilise)
- `useCotisations.ts` : calcul du taux (`rate`), deadline logic, cotisations/CFP/VFL -- tout ca reste valide
- `useCotisations` accepte un `revenue: { value: number }` en parametre -- on l'instancie avec le CA reel d'une periode
- Table `payments` avec colonne `date` (type `date`) -- c'est la source de verite pour le CA encaisse
- Composants UI : `Card`, `Badge` -- reutilises directement

### Ce qui manque (et qu'on cree)
1. **Requete Supabase** pour sommer les `payments.amount` par plage de dates (filtree par `user_id` via la jointure `invoices`)
2. **Logique de construction des periodes** : generer les periodes passees et courante (T1 2026, T4 2025... ou mars 2026, fevrier 2026...)
3. **Composant `UrssafWidget.vue`** avec selecteur de periode, affichage CA, cotisations, countdown, lien URSSAF
4. **Tests unitaires** pour la logique de periodes

### Ce qu'on ne touche PAS
- Pas de migration DB (les donnees existent)
- Pas de modification de `dashboard_stats` (on requete `payments` directement)
- Pas d'export PDF pour cette phase (sera une phase ulterieure)

### Bug identifie dans le code existant

La vue `dashboard_stats` (`supabase/migrations/003_functions.sql` ligne 43-54) calcule `ca_encaisse` comme `sum(case when status = 'PAID' then total else 0 end)`. Cela utilise `invoices.total` (montant facture), PAS la somme reelle des paiements. Pour un paiement partiel ou un paiement a une date differente, ce chiffre est faux. Le widget corrige ce probleme en requetant `payments.amount` directement.

---

## Chunk 1 : Composable `useUrssafPeriods`

### Task 1 : Creer le composable de calcul des periodes URSSAF

Ce composable est le coeur de la feature. Il gere :
- La construction de la liste des periodes (passees + courante)
- La requete des paiements par periode
- Le calcul du CA encaisse reel par periode
- La periode courante selectionnee par defaut

**Files:**
- Create: `src/composables/useUrssafPeriods.ts`

- [ ] **Step 1 : Creer `src/composables/useUrssafPeriods.ts`**

```typescript
import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useCotisations } from '@/composables/useCotisations'

/**
 * Represente une periode de declaration URSSAF.
 */
export interface DeclarationPeriod {
  /** Identifiant unique de la periode, ex: "2026-Q1" ou "2026-03" */
  id: string
  /** Label affiche, ex: "T1 2026 : janvier -> mars" ou "Mars 2026" */
  label: string
  /** Date de debut de la periode (incluse) */
  startDate: string
  /** Date de fin de la periode (incluse) */
  endDate: string
  /** Date limite de declaration */
  deadline: string
  /** Label court pour le selecteur, ex: "T1 2026" */
  shortLabel: string
}

const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

/**
 * Construit la liste des periodes trimestrielles.
 * Retourne les periodes de l'annee en cours + l'annee precedente (pour historique).
 * Triees de la plus recente a la plus ancienne.
 */
export function buildQuarterlyPeriods(currentYear: number): DeclarationPeriod[] {
  const periods: DeclarationPeriod[] = []

  for (const year of [currentYear, currentYear - 1]) {
    periods.push({
      id: `${year}-Q1`,
      label: `T1 ${year} : janvier \u2192 mars`,
      shortLabel: `T1 ${year}`,
      startDate: `${year}-01-01`,
      endDate: `${year}-03-31`,
      deadline: `${year}-04-30`,
    })
    periods.push({
      id: `${year}-Q2`,
      label: `T2 ${year} : avril \u2192 juin`,
      shortLabel: `T2 ${year}`,
      startDate: `${year}-04-01`,
      endDate: `${year}-06-30`,
      deadline: `${year}-07-31`,
    })
    periods.push({
      id: `${year}-Q3`,
      label: `T3 ${year} : juillet \u2192 septembre`,
      shortLabel: `T3 ${year}`,
      startDate: `${year}-07-01`,
      endDate: `${year}-09-30`,
      deadline: `${year}-10-31`,
    })
    periods.push({
      id: `${year}-Q4`,
      label: `T4 ${year} : octobre \u2192 d\u00e9cembre`,
      shortLabel: `T4 ${year}`,
      startDate: `${year}-10-01`,
      endDate: `${year}-12-31`,
      deadline: `${year + 1}-01-31`,
    })
  }

  periods.sort((a, b) => b.startDate.localeCompare(a.startDate))
  return periods
}

export function buildMonthlyPeriods(currentYear: number): DeclarationPeriod[] {
  const periods: DeclarationPeriod[] = []

  for (const year of [currentYear, currentYear - 1]) {
    for (let month = 0; month < 12; month++) {
      const m = String(month + 1).padStart(2, '0')
      const lastDay = new Date(year, month + 1, 0).getDate()
      const deadlineDate = new Date(year, month + 2, 0)
      const deadlineStr = deadlineDate.toISOString().slice(0, 10)
      const monthName = MONTH_NAMES[month]
      const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1)

      periods.push({
        id: `${year}-${m}`,
        label: `${capitalizedMonth} ${year}`,
        shortLabel: `${capitalizedMonth} ${year}`,
        startDate: `${year}-${m}-01`,
        endDate: `${year}-${m}-${String(lastDay).padStart(2, '0')}`,
        deadline: deadlineStr,
      })
    }
  }

  periods.sort((a, b) => b.startDate.localeCompare(a.startDate))
  return periods
}

/**
 * Determine la periode courante en fonction de la date du jour.
 */
export function findCurrentPeriod(periods: DeclarationPeriod[], now: Date = new Date()): DeclarationPeriod | undefined {
  const todayStr = now.toISOString().slice(0, 10)
  return periods.find(p => todayStr >= p.startDate && todayStr <= p.endDate)
}

/**
 * Calcule les jours restants avant la deadline d'une periode.
 * Retourne un nombre negatif si la deadline est passee.
 */
export function daysUntilPeriodDeadline(period: DeclarationPeriod, now: Date = new Date()): number {
  const deadline = new Date(period.deadline + 'T23:59:59')
  return Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000)
}

/**
 * Formate la deadline en francais : "30 avril 2026"
 */
export function formatDeadline(period: DeclarationPeriod): string {
  const d = new Date(period.deadline + 'T12:00:00')
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

export function useUrssafPeriods() {
  const authStore = useAuthStore()

  const loading = ref(false)
  const caEncaisse = ref(0)
  const selectedPeriodId = ref<string>('')

  const frequency = computed(() => authStore.profile?.declaration_freq ?? 'QUARTERLY')

  const periods = computed<DeclarationPeriod[]>(() => {
    const year = new Date().getFullYear()
    return frequency.value === 'MONTHLY'
      ? buildMonthlyPeriods(year)
      : buildQuarterlyPeriods(year)
  })

  const currentPeriod = computed(() => findCurrentPeriod(periods.value))

  const selectedPeriod = computed(() =>
    periods.value.find(p => p.id === selectedPeriodId.value) ?? currentPeriod.value,
  )

  // Cotisations calculees sur le CA reel de la periode selectionnee
  const cotisations = useCotisations(caEncaisse)

  const deadline = computed(() => {
    if (!selectedPeriod.value) return ''
    return formatDeadline(selectedPeriod.value)
  })

  const daysRemaining = computed(() => {
    if (!selectedPeriod.value) return 0
    return daysUntilPeriodDeadline(selectedPeriod.value)
  })

  const isCurrentPeriod = computed(() =>
    selectedPeriod.value?.id === currentPeriod.value?.id,
  )

  const isPastDeadline = computed(() => daysRemaining.value < 0)

  /**
   * Requete le CA encaisse pour une periode donnee.
   * Somme les payments.amount ou payments.date est dans la plage [startDate, endDate]
   * et ou l'invoice appartient a l'utilisateur courant.
   */
  async function fetchPeriodCA(period: DeclarationPeriod): Promise<number> {
    if (!authStore.user) return 0

    const { data, error } = await supabase
      .from('payments')
      .select('amount, invoices!inner(user_id)')
      .gte('date', period.startDate)
      .lte('date', period.endDate)
      .eq('invoices.user_id', authStore.user.id)

    if (error) {
      console.error('Error fetching period CA:', error)
      return 0
    }

    return (data ?? []).reduce((sum, p) => sum + Number(p.amount), 0)
  }

  async function loadPeriodData() {
    if (!selectedPeriod.value) return
    loading.value = true
    caEncaisse.value = await fetchPeriodCA(selectedPeriod.value)
    loading.value = false
  }

  // Initialiser avec la periode courante
  function initialize() {
    if (currentPeriod.value && !selectedPeriodId.value) {
      selectedPeriodId.value = currentPeriod.value.id
    }
  }

  // Recharger quand la periode selectionnee change
  watch(selectedPeriodId, () => {
    loadPeriodData()
  })

  return {
    loading,
    caEncaisse,
    selectedPeriodId,
    periods,
    currentPeriod,
    selectedPeriod,
    cotisations,
    deadline,
    daysRemaining,
    isCurrentPeriod,
    isPastDeadline,
    frequency,
    initialize,
    loadPeriodData,
  }
}
```

**Decisions architecturales :**

1. **Requete `payments` directement, pas la vue `dashboard_stats`** : la vue existante agrege sur l'annee entiere et utilise `invoices.total` au lieu de `payments.amount`. Pour le CA encaisse par periode, on a besoin de `payments.date` dans une plage. La requete utilise la syntaxe `invoices!inner(user_id)` de PostgREST pour filtrer par utilisateur via la relation FK.

2. **Fonctions pures exportees separement** : `buildQuarterlyPeriods`, `buildMonthlyPeriods`, `findCurrentPeriod`, `daysUntilPeriodDeadline`, `formatDeadline` sont des fonctions pures (pas de dependance Vue/Supabase) pour faciliter les tests unitaires.

3. **Reutilisation de `useCotisations`** : on l'instancie avec `caEncaisse` (le ref du CA de la periode), ce qui donne automatiquement les cotisations correctes avec le bon taux (ACRE inclus).

---

## Chunk 2 : Composant `UrssafWidget.vue`

### Task 2 : Creer le composant widget

**Files:**
- Create: `src/components/dashboard/UrssafWidget.vue`

- [ ] **Step 1 : Creer le repertoire `src/components/dashboard/`**

```bash
mkdir -p src/components/dashboard
```

- [ ] **Step 2 : Creer `src/components/dashboard/UrssafWidget.vue`**

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useUrssafPeriods } from '@/composables/useUrssafPeriods'
import { formatCurrency, formatPercentage } from '@/utils/formatters'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'

const {
  loading,
  caEncaisse,
  selectedPeriodId,
  periods,
  selectedPeriod,
  cotisations,
  deadline,
  daysRemaining,
  isCurrentPeriod,
  isPastDeadline,
  frequency,
  initialize,
  loadPeriodData,
} = useUrssafPeriods()

onMounted(async () => {
  initialize()
  await loadPeriodData()
})
</script>

<template>
  <Card>
    <div class="space-y-5">
      <!-- Titre + selecteur de periode -->
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-2">
          <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-[#EDE9FE]">
            <svg
              class="w-4 h-4 text-[#7C3AED]"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
              />
            </svg>
          </div>
          <div>
            <h3 class="text-sm font-semibold text-[#111827]">Déclaration URSSAF</h3>
            <p class="text-xs text-[#9CA3AF]">
              {{ frequency === 'MONTHLY' ? 'Déclaration mensuelle' : 'Déclaration trimestrielle' }}
            </p>
          </div>
        </div>

        <!-- Selecteur de periode -->
        <div class="relative">
          <select
            v-model="selectedPeriodId"
            class="h-8 rounded-md border border-[#E5E7EB] bg-white pl-3 pr-7 text-xs font-medium text-[#374151] appearance-none cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:ring-offset-0 focus:border-[#7C3AED]"
            aria-label="Sélectionner une période de déclaration"
          >
            <option
              v-for="period in periods"
              :key="period.id"
              :value="period.id"
            >
              {{ period.shortLabel }}
            </option>
          </select>
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <svg
              class="h-3.5 w-3.5 text-[#9CA3AF]"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
        </div>
      </div>

      <!-- Periode label -->
      <div v-if="selectedPeriod" class="flex items-center gap-2">
        <p class="text-xs text-[#6B7280]">{{ selectedPeriod.label }}</p>
        <Badge v-if="isCurrentPeriod" variant="info">En cours</Badge>
        <Badge v-else-if="isPastDeadline" variant="danger">Échue</Badge>
        <Badge v-else variant="default">Passée</Badge>
      </div>

      <!-- Metriques principales -->
      <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div v-for="n in 3" :key="n">
          <div class="h-4 w-20 bg-[#F3F4F6] rounded animate-pulse mb-2" />
          <div class="h-7 w-28 bg-[#F3F4F6] rounded animate-pulse" />
        </div>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <!-- CA encaisse -->
        <div>
          <p class="text-xs text-[#6B7280] uppercase tracking-wide font-medium">
            CA encaissé
          </p>
          <p class="mt-1 text-xl font-bold font-mono tabular-nums text-[#111827]">
            {{ formatCurrency(caEncaisse) }}
          </p>
          <p class="text-[10px] text-[#9CA3AF] mt-0.5">
            Montant à déclarer
          </p>
        </div>

        <!-- Cotisations estimees -->
        <div>
          <p class="text-xs text-[#6B7280] uppercase tracking-wide font-medium">
            Cotisations estimées
          </p>
          <p class="mt-1 text-xl font-bold font-mono tabular-nums text-[#DC2626]">
            {{ formatCurrency(cotisations.total.value) }}
          </p>
          <p class="text-[10px] text-[#9CA3AF] mt-0.5">
            Taux : {{ formatPercentage(cotisations.rate.value) }}
          </p>
        </div>

        <!-- Net estime -->
        <div>
          <p class="text-xs text-[#6B7280] uppercase tracking-wide font-medium">
            Net après cotisations
          </p>
          <p class="mt-1 text-xl font-bold font-mono tabular-nums text-[#059669]">
            {{ formatCurrency(cotisations.net.value) }}
          </p>
          <p class="text-[10px] text-[#9CA3AF] mt-0.5">
            Ce que vous gardez
          </p>
        </div>
      </div>

      <!-- Detail cotisations (repliable) -->
      <details class="group">
        <summary class="text-xs text-[#7C3AED] font-medium cursor-pointer hover:underline list-none flex items-center gap-1">
          <svg
            class="h-3 w-3 transition-transform group-open:rotate-90"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clip-rule="evenodd"
            />
          </svg>
          Détail des cotisations
        </summary>
        <div class="mt-3 space-y-2 pl-4 border-l-2 border-[#E5E7EB]">
          <div class="flex items-center justify-between text-xs">
            <span class="text-[#6B7280]">Cotisations sociales</span>
            <span class="font-mono font-semibold text-[#111827] tabular-nums">
              {{ formatCurrency(cotisations.cotisations.value) }}
            </span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-[#6B7280]">CFP</span>
            <span class="font-mono font-semibold text-[#111827] tabular-nums">
              {{ formatCurrency(cotisations.cfp.value) }}
            </span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-[#6B7280]">Versement libératoire</span>
            <span class="font-mono font-semibold text-[#111827] tabular-nums">
              {{ formatCurrency(cotisations.vfl.value) }}
            </span>
          </div>
        </div>
      </details>

      <!-- Deadline / Countdown -->
      <div
        v-if="selectedPeriod"
        :class="[
          'flex items-center justify-between rounded-lg px-4 py-3',
          isPastDeadline
            ? 'bg-[#FEE2E2]'
            : daysRemaining <= 7
              ? 'bg-[#FEF3C7]'
              : 'bg-[#F3F4F6]',
        ]"
      >
        <div class="flex items-center gap-2">
          <svg
            :class="[
              'h-4 w-4',
              isPastDeadline
                ? 'text-[#DC2626]'
                : daysRemaining <= 7
                  ? 'text-[#D97706]'
                  : 'text-[#6B7280]',
            ]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
          <span
            :class="[
              'text-sm font-medium',
              isPastDeadline ? 'text-[#991B1B]' : 'text-[#374151]',
            ]"
          >
            <template v-if="isPastDeadline">
              Échéance dépassée
            </template>
            <template v-else>
              Dans {{ daysRemaining }} jour{{ daysRemaining > 1 ? 's' : '' }}
            </template>
          </span>
        </div>
        <span
          :class="[
            'text-xs font-medium',
            isPastDeadline ? 'text-[#991B1B]' : 'text-[#6B7280]',
          ]"
        >
          Avant le {{ deadline }}
        </span>
      </div>

      <!-- Lien URSSAF + disclaimer -->
      <div class="flex items-center justify-between">
        <a
          href="https://www.autoentrepreneur.urssaf.fr"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 text-xs font-medium text-[#7C3AED] hover:underline"
        >
          Déclarer sur autoentrepreneur.urssaf.fr
          <svg
            class="h-3 w-3"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
            />
          </svg>
        </a>
      </div>

      <!-- Disclaimer legal -->
      <p class="text-[10px] text-[#9CA3AF] leading-tight">
        Ce montant est indicatif et calculé sur la base de vos paiements enregistrés.
        Vérifiez toujours le montant exact sur
        <a
          href="https://www.autoentrepreneur.urssaf.fr"
          target="_blank"
          rel="noopener noreferrer"
          class="underline"
        >autoentrepreneur.urssaf.fr</a>
        avant de valider votre déclaration.
      </p>
    </div>
  </Card>
</template>
```

**Decisions de design :**

1. **Le Card n'utilise pas la prop `title`** : on a besoin d'un header custom avec le selecteur de periode a droite, ce qui n'est pas possible avec la prop `title` du composant Card existant. Tout va dans le slot par defaut.

2. **`<details>` pour le detail des cotisations** : plutot qu'afficher toutes les lignes (SSI, CFP, VFL) qui encombrent le widget, on les cache dans un accordeon natif HTML. Zero JS, accessible, fonctionne partout.

3. **Couleurs du countdown** : rouge si deadline passee, jaune si < 7 jours, gris sinon. Coherent avec le design system existant (danger/warning/neutral).

4. **`<select>` natif** plutot que le composant `Select.vue` : le composant Select existant a un layout vertical avec label, ce qui ne convient pas pour un selecteur inline compact. Un select natif style avec les memes classes Tailwind est plus adapte ici.

---

## Chunk 3 : Integration dans le dashboard

### Task 3 : Remplacer la card URSSAF existante dans `index.vue`

La card "Prochaine declaration Urssaf" existante (lignes 218-240 de `index.vue`) affiche des donnees calculees par division du CA annuel. On la remplace par le widget complet.

**Files:**
- Modify: `src/pages/index.vue`

- [ ] **Step 1 : Ajouter l'import de `UrssafWidget`**

Ajouter dans la section `<script setup>` de `index.vue`, apres les autres imports :

```typescript
import UrssafWidget from '@/components/dashboard/UrssafWidget.vue'
```

- [ ] **Step 2 : Remplacer la card "Prochaine declaration Urssaf"**

Remplacer le bloc suivant (lignes 218-240 du fichier actuel) :

```html
    <!-- Declaration helper -->
    <Card title="Prochaine déclaration Urssaf">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="text-center sm:text-left">
          <p class="text-xs text-[#6B7280] uppercase tracking-wide font-medium">CA de la période</p>
          <p class="mt-1 text-lg font-bold font-mono tabular-nums text-[#111827]">
            {{ formatCurrency(cotisations.caPerPeriod.value) }}
          </p>
        </div>
        <div class="text-center sm:text-left">
          <p class="text-xs text-[#6B7280] uppercase tracking-wide font-medium">Cotisations estimées</p>
          <p class="mt-1 text-lg font-bold font-mono tabular-nums text-[#DC2626]">
            {{ formatCurrency(cotisations.cotisationsPerPeriod.value) }}
          </p>
        </div>
        <div class="text-center sm:text-left">
          <p class="text-xs text-[#6B7280] uppercase tracking-wide font-medium">Prochaine échéance</p>
          <p class="mt-1 text-base font-semibold text-[#7C3AED]">
            {{ cotisations.nextDeadline.value }}
          </p>
          <p class="text-xs text-[#9CA3AF] font-mono tabular-nums">J-{{ cotisations.daysUntilDeadline.value }}</p>
        </div>
      </div>
    </Card>
```

Par :

```html
    <!-- URSSAF declaration widget -->
    <UrssafWidget />
```

- [ ] **Step 3 : Verifier les imports restants**

L'import de `useCotisations` dans `index.vue` reste necessaire pour la card "Cotisations estimees" (lignes 178-214) qui utilise `cotisations.cotisations`, `cotisations.cfp`, `cotisations.vfl`, `cotisations.total`, `cotisations.net`, `cotisations.rate`. Aucun import ne doit etre supprime.

---

## Chunk 4 : Tests unitaires

### Task 4 : Tester les fonctions pures de `useUrssafPeriods`

**Files:**
- Create: `tests/unit/composables/useUrssafPeriods.test.ts`

- [ ] **Step 1 : Creer `tests/unit/composables/useUrssafPeriods.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import {
  buildQuarterlyPeriods,
  buildMonthlyPeriods,
  findCurrentPeriod,
  daysUntilPeriodDeadline,
  formatDeadline,
  type DeclarationPeriod,
} from '@/composables/useUrssafPeriods'

describe('buildQuarterlyPeriods', () => {
  const periods = buildQuarterlyPeriods(2026)

  it('generates 8 quarters (current year + previous year)', () => {
    expect(periods).toHaveLength(8)
  })

  it('periods are sorted from most recent to oldest', () => {
    for (let i = 0; i < periods.length - 1; i++) {
      expect(periods[i].startDate >= periods[i + 1].startDate).toBe(true)
    }
  })

  it('T1 2026 has correct dates', () => {
    const t1 = periods.find(p => p.id === '2026-Q1')!
    expect(t1.startDate).toBe('2026-01-01')
    expect(t1.endDate).toBe('2026-03-31')
    expect(t1.deadline).toBe('2026-04-30')
    expect(t1.label).toContain('janvier')
    expect(t1.label).toContain('mars')
  })

  it('T2 2026 deadline is July 31', () => {
    const t2 = periods.find(p => p.id === '2026-Q2')!
    expect(t2.deadline).toBe('2026-07-31')
  })

  it('T3 2026 deadline is October 31', () => {
    const t3 = periods.find(p => p.id === '2026-Q3')!
    expect(t3.deadline).toBe('2026-10-31')
  })

  it('T4 2026 deadline is January 31 of next year', () => {
    const t4 = periods.find(p => p.id === '2026-Q4')!
    expect(t4.deadline).toBe('2027-01-31')
  })

  it('T4 2025 deadline is January 31 2026', () => {
    const t4_2025 = periods.find(p => p.id === '2025-Q4')!
    expect(t4_2025.deadline).toBe('2026-01-31')
  })
})

describe('buildMonthlyPeriods', () => {
  const periods = buildMonthlyPeriods(2026)

  it('generates 24 months (current year + previous year)', () => {
    expect(periods).toHaveLength(24)
  })

  it('periods are sorted from most recent to oldest', () => {
    for (let i = 0; i < periods.length - 1; i++) {
      expect(periods[i].startDate >= periods[i + 1].startDate).toBe(true)
    }
  })

  it('March 2026 has correct dates', () => {
    const march = periods.find(p => p.id === '2026-03')!
    expect(march.startDate).toBe('2026-03-01')
    expect(march.endDate).toBe('2026-03-31')
    expect(march.label).toBe('Mars 2026')
  })

  it('February 2026 has 28 days (non-leap year)', () => {
    const feb = periods.find(p => p.id === '2026-02')!
    expect(feb.endDate).toBe('2026-02-28')
  })

  it('January 2026 deadline is last day of February', () => {
    const jan = periods.find(p => p.id === '2026-01')!
    expect(jan.deadline).toBe('2026-02-28')
  })

  it('December 2026 deadline is last day of January 2027', () => {
    const dec = periods.find(p => p.id === '2026-12')!
    expect(dec.deadline).toBe('2027-01-31')
  })
})

describe('findCurrentPeriod', () => {
  it('finds Q1 2026 on March 15, 2026', () => {
    const periods = buildQuarterlyPeriods(2026)
    const found = findCurrentPeriod(periods, new Date('2026-03-15'))
    expect(found?.id).toBe('2026-Q1')
  })

  it('finds Q4 2025 on December 31, 2025', () => {
    const periods = buildQuarterlyPeriods(2026)
    const found = findCurrentPeriod(periods, new Date('2025-12-31'))
    expect(found?.id).toBe('2025-Q4')
  })

  it('finds the correct month for monthly periods', () => {
    const periods = buildMonthlyPeriods(2026)
    const found = findCurrentPeriod(periods, new Date('2026-03-21'))
    expect(found?.id).toBe('2026-03')
  })

  it('returns first day of period correctly', () => {
    const periods = buildQuarterlyPeriods(2026)
    const found = findCurrentPeriod(periods, new Date('2026-04-01'))
    expect(found?.id).toBe('2026-Q2')
  })

  it('returns last day of period correctly', () => {
    const periods = buildQuarterlyPeriods(2026)
    const found = findCurrentPeriod(periods, new Date('2026-06-30'))
    expect(found?.id).toBe('2026-Q2')
  })
})

describe('daysUntilPeriodDeadline', () => {
  it('returns positive days when before deadline', () => {
    const period: DeclarationPeriod = {
      id: '2026-Q1',
      label: 'T1 2026',
      shortLabel: 'T1 2026',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      deadline: '2026-04-30',
    }
    const days = daysUntilPeriodDeadline(period, new Date('2026-03-21'))
    expect(days).toBe(40)
  })

  it('returns negative days when past deadline', () => {
    const period: DeclarationPeriod = {
      id: '2026-Q1',
      label: 'T1 2026',
      shortLabel: 'T1 2026',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      deadline: '2026-04-30',
    }
    const days = daysUntilPeriodDeadline(period, new Date('2026-05-15'))
    expect(days).toBeLessThan(0)
  })

  it('returns 0 or 1 on deadline day', () => {
    const period: DeclarationPeriod = {
      id: '2026-Q1',
      label: 'T1 2026',
      shortLabel: 'T1 2026',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      deadline: '2026-04-30',
    }
    const days = daysUntilPeriodDeadline(period, new Date('2026-04-30T00:00:00'))
    expect(days).toBeGreaterThanOrEqual(0)
    expect(days).toBeLessThanOrEqual(1)
  })
})

describe('formatDeadline', () => {
  it('formats April 30 2026 in French', () => {
    const period: DeclarationPeriod = {
      id: '2026-Q1',
      label: 'T1 2026',
      shortLabel: 'T1 2026',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      deadline: '2026-04-30',
    }
    const formatted = formatDeadline(period)
    expect(formatted).toContain('30')
    expect(formatted).toContain('avril')
    expect(formatted).toContain('2026')
  })

  it('formats January 31 2027 in French', () => {
    const period: DeclarationPeriod = {
      id: '2026-Q4',
      label: 'T4 2026',
      shortLabel: 'T4 2026',
      startDate: '2026-10-01',
      endDate: '2026-12-31',
      deadline: '2027-01-31',
    }
    const formatted = formatDeadline(period)
    expect(formatted).toContain('31')
    expect(formatted).toContain('janvier')
    expect(formatted).toContain('2027')
  })
})
```

- [ ] **Step 2 : Lancer les tests et verifier qu'ils passent**

```bash
pnpm test -- tests/unit/composables/useUrssafPeriods.test.ts
```

---

## Chunk 5 : Nettoyage et verification finale

### Task 5 : Nettoyage du code et verification end-to-end

**Files:**
- Review: `src/composables/useCotisations.ts` (pas de modification necessaire)
- Review: `src/pages/index.vue`
- Review: `src/composables/useUrssafPeriods.ts`
- Review: `src/components/dashboard/UrssafWidget.vue`

- [ ] **Step 1 : Verifier que `useCotisations` n'a pas besoin de modification**

Le composable `useCotisations` accepte deja un `revenue: { value: number }` en parametre. Le `useUrssafPeriods` l'instancie avec le `caEncaisse` ref de la periode. Les proprietes `caPerPeriod`, `cotisationsPerPeriod`, `nextDeadline`, `daysUntilDeadline` ne sont plus utilisees par le widget (remplacees par la logique de `useUrssafPeriods`), mais elles restent dans le composable car elles servent dans la card "Cotisations estimees" de `index.vue`. Aucune modification requise.

- [ ] **Step 2 : Verifier le type-checking**

```bash
pnpm typecheck
```

Point d'attention : la requete Supabase `payments` avec jointure `invoices!inner(user_id)` pourrait poser un probleme de typage. Si TypeScript se plaint, utiliser un cast explicite sur le resultat de la requete :

```typescript
const { data, error } = await supabase
  .from('payments')
  .select('amount, invoices!inner(user_id)')
  .gte('date', period.startDate)
  .lte('date', period.endDate)
  .eq('invoices.user_id', authStore.user.id) as { data: { amount: number }[] | null; error: any }
```

- [ ] **Step 3 : Lancer tous les tests**

```bash
pnpm test
```

Verifier que les tests existants ne sont pas casses et que les nouveaux tests passent.

- [ ] **Step 4 : Verification visuelle sur le dashboard**

Checklist de verification manuelle :
1. Le widget s'affiche correctement sur desktop (1200px+)
2. Le widget s'affiche correctement sur mobile (375px)
3. Le selecteur de periode change la periode et recharge les donnees
4. Le CA affiche est 0 quand il n'y a aucun paiement sur la periode
5. Le CA affiche correspond bien aux paiements enregistres sur la periode
6. Les cotisations sont calculees sur le CA de la periode affichee
7. Le countdown est correct pour la periode courante
8. Le countdown affiche "Echeance depassee" pour les periodes passees dont la deadline est depassee
9. Le badge "En cours" s'affiche pour la periode courante
10. Le lien autoentrepreneur.urssaf.fr s'ouvre bien
11. Le detail des cotisations s'ouvre/se ferme correctement
12. Le disclaimer legal est visible en bas

- [ ] **Step 5 : Verifier la requete RLS**

La requete `payments` jointure `invoices!inner(user_id)` filtre par `invoices.user_id`. Verifier que la RLS policy sur `payments` autorise la lecture via la FK vers `invoices`. Si la RLS bloque (le resultat est un tableau vide alors que des paiements existent), deux solutions :

**Option A (preferee)** : ajouter une policy RLS `SELECT` sur `payments` :
```sql
CREATE POLICY "Users can read own payments"
  ON payments FOR SELECT
  USING (invoice_id IN (SELECT id FROM invoices WHERE user_id = auth.uid()));
```

**Option B** : creer une RPC server-side qui fait la somme.

Normalement l'option A devrait deja exister (verifier dans les migrations RLS). Si elle n'existe pas, creer une migration `015_payments_rls.sql`.

---

## Recapitulatif des fichiers

| Action | Fichier | Description |
|--------|---------|-------------|
| CREATE | `src/composables/useUrssafPeriods.ts` | Composable : logique de periodes, requete payments, calculs |
| CREATE | `src/components/dashboard/UrssafWidget.vue` | Composant : widget URSSAF complet |
| MODIFY | `src/pages/index.vue` | Remplacer la card URSSAF existante par le widget |
| CREATE | `tests/unit/composables/useUrssafPeriods.test.ts` | Tests des fonctions pures |
| MAYBE  | `supabase/migrations/015_payments_rls.sql` | RLS sur payments si absente |

**Aucune modification de `useCotisations.ts`.** Aucune Edge Function. Pas de migration DB sauf RLS eventuellement.

## Criteres de succes

1. Le widget affiche le CA **encaisse** reel de la periode (somme des `payments.amount` par `payments.date`), pas le CA annuel divise par 4
2. Le selecteur permet de naviguer entre les 8 derniers trimestres (ou 24 derniers mois)
3. Les cotisations sont calculees sur le CA reel de la periode selectionnee
4. Le countdown est precis par rapport a la deadline de la periode selectionnee
5. Le disclaimer legal est present
6. Le lien URSSAF fonctionne
7. Tous les tests passent (`pnpm test`)
8. Zero erreur TypeScript (`pnpm typecheck`)

---

Fichiers pertinents analyses pour produire ce plan :
- `/Users/maxime/Repos/facture-dev/src/composables/useCotisations.ts` -- composable existant dont on reutilise le calcul de cotisations
- `/Users/maxime/Repos/facture-dev/src/pages/index.vue` -- dashboard actuel avec la card URSSAF a remplacer (lignes 218-240)
- `/Users/maxime/Repos/facture-dev/src/composables/usePayments.ts` -- reference pour la table payments
- `/Users/maxime/Repos/facture-dev/src/components/ui/Card.vue` -- composant Card reutilise (slot par defaut, pas de header slot)
- `/Users/maxime/Repos/facture-dev/src/components/ui/Badge.vue` -- composant Badge avec variants
- `/Users/maxime/Repos/facture-dev/src/components/ui/Select.vue` -- non utilise (layout trop vertical pour un selecteur inline)
- `/Users/maxime/Repos/facture-dev/src/lib/constants.ts` -- taux de cotisations 2026
- `/Users/maxime/Repos/facture-dev/src/utils/formatters.ts` -- `formatCurrency`, `formatPercentage` reutilises
- `/Users/maxime/Repos/facture-dev/src/lib/types.ts` -- types generes, structure payments/invoices/profiles
- `/Users/maxime/Repos/facture-dev/supabase/migrations/003_functions.sql` -- vue `dashboard_stats` (lignes 43-54) qui montre le bug CA annuel vs par periode
- `/Users/maxime/Repos/facture-dev/supabase/migrations/001_initial_schema.sql` -- schema `payments` avec colonne `date`
- `/Users/maxime/Repos/facture-dev/tests/unit/composables/useCotisations.composable.test.ts` -- reference pour le pattern de tests existant