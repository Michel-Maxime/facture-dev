import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { invoicesCreated: 1 }, error: null }),
    },
  },
}))

vi.mock('@/composables/useAuditLog', () => ({
  useAuditLog: () => ({ logAction: vi.fn() }),
}))

describe('computeNextRunDate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('computes next monthly run on day 1 when already past day 1', async () => {
    const { computeNextRunDate } = await import('@/composables/useRecurringInvoices')
    // Today is 2026-03-17 and day_of_month is 1 → next run is 2026-04-01
    const result = computeNextRunDate('MONTHLY', 1, new Date('2026-03-17'))
    expect(result).toBe('2026-04-01')
  })

  it('if today is before day_of_month, next run is this month', async () => {
    const { computeNextRunDate } = await import('@/composables/useRecurringInvoices')
    // Today is 2026-03-05, day_of_month is 15 → next run is 2026-03-15
    const result = computeNextRunDate('MONTHLY', 15, new Date('2026-03-05'))
    expect(result).toBe('2026-03-15')
  })

  it('computes next quarterly run', async () => {
    const { computeNextRunDate } = await import('@/composables/useRecurringInvoices')
    // Today is 2026-03-17, day_of_month is 1, quarterly → next Q start is 2026-04-01
    const result = computeNextRunDate('QUARTERLY', 1, new Date('2026-03-17'))
    expect(result).toBe('2026-04-01')
  })

  it('wraps to next year for monthly in December', async () => {
    const { computeNextRunDate } = await import('@/composables/useRecurringInvoices')
    // Today is 2026-12-17, day_of_month is 1 → next run is 2027-01-01
    const result = computeNextRunDate('MONTHLY', 1, new Date('2026-12-17'))
    expect(result).toBe('2027-01-01')
  })

  it('wraps to next year for quarterly in Q4', async () => {
    const { computeNextRunDate } = await import('@/composables/useRecurringInvoices')
    // Today is 2026-11-01 (Q4), quarterly → next Q is Q1 2027
    const result = computeNextRunDate('QUARTERLY', 1, new Date('2026-11-01'))
    expect(result).toBe('2027-01-01')
  })
})
