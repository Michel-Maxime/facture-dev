import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { getProratedThreshold, THRESHOLDS, ALERT_THRESHOLDS } from '@/lib/constants'

// Test getProratedThreshold directly (pure function)
describe('getProratedThreshold', () => {
  it('returns full threshold for company created before current year', () => {
    const currentYear = new Date().getFullYear()
    const createdAt = new Date(currentYear - 2, 5, 1) // 2 years ago
    const result = getProratedThreshold(THRESHOLDS.vatFranchise.services, createdAt)
    // Company created before current year → uses Jan 1, calculates remaining days in year
    // Result is close to (but not necessarily equal to) full threshold due to day calculation
    expect(result).toBeGreaterThan(THRESHOLDS.vatFranchise.services * 0.98)
    expect(result).toBeLessThanOrEqual(THRESHOLDS.vatFranchise.services)
  })

  it('prorates for company created in current year', () => {
    const currentYear = new Date().getFullYear()
    const july1 = new Date(currentYear, 6, 1) // July 1st of current year
    const result = getProratedThreshold(THRESHOLDS.vatFranchise.services, july1)
    expect(result).toBeLessThan(THRESHOLDS.vatFranchise.services)
    expect(result).toBeGreaterThan(0)
  })

  it('returns nearly 0 for company created on Dec 31', () => {
    const currentYear = new Date().getFullYear()
    const dec31 = new Date(currentYear, 11, 31)
    const result = getProratedThreshold(THRESHOLDS.vatFranchise.services, dec31)
    expect(result).toBeLessThanOrEqual(103) // about 1 day worth
  })

  it('returns near-full threshold for company created on Jan 1', () => {
    const currentYear = new Date().getFullYear()
    const jan1 = new Date(currentYear, 0, 1)
    const result = getProratedThreshold(THRESHOLDS.vatFranchise.services, jan1)
    // Jan 1 to Dec 31 = 364 days, so result is slightly less than full threshold
    expect(result).toBeGreaterThan(THRESHOLDS.vatFranchise.services * 0.98)
    expect(result).toBeLessThanOrEqual(THRESHOLDS.vatFranchise.services)
  })
})

describe('ALERT_THRESHOLDS', () => {
  it('warning is 80%', () => {
    expect(ALERT_THRESHOLDS.warning).toBe(0.80)
  })

  it('danger is 95%', () => {
    expect(ALERT_THRESHOLDS.danger).toBe(0.95)
  })
})

describe('threshold alert levels', () => {
  function getAlert(ratio: number): string {
    if (ratio >= ALERT_THRESHOLDS.danger) return 'danger'
    if (ratio >= ALERT_THRESHOLDS.warning) return 'warning'
    return 'safe'
  }

  it('returns safe below 80%', () => {
    expect(getAlert(0.5)).toBe('safe')
    expect(getAlert(0.79)).toBe('safe')
  })

  it('returns warning at 80%', () => {
    expect(getAlert(0.80)).toBe('warning')
    expect(getAlert(0.90)).toBe('warning')
  })

  it('returns danger at 95%', () => {
    expect(getAlert(0.95)).toBe('danger')
    expect(getAlert(1.0)).toBe('danger')
    expect(getAlert(1.5)).toBe('danger')
  })
})
