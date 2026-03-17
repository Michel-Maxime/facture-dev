import { computed } from 'vue'
import { COTISATION_RATES_2026 } from '@/lib/constants'
import { useAuthStore } from '@/stores/auth'

/**
 * Calcule si la date `now` est encore dans la période ACRE.
 * Règle URSSAF : ACRE s'applique jusqu'à la fin du 4ème trimestre civil
 * COMPLET suivant la date de création.
 *
 * Règle simplifiée issue des cas réels URSSAF :
 * - Cas spécial Jan 1 : ACRE jusqu'au 31 déc de la même année (4 trimestres Q1→Q4)
 * - Tous les autres cas : ACRE jusqu'à la fin du même trimestre, l'année suivante
 *
 * Exemples :
 * - créé le 15 mars 2025 (Q1) → fin Q1 2026 = 31 mars 2026
 * - créé le 1er janv 2025    → fin Q4 2025 = 31 déc 2025
 * - créé le 1er oct 2025 (Q4) → fin Q4 2026 = 31 déc 2026
 * - créé le 15 oct 2025 (Q4) → fin Q4 2026 = 31 déc 2026
 */
export function isWithinAcrePeriod(companyCreatedAt: string, now: Date = new Date()): boolean {
  const created = new Date(companyCreatedAt)

  let acreEndDate: Date

  // Cas spécial : créé exactement le 1er janvier → fin du Q4 de la même année
  if (created.getMonth() === 0 && created.getDate() === 1) {
    acreEndDate = new Date(created.getFullYear(), 11, 31, 23, 59, 59, 999)
  } else {
    // Règle générale : fin du même trimestre, l'année suivante
    const createdQuarter = Math.floor(created.getMonth() / 3) // 0=Q1..3=Q4
    // Dernier mois du trimestre (1-indexed) : Q0→3, Q1→6, Q2→9, Q3→12
    const lastMonthOfQuarter = (createdQuarter + 1) * 3
    // new Date(year, month, 0) = dernier jour du mois précédent
    acreEndDate = new Date(created.getFullYear() + 1, lastMonthOfQuarter, 0, 23, 59, 59, 999)
  }

  return now <= acreEndDate
}

export function useCotisations(revenue: { value: number }) {
  const authStore = useAuthStore()

  // ACRE: halve cotisation rate if enabled and still within ACRE period
  const isFirstYear = computed(() => {
    const created = authStore.profile?.company_created_at
    if (!created) return false
    return isWithinAcrePeriod(created)
  })

  const rate = computed(() => {
    const base = authStore.profile?.cotisation_rate ?? COTISATION_RATES_2026.BNC_SSI
    if (authStore.profile?.is_acre && isFirstYear.value) return base / 2
    return base
  })

  const cotisations = computed(() => revenue.value * rate.value)

  const cfp = computed(() => revenue.value * COTISATION_RATES_2026.CFP)

  const vfl = computed(() => revenue.value * COTISATION_RATES_2026.VFL_BNC)

  const total = computed(() => cotisations.value + cfp.value + vfl.value)

  const net = computed(() => revenue.value - total.value)

  // Number of declaration periods per year based on user's declaration frequency
  const periodsPerYear = computed(() => {
    const freq = authStore.profile?.declaration_freq ?? 'QUARTERLY'
    return freq === 'MONTHLY' ? 12 : 4
  })

  // Average CA per declaration period (monthly or quarterly)
  const caPerPeriod = computed(() => revenue.value / periodsPerYear.value)

  // Estimated cotisations due per declaration period
  const cotisationsPerPeriod = computed(() => total.value / periodsPerYear.value)

  // Compute the next Urssaf declaration deadline date
  function computeNextDeclarationDate(): Date {
    const freq = authStore.profile?.declaration_freq ?? 'QUARTERLY'
    const now = new Date()

    if (freq === 'MONTHLY') {
      // Last day of next month
      // new Date(year, month+2, 0) gives the last day of month+1 (0-indexed)
      const nextMonth = now.getMonth() + 2 // next month, 0-indexed+2 = last day trick
      return new Date(now.getFullYear(), nextMonth, 0)
    }

    // Quarterly: deadlines are the last day of the month following each quarter end
    // Quarter ends: March (Q1), June (Q2), September (Q3), December (Q4)
    // Deadlines: April 30, July 31, October 31, January 31
    // Stored as [month, day] pairs (1-indexed months)
    const deadlines: [number, number][] = [
      [4, 30],  // April 30
      [7, 31],  // July 31
      [10, 31], // October 31
      [1, 31],  // January 31 (next year)
    ]
    const currentMonth = now.getMonth() + 1 // 1-indexed
    const found = deadlines.find(([m]) => m > currentMonth)
    if (found) {
      return new Date(now.getFullYear(), found[0] - 1, found[1])
    }
    // Wrap to January 31 of next year
    return new Date(now.getFullYear() + 1, 0, 31)
  }

  // Next declaration deadline formatted in French (e.g. "15 avril 2026")
  const nextDeadline = computed(() => {
    const next = computeNextDeclarationDate()
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
    }).format(next)
  })

  // Days remaining until the next declaration deadline
  const daysUntilDeadline = computed(() => {
    const next = computeNextDeclarationDate()
    const now = new Date()
    return Math.ceil((next.getTime() - now.getTime()) / 86_400_000)
  })

  return {
    rate,
    cotisations,
    cfp,
    vfl,
    total,
    net,
    caPerPeriod,
    cotisationsPerPeriod,
    nextDeadline,
    daysUntilDeadline,
  }
}
