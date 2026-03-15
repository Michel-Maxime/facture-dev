import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { useThresholds } from '@/composables/useThresholds'
import { THRESHOLDS, getProratedThreshold } from '@/lib/constants'
import { useAuthStore } from '@/stores/auth'
import type { Profile } from '@/lib/types'

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'test-user-id',
    first_name: 'Test',
    last_name: 'User',
    address: '1 rue Test',
    city: 'Paris',
    postal_code: '75001',
    siret: '12345678901234',
    company_created_at: '2024-01-01',
    vat_regime: 'FRANCHISE',
    declaration_freq: 'QUARTERLY',
    cotisation_rate: 0.256,
    code_ape: null,
    iban: null,
    bic: null,
    logo_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as Profile
}

describe('useThresholds composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns vatThreshold as a computed ref', () => {
    const revenue = ref(0)
    const { vatThreshold } = useThresholds(revenue)
    expect(vatThreshold.value).toBeGreaterThan(0)
    expect(vatThreshold.value).toBeLessThanOrEqual(THRESHOLDS.vatFranchise.services)
  })

  it('returns microThreshold as a computed ref', () => {
    const revenue = ref(0)
    const { microThreshold } = useThresholds(revenue)
    expect(microThreshold.value).toBeGreaterThan(0)
    expect(microThreshold.value).toBeLessThanOrEqual(THRESHOLDS.microEnterprise.services)
  })

  it('returns safe alert when revenue is 0', () => {
    const revenue = ref(0)
    const { vatAlert, microAlert } = useThresholds(revenue)
    expect(vatAlert.value).toBe('safe')
    expect(microAlert.value).toBe('safe')
  })

  it('returns warning alert at 80% of threshold', () => {
    const revenue = ref(0)
    const { vatThreshold, vatAlert } = useThresholds(revenue)
    revenue.value = Math.ceil(vatThreshold.value * 0.82)
    expect(vatAlert.value).toBe('warning')
  })

  it('returns danger alert at 95% of threshold', () => {
    const revenue = ref(0)
    const { vatThreshold, vatAlert } = useThresholds(revenue)
    revenue.value = Math.ceil(vatThreshold.value * 0.97)
    expect(vatAlert.value).toBe('danger')
  })

  it('vatRatio equals revenue / vatThreshold', () => {
    const revenue = ref(0)
    const { vatThreshold, vatRatio } = useThresholds(revenue)
    revenue.value = 10000
    expect(vatRatio.value).toBeCloseTo(10000 / vatThreshold.value, 5)
  })

  it('microRatio equals revenue / microThreshold', () => {
    const revenue = ref(0)
    const { microThreshold, microRatio } = useThresholds(revenue)
    revenue.value = 20000
    expect(microRatio.value).toBeCloseTo(20000 / microThreshold.value, 5)
  })

  it('uses profile company_created_at for threshold prorating', () => {
    const authStore = useAuthStore()
    authStore.setProfile(makeProfile({ company_created_at: '2026-07-01' }))
    const revenue = ref(0)
    const { vatThreshold } = useThresholds(revenue)
    // Threshold should be prorated for a company created mid-year
    const expectedThreshold = getProratedThreshold(THRESHOLDS.vatFranchise.services, new Date('2026-07-01'))
    expect(vatThreshold.value).toBeCloseTo(expectedThreshold, 0)
  })

  it('exposes vatMajoredThreshold as a computed ref', () => {
    const revenue = ref(0)
    const { vatMajoredThreshold } = useThresholds(revenue)
    expect(vatMajoredThreshold.value).toBeGreaterThan(0)
    expect(vatMajoredThreshold.value).toBeLessThanOrEqual(THRESHOLDS.vatMajored.services)
  })
})
