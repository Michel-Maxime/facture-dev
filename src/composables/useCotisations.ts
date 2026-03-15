import { computed } from 'vue'
import { COTISATION_RATES_2026 } from '@/lib/constants'
import { useAuthStore } from '@/stores/auth'

export function useCotisations(revenue: { value: number }) {
  const authStore = useAuthStore()

  const rate = computed(
    () => authStore.profile?.cotisation_rate ?? COTISATION_RATES_2026.BNC_SSI,
  )

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
      // 15th of next month
      return new Date(now.getFullYear(), now.getMonth() + 1, 15)
    }

    // Quarterly: deadline is the 15th of the month following each quarter end
    // Quarter ends: March (Q1), June (Q2), September (Q3), December (Q4)
    // Deadlines: 15 April, 15 July, 15 October, 15 January
    const deadlineMonths = [3, 6, 9, 12] // 1-indexed months (April=4→index 3)
    const currentMonth = now.getMonth() + 1
    const nextDeadlineMonth = deadlineMonths.find((m) => m > currentMonth) ?? 1
    const year = nextDeadlineMonth === 1 ? now.getFullYear() + 1 : now.getFullYear()
    return new Date(year, nextDeadlineMonth - 1, 15)
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
