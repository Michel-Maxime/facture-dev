import { computed } from 'vue'
import { THRESHOLDS, ALERT_THRESHOLDS, getProratedThreshold } from '@/lib/constants'
import { useAuthStore } from '@/stores/auth'

export function useThresholds(currentRevenue: { value: number }) {
  const authStore = useAuthStore()

  const companyCreatedAt = computed(() => {
    if (!authStore.profile?.company_created_at) return new Date(new Date().getFullYear(), 0, 1)
    return new Date(authStore.profile.company_created_at)
  })

  const vatThreshold = computed(() =>
    getProratedThreshold(THRESHOLDS.vatFranchise.services, companyCreatedAt.value),
  )

  const vatMajoredThreshold = computed(() =>
    getProratedThreshold(THRESHOLDS.vatMajored.services, companyCreatedAt.value),
  )

  const microThreshold = computed(() =>
    getProratedThreshold(THRESHOLDS.microEnterprise.services, companyCreatedAt.value),
  )

  const vatRatio = computed(() =>
    vatThreshold.value > 0 ? currentRevenue.value / vatThreshold.value : 0,
  )

  const microRatio = computed(() =>
    microThreshold.value > 0 ? currentRevenue.value / microThreshold.value : 0,
  )

  const vatAlert = computed(() => {
    if (vatRatio.value >= ALERT_THRESHOLDS.danger) return 'danger'
    if (vatRatio.value >= ALERT_THRESHOLDS.warning) return 'warning'
    return 'safe'
  })

  const microAlert = computed(() => {
    if (microRatio.value >= ALERT_THRESHOLDS.danger) return 'danger'
    if (microRatio.value >= ALERT_THRESHOLDS.warning) return 'warning'
    return 'safe'
  })

  return {
    vatThreshold,
    vatMajoredThreshold,
    microThreshold,
    vatRatio,
    microRatio,
    vatAlert,
    microAlert,
  }
}
