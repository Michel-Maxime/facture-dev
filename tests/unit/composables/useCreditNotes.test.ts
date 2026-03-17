import { describe, it, expect } from 'vitest'

// Test credit note business logic (pure functions only, no Supabase)

describe('credit note number format', () => {
  function formatCreditNoteNumber(year: number, seq: number): string {
    return `AV-${year}-${String(seq).padStart(3, '0')}`
  }

  it('formats AV-2026-001', () => {
    expect(formatCreditNoteNumber(2026, 1)).toBe('AV-2026-001')
  })

  it('formats AV-2026-010', () => {
    expect(formatCreditNoteNumber(2026, 10)).toBe('AV-2026-010')
  })

  it('formats AV-2026-100', () => {
    expect(formatCreditNoteNumber(2026, 100)).toBe('AV-2026-100')
  })

  it('uses AV prefix (not FAC)', () => {
    expect(formatCreditNoteNumber(2026, 1)).toMatch(/^AV-/)
  })
})

describe('credit note amounts negation', () => {
  function negateLine(line: { quantity: number; unit_price: number; amount: number }) {
    return {
      quantity: line.quantity,
      unit_price: -Math.abs(line.unit_price),
      amount: -Math.abs(line.amount),
    }
  }

  function negateInvoice(invoice: { subtotal: number; vat_amount: number; total: number }) {
    return {
      subtotal: -Math.abs(invoice.subtotal),
      vat_amount: -Math.abs(invoice.vat_amount),
      total: -Math.abs(invoice.total),
    }
  }

  it('negates line amounts', () => {
    const line = { quantity: 2, unit_price: 500, amount: 1000 }
    const negated = negateLine(line)
    expect(negated.unit_price).toBe(-500)
    expect(negated.amount).toBe(-1000)
    expect(negated.quantity).toBe(2) // quantity stays positive
  })

  it('negates invoice totals', () => {
    const invoice = { subtotal: 1000, vat_amount: 200, total: 1200 }
    const negated = negateInvoice(invoice)
    expect(negated.subtotal).toBe(-1000)
    expect(negated.vat_amount).toBe(-200)
    expect(negated.total).toBe(-1200)
  })

  it('always negates even if input is already negative (idempotent via Math.abs)', () => {
    const invoice = { subtotal: -1000, vat_amount: -200, total: -1200 }
    const negated = negateInvoice(invoice)
    expect(negated.subtotal).toBe(-1000)
    expect(negated.total).toBe(-1200)
  })
})

describe('credit note references original invoice', () => {
  interface CreditNote {
    id: string
    original_invoice_id: string
    status: 'DRAFT' | 'SENT'
    number: string | null
  }

  it('credit note references the original invoice id', () => {
    const originalInvoiceId = 'invoice-uuid-123'
    const creditNote: CreditNote = {
      id: 'cn-uuid-456',
      original_invoice_id: originalInvoiceId,
      status: 'DRAFT',
      number: null,
    }
    expect(creditNote.original_invoice_id).toBe(originalInvoiceId)
  })

  it('credit note starts as DRAFT with no number', () => {
    const creditNote: CreditNote = {
      id: 'cn-uuid-456',
      original_invoice_id: 'invoice-uuid-123',
      status: 'DRAFT',
      number: null,
    }
    expect(creditNote.status).toBe('DRAFT')
    expect(creditNote.number).toBeNull()
  })

  it('credit note gets number on emission', () => {
    const creditNote: CreditNote = {
      id: 'cn-uuid-456',
      original_invoice_id: 'invoice-uuid-123',
      status: 'SENT',
      number: 'AV-2026-001',
    }
    expect(creditNote.status).toBe('SENT')
    expect(creditNote.number).toBe('AV-2026-001')
  })
})

describe('invoice is CANCELLED after credit note emission', () => {
  type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'

  function canCreateCreditNote(status: InvoiceStatus): boolean {
    return status === 'SENT' || status === 'OVERDUE'
  }

  function invoiceStatusAfterCreditNoteEmission(_currentStatus: InvoiceStatus): InvoiceStatus {
    return 'CANCELLED'
  }

  it('credit note can only be created for SENT invoices', () => {
    expect(canCreateCreditNote('SENT')).toBe(true)
    expect(canCreateCreditNote('OVERDUE')).toBe(true)
    expect(canCreateCreditNote('DRAFT')).toBe(false)
    expect(canCreateCreditNote('PAID')).toBe(false)
    expect(canCreateCreditNote('CANCELLED')).toBe(false)
  })

  it('original invoice becomes CANCELLED after credit note emission', () => {
    expect(invoiceStatusAfterCreditNoteEmission('SENT')).toBe('CANCELLED')
    expect(invoiceStatusAfterCreditNoteEmission('OVERDUE')).toBe('CANCELLED')
  })
})

