import { computed } from 'vue'
import { COTISATION_RATES_2026 } from '@/lib/constants'
import { useAuthStore } from '@/stores/auth'

export function useCotisations(revenue: { value: number }) {
  const authStore = useAuthStore()

  // ACRE: halve cotisation rate if enabled and still in first year of activity
  const isFirstYear = computed(() => {
    const created = authStore.profile?.company_created_at
    if (!created) return false
    const ms = Date.now() - new Date(created).getTime()
    return ms < 365.25 * 24 * 60 * 60 * 1000
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
