import { describe, it, expect } from 'vitest'
import { COTISATION_RATES_2026 } from '@/lib/constants'
import { isWithinAcrePeriod } from '@/composables/useCotisations'

describe('cotisation rates 2026', () => {
  it('BNC_SSI rate is 25.6%', () => {
    expect(COTISATION_RATES_2026.BNC_SSI).toBe(0.256)
  })

  it('BNC_CIPAV rate is 23.2%', () => {
    expect(COTISATION_RATES_2026.BNC_CIPAV).toBe(0.232)
  })

  it('calculates cotisations correctly for 10000 revenue', () => {
    const revenue = 10_000
    const cotisations = revenue * COTISATION_RATES_2026.BNC_SSI
    const cfp = revenue * COTISATION_RATES_2026.CFP
    const vfl = revenue * COTISATION_RATES_2026.VFL_BNC
    const total = cotisations + cfp + vfl

    expect(cotisations).toBe(2560)
    expect(cfp).toBe(20)
    expect(vfl).toBe(220)
    expect(total).toBe(2800)
  })

  it('calculates net revenue correctly', () => {
    const revenue = 10_000
    const total = revenue * (COTISATION_RATES_2026.BNC_SSI + COTISATION_RATES_2026.CFP + COTISATION_RATES_2026.VFL_BNC)
    const net = revenue - total
    expect(net).toBe(7200)
  })

  it('BIC_SERVICES rate is 21.2%', () => {
    expect(COTISATION_RATES_2026.BIC_SERVICES).toBe(0.212)
  })

  it('BIC_VENTE rate is 12.3%', () => {
    expect(COTISATION_RATES_2026.BIC_VENTE).toBe(0.123)
  })
})

describe('isWithinAcrePeriod', () => {
  it('should still be first year if within 4 complete civil quarters', () => {
    // Créé le 15 mars 2025 → ACRE valide jusqu'au 31 mars 2026
    const createdAt = '2025-03-15'
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
    // Créé le 1er oct 2025 (Q4) → fin Q4 2026 = 31 déc 2026
    const createdAt = '2025-10-01'
    expect(isWithinAcrePeriod(createdAt, new Date('2026-12-31T23:59:00'))).toBe(true)
    expect(isWithinAcrePeriod(createdAt, new Date('2027-01-01T00:00:00'))).toBe(false)
  })
})
