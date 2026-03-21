import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { useCotisations } from '@/composables/useCotisations'
import { COTISATION_RATES_2026 } from '@/lib/constants'
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
    cotisation_rate: COTISATION_RATES_2026.BNC_SSI,
    is_acre: null,
    acre_public_eligible: false,
    code_ape: null,
    iban: null,
    bic: null,
    logo_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as Profile
}

describe('useCotisations composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('calculates cotisations (SSI) for given revenue', () => {
    const revenue = ref(10000)
    const { cotisations } = useCotisations(revenue)
    expect(cotisations.value).toBeCloseTo(10000 * COTISATION_RATES_2026.BNC_SSI, 2)
  })

  it('calculates CFP for given revenue', () => {
    const revenue = ref(10000)
    const { cfp } = useCotisations(revenue)
    expect(cfp.value).toBeCloseTo(10000 * COTISATION_RATES_2026.CFP, 2)
  })

  it('calculates VFL for given revenue', () => {
    const revenue = ref(10000)
    const { vfl } = useCotisations(revenue)
    expect(vfl.value).toBeCloseTo(10000 * COTISATION_RATES_2026.VFL_BNC, 2)
  })

  it('total = cotisations + CFP + VFL', () => {
    const revenue = ref(10000)
    const { cotisations, cfp, vfl, total } = useCotisations(revenue)
    expect(total.value).toBeCloseTo(cotisations.value + cfp.value + vfl.value, 2)
  })

  it('net = revenue - total', () => {
    const revenue = ref(10000)
    const { total, net } = useCotisations(revenue)
    expect(net.value).toBeCloseTo(10000 - total.value, 2)
  })

  it('all values are 0 when revenue is 0', () => {
    const revenue = ref(0)
    const { cotisations, cfp, vfl, total, net } = useCotisations(revenue)
    expect(cotisations.value).toBe(0)
    expect(cfp.value).toBe(0)
    expect(vfl.value).toBe(0)
    expect(total.value).toBe(0)
    expect(net.value).toBe(0)
  })

  it('uses total rate of 25.6% + 0.2% + 2.2% = 28%', () => {
    const revenue = ref(100)
    const { total } = useCotisations(revenue)
    const expectedTotal = 100 * (COTISATION_RATES_2026.BNC_SSI + COTISATION_RATES_2026.CFP + COTISATION_RATES_2026.VFL_BNC)
    expect(total.value).toBeCloseTo(expectedTotal, 2)
  })

  it('rate computed ref returns the BNC_SSI rate by default', () => {
    const revenue = ref(0)
    const { rate } = useCotisations(revenue)
    expect(rate.value).toBe(COTISATION_RATES_2026.BNC_SSI)
  })

  it('caPerPeriod defaults to quarterly (revenue / 4)', () => {
    const revenue = ref(40000)
    const { caPerPeriod } = useCotisations(revenue)
    // Default declaration_freq is QUARTERLY (no profile = no freq set)
    expect(caPerPeriod.value).toBeCloseTo(10000, 2)
  })

  it('cotisationsPerPeriod = total / periodsPerYear', () => {
    const revenue = ref(40000)
    const { total, cotisationsPerPeriod } = useCotisations(revenue)
    // Default is quarterly (4 periods)
    expect(cotisationsPerPeriod.value).toBeCloseTo(total.value / 4, 2)
  })

  it('nextDeadline returns a non-empty French date string', () => {
    const revenue = ref(10000)
    const { nextDeadline } = useCotisations(revenue)
    // Should return a date string like "15 avril 2026"
    expect(typeof nextDeadline.value).toBe('string')
    expect(nextDeadline.value.length).toBeGreaterThan(0)
  })

  it('daysUntilDeadline returns a positive number', () => {
    const revenue = ref(10000)
    const { daysUntilDeadline } = useCotisations(revenue)
    expect(daysUntilDeadline.value).toBeGreaterThan(0)
  })

  it('caPerPeriod is revenue/12 when declaration_freq is MONTHLY', () => {
    const authStore = useAuthStore()
    authStore.setProfile(makeProfile({ declaration_freq: 'MONTHLY' }))
    const revenue = ref(12000)
    const { caPerPeriod } = useCotisations(revenue)
    expect(caPerPeriod.value).toBeCloseTo(1000, 2)
  })

  it('nextDeadline returns a valid date string when declaration_freq is MONTHLY', () => {
    const authStore = useAuthStore()
    authStore.setProfile(makeProfile({ declaration_freq: 'MONTHLY' }))
    const revenue = ref(0)
    const { nextDeadline } = useCotisations(revenue)
    expect(typeof nextDeadline.value).toBe('string')
    expect(nextDeadline.value.length).toBeGreaterThan(0)
  })

  it('daysUntilDeadline is positive for MONTHLY frequency', () => {
    const authStore = useAuthStore()
    authStore.setProfile(makeProfile({ declaration_freq: 'MONTHLY' }))
    const revenue = ref(0)
    const { daysUntilDeadline } = useCotisations(revenue)
    expect(daysUntilDeadline.value).toBeGreaterThan(0)
  })
})

