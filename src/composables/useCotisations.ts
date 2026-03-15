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

  return { rate, cotisations, cfp, vfl, total, net }
}
