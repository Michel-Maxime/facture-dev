import { computed } from 'vue'
import { COTISATION_RATES_2026, ACRE_REFORM_DATE, ACRE_RATES } from '@/lib/constants'
import { useAuthStore } from '@/stores/auth'

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
    if (authStore.profile?.is_acre && isFirstYear.value) {
      const created = authStore.profile?.company_created_at
      if (!created) return base
      return base * getAcreReductionRate(created)
    }
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
