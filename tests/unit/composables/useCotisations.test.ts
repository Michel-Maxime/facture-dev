import { describe, it, expect } from 'vitest'
import { COTISATION_RATES_2026, ACRE_RATES } from '@/lib/constants'
import { isWithinAcrePeriod, getAcreEndDate, getAcreReductionRate, isAcrePostReform } from '@/composables/useCotisations'

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

describe('getAcreEndDate', () => {
  it('created Jan 1 → end date is Dec 31 same year', () => {
    const end = getAcreEndDate('2025-01-01')
    expect(end.getFullYear()).toBe(2025)
    expect(end.getMonth()).toBe(11) // December (0-indexed)
    expect(end.getDate()).toBe(31)
  })

  it('created Mar 15 (Q1) → end date is Mar 31 next year', () => {
    const end = getAcreEndDate('2025-03-15')
    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(2) // March (0-indexed)
    expect(end.getDate()).toBe(31)
  })

  it('created Oct 1 (Q4) → end date is Dec 31 next year', () => {
    const end = getAcreEndDate('2025-10-01')
    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(11) // December (0-indexed)
    expect(end.getDate()).toBe(31)
  })

  it('isWithinAcrePeriod is consistent with getAcreEndDate', () => {
    const createdAt = '2025-03-15'
    const endDate = getAcreEndDate(createdAt)
    // One second before end → still in period
    const beforeEnd = new Date(endDate.getTime() - 1000)
    expect(isWithinAcrePeriod(createdAt, beforeEnd)).toBe(true)
    // One second after end → out of period
    const afterEnd = new Date(endDate.getTime() + 1000)
    expect(isWithinAcrePeriod(createdAt, afterEnd)).toBe(false)
  })
})

describe('getAcreReductionRate', () => {
  it('returns 0.5 (50% reduction) for company created before July 2026', () => {
    expect(getAcreReductionRate('2026-06-30')).toBe(0.5)
    expect(getAcreReductionRate('2024-01-15')).toBe(0.5)
  })

  it('returns 0.75 (25% reduction) for company created on July 1st 2026', () => {
    expect(getAcreReductionRate('2026-07-01')).toBe(0.75)
  })

  it('returns 0.75 for company created after July 2026', () => {
    expect(getAcreReductionRate('2026-09-15')).toBe(0.75)
    expect(getAcreReductionRate('2027-03-01')).toBe(0.75)
  })

  it('correctly impacts cotisation calculation: before reform', () => {
    // 30000 EUR CA x 25.6% BNC_SSI = 7680 EUR base → x 0.5 = 3840 EUR
    const base = 30000 * 0.256
    expect(base * getAcreReductionRate('2026-03-15')).toBeCloseTo(3840, 0)
  })

  it('correctly impacts cotisation calculation: after reform', () => {
    // 30000 EUR CA x 25.6% BNC_SSI = 7680 EUR base → x 0.75 = 5760 EUR
    const base = 30000 * 0.256
    expect(base * getAcreReductionRate('2026-08-01')).toBeCloseTo(5760, 0)
  })

  it('difference between pre and post reform is 1920 EUR on 30k CA', () => {
    const base = 30000 * 0.256
    const preReform = base * getAcreReductionRate('2026-06-15')
    const postReform = base * getAcreReductionRate('2026-07-15')
    expect(postReform - preReform).toBeCloseTo(base * 0.25, 0)
  })
})

describe('isAcrePostReform', () => {
  it('returns false for company created before July 2026', () => {
    expect(isAcrePostReform('2026-06-30')).toBe(false)
    expect(isAcrePostReform('2025-01-01')).toBe(false)
  })

  it('returns true for company created on July 1st 2026', () => {
    expect(isAcrePostReform('2026-07-01')).toBe(true)
  })

  it('returns true for company created after July 2026', () => {
    expect(isAcrePostReform('2026-12-01')).toBe(true)
    expect(isAcrePostReform('2027-06-01')).toBe(true)
  })
})
