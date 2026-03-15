import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, formatSiret, formatIban, formatPercentage, formatPhone } from '@/utils/formatters'

describe('formatCurrency', () => {
  it('formats positive amount', () => {
    const result = formatCurrency(1234.56)
    expect(result).toContain('1')
    expect(result).toContain('234')
    expect(result).toContain('€')
  })

  it('formats zero', () => {
    const result = formatCurrency(0)
    expect(result).toContain('0')
    expect(result).toContain('€')
  })

  it('formats negative amount', () => {
    const result = formatCurrency(-500)
    expect(result).toContain('500')
  })
})

describe('formatDate', () => {
  it('formats date string to dd/mm/yyyy', () => {
    const result = formatDate('2026-03-15')
    expect(result).toBe('15/03/2026')
  })

  it('formats Date object', () => {
    const result = formatDate(new Date(2026, 2, 15))
    expect(result).toBe('15/03/2026')
  })
})

describe('formatSiret', () => {
  it('formats 14-digit SIRET', () => {
    const result = formatSiret('12345678901234')
    expect(result).toBe('123 456 789 01234')
  })

  it('returns invalid SIRET as-is', () => {
    const result = formatSiret('123')
    expect(result).toBe('123')
  })
})

describe('formatIban', () => {
  it('formats IBAN with spaces every 4 chars', () => {
    const result = formatIban('FR7630006000011234567890189')
    expect(result).toMatch(/^FR76/)
    expect(result).toContain(' ')
  })
})

describe('formatPhone', () => {
  it('formats 10-digit French phone number', () => {
    const result = formatPhone('0612345678')
    expect(result).toBe('06 12 34 56 78')
  })

  it('returns non-10-digit number as-is', () => {
    expect(formatPhone('+33612345678')).toBe('+33612345678')
    expect(formatPhone('123')).toBe('123')
  })
})

describe('formatPercentage', () => {
  it('formats 0.256 as percentage', () => {
    const result = formatPercentage(0.256)
    expect(result).toContain('25')
    expect(result).toContain('%')
  })
})
