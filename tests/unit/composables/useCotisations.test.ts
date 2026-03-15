import { describe, it, expect } from 'vitest'
import { COTISATION_RATES_2026 } from '@/lib/constants'

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