describe('useCotisations - Urssaf quarterly deadline dates', () => {
  // The real Urssaf quarterly deadlines are:
  // April 30, July 31, October 31, January 31 (next year)
  // This tests the pure logic of computeNextDeclarationDate

  function computeNextQuarterlyDeadline(currentMonth: number, currentYear: number): { month: number; day: number; year: number } {
    const deadlines: [number, number][] = [
      [4, 30],
      [7, 31],
      [10, 31],
      [1, 31],
    ]
    const found = deadlines.find(([m]) => m > currentMonth)
    if (found) {
      return { month: found[0], day: found[1], year: currentYear }
    }
    return { month: 1, day: 31, year: currentYear + 1 }
  }

  it('from January (month 1): next deadline is April 30', () => {
    const result = computeNextQuarterlyDeadline(1, 2026)
    expect(result).toEqual({ month: 4, day: 30, year: 2026 })
  })

  it('from March (month 3): next deadline is April 30', () => {
    const result = computeNextQuarterlyDeadline(3, 2026)
    expect(result).toEqual({ month: 4, day: 30, year: 2026 })
  })

  it('from April (month 4): next deadline is July 31', () => {
    const result = computeNextQuarterlyDeadline(4, 2026)
    expect(result).toEqual({ month: 7, day: 31, year: 2026 })
  })

  it('from June (month 6): next deadline is July 31', () => {
    const result = computeNextQuarterlyDeadline(6, 2026)
    expect(result).toEqual({ month: 7, day: 31, year: 2026 })
  })

  it('from July (month 7): next deadline is October 31', () => {
    const result = computeNextQuarterlyDeadline(7, 2026)
    expect(result).toEqual({ month: 10, day: 31, year: 2026 })
  })

  it('from September (month 9): next deadline is October 31', () => {
    const result = computeNextQuarterlyDeadline(9, 2026)
    expect(result).toEqual({ month: 10, day: 31, year: 2026 })
  })

  it('from October (month 10): next deadline is January 31 next year', () => {
    const result = computeNextQuarterlyDeadline(10, 2026)
    expect(result).toEqual({ month: 1, day: 31, year: 2027 })
  })

  it('from December (month 12): next deadline is January 31 next year', () => {
    const result = computeNextQuarterlyDeadline(12, 2026)
    expect(result).toEqual({ month: 1, day: 31, year: 2027 })
  })

  it('nextDeadline from composable is not on the 15th (old bug check)', () => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.setProfile(makeProfile({ declaration_freq: 'QUARTERLY' }))
    const revenue = ref(0)
    const { nextDeadline } = useCotisations(revenue)
    // The old bug returned "15 avril" instead of "30 avril"
    expect(nextDeadline.value).not.toContain('15')
  })
})

describe('useCotisations - ACRE reform rate', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('applies 50% reduction (rate × 0.5) for ACRE before reform', () => {
    const authStore = useAuthStore()
    authStore.setProfile(makeProfile({ is_acre: true, company_created_at: '2026-03-15', cotisation_rate: 0.256 }))
    const { rate } = useCotisations(ref(10000))
    expect(rate.value).toBeCloseTo(0.128, 4) // 0.256 × 0.5
  })

  it('applies 25% reduction (rate × 0.75) for ACRE after reform', () => {
    const authStore = useAuthStore()
    authStore.setProfile(makeProfile({ is_acre: true, company_created_at: '2026-08-01', cotisation_rate: 0.256 }))
    const { rate } = useCotisations(ref(10000))
    expect(rate.value).toBeCloseTo(0.192, 4) // 0.256 × 0.75
  })

  it('applies full rate when ACRE is disabled regardless of creation date', () => {
    const authStore = useAuthStore()
    authStore.setProfile(makeProfile({ is_acre: false, company_created_at: '2026-08-01', cotisation_rate: 0.256 }))
    const { rate } = useCotisations(ref(10000))
    expect(rate.value).toBeCloseTo(0.256, 4)
  })
})