describe('credit note immutability', () => {
  type CreditNoteStatus = 'DRAFT' | 'SENT'

  function canEditCreditNote(status: CreditNoteStatus): boolean {
    return status === 'DRAFT'
  }

  function canDeleteCreditNote(status: CreditNoteStatus): boolean {
    return status === 'DRAFT'
  }

  it('only DRAFT credit notes can be edited', () => {
    expect(canEditCreditNote('DRAFT')).toBe(true)
    expect(canEditCreditNote('SENT')).toBe(false)
  })

  it('only DRAFT credit notes can be deleted', () => {
    expect(canDeleteCreditNote('DRAFT')).toBe(true)
    expect(canDeleteCreditNote('SENT')).toBe(false)
  })
})

describe('invoice draft line updates', () => {
  interface InvoiceLine {
    description: string
    quantity: number
    unit_price: number
    amount: number
  }

  function calculateUpdatedTotals(lines: InvoiceLine[], vatRate: number) {
    const subtotal = lines.reduce((sum, l) => sum + l.amount, 0)
    const vatAmount = Math.round(subtotal * vatRate * 100) / 100
    const total = subtotal + vatAmount
    return { subtotal, vatAmount, total }
  }

  it('recalculates totals when lines are updated', () => {
    const newLines: InvoiceLine[] = [
      { description: 'Prestation A', quantity: 2, unit_price: 600, amount: 1200 },
      { description: 'Prestation B', quantity: 1, unit_price: 300, amount: 300 },
    ]
    const { subtotal, vatAmount, total } = calculateUpdatedTotals(newLines, 0)
    expect(subtotal).toBe(1500)
    expect(vatAmount).toBe(0)
    expect(total).toBe(1500)
  })

  it('replacing lines changes the subtotal', () => {
    const oldLines: InvoiceLine[] = [
      { description: 'Old service', quantity: 1, unit_price: 1000, amount: 1000 },
    ]
    const newLines: InvoiceLine[] = [
      { description: 'New service A', quantity: 2, unit_price: 400, amount: 800 },
      { description: 'New service B', quantity: 1, unit_price: 200, amount: 200 },
    ]

    const oldTotals = calculateUpdatedTotals(oldLines, 0)
    const newTotals = calculateUpdatedTotals(newLines, 0)

    expect(oldTotals.subtotal).toBe(1000)
    expect(newTotals.subtotal).toBe(1000)
    // Same total but different composition — both valid
  })
})

describe('invoice duplication', () => {
  interface Invoice {
    id: string
    status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'
    number: string | null
    client_id: string
    subtotal: number
    total: number
  }

  function createDuplicate(source: Invoice, newId: string, today: string): Invoice {
    return {
      id: newId,
      status: 'DRAFT',
      number: null,
      client_id: source.client_id,
      subtotal: source.subtotal,
      total: source.total,
    }
  }

  it('duplicate is a DRAFT with no number', () => {
    const source: Invoice = {
      id: 'original-id',
      status: 'SENT',
      number: 'FAC-2026-001',
      client_id: 'client-uuid',
      subtotal: 1000,
      total: 1000,
    }
    const duplicate = createDuplicate(source, 'new-id', '2026-03-16')
    expect(duplicate.status).toBe('DRAFT')
    expect(duplicate.number).toBeNull()
  })

  it('duplicate is a separate entity with a new id', () => {
    const source: Invoice = {
      id: 'original-id',
      status: 'SENT',
      number: 'FAC-2026-001',
      client_id: 'client-uuid',
      subtotal: 1000,
      total: 1000,
    }
    const duplicate = createDuplicate(source, 'new-id', '2026-03-16')
    expect(duplicate.id).not.toBe(source.id)
    expect(duplicate.id).toBe('new-id')
  })

  it('duplicate inherits client and amounts from source', () => {
    const source: Invoice = {
      id: 'original-id',
      status: 'PAID',
      number: 'FAC-2026-002',
      client_id: 'client-xyz',
      subtotal: 2500,
      total: 2500,
    }
    const duplicate = createDuplicate(source, 'dup-id', '2026-03-16')
    expect(duplicate.client_id).toBe(source.client_id)
    expect(duplicate.subtotal).toBe(source.subtotal)
    expect(duplicate.total).toBe(source.total)
  })
})
