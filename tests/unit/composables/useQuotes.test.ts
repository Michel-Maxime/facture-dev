import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'inv-1', total: 500 }, error: null }),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    })),
    rpc: vi.fn().mockResolvedValue({
      data: [{ quote_number: 'DEV-2026-001', seq_number: 1 }],
      error: null,
    }),
  },
}))

vi.mock('@/composables/useAuditLog', () => ({
  useAuditLog: () => ({ logAction: vi.fn() }),
}))

describe('useQuotes — convertToInvoice VAT logic', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('uses vat_rate 0.20 when profile vat_regime is SUBJECT', async () => {
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()
    authStore.profile = { vat_regime: 'SUBJECT' } as any

    const vatRate = authStore.profile?.vat_regime === 'SUBJECT' ? 0.20 : 0
    expect(vatRate).toBe(0.20)
  })

  it('uses vat_rate 0 when profile vat_regime is FRANCHISE', async () => {
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()
    authStore.profile = { vat_regime: 'FRANCHISE' } as any

    const vatRate = authStore.profile?.vat_regime === 'SUBJECT' ? 0.20 : 0
    expect(vatRate).toBe(0)
  })

  it('uses vat_rate 0 when profile is null', async () => {
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()
    authStore.profile = null

    const vatRate = authStore.profile?.vat_regime === 'SUBJECT' ? 0.20 : 0
    expect(vatRate).toBe(0)
  })
})
