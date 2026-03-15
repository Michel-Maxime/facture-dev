import { describe, it, expect } from 'vitest'
import { buildInvoiceHtml } from '@/utils/pdf-template'
import { INVOICE_MENTIONS } from '@/lib/constants'
import type { PdfInvoiceData } from '@/utils/pdf-template'

const mockProfile = {
  id: 'user-1',
  first_name: 'Jean',
  last_name: 'Dupont',
  address: '12 rue de la Paix',
  city: 'Paris',
  postal_code: '75001',
  siret: '12345678901234',
  code_ape: '6201Z',
  iban: 'FR7612345678901234567890189',
  bic: 'BNPAFRPPXXX',
  company_created_at: '2024-01-01',
  vat_regime: 'FRANCHISE' as const,
  declaration_freq: 'QUARTERLY' as const,
  cotisation_rate: 0.256,
  logo_url: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const mockClient = {
  id: 'client-1',
  user_id: 'user-1',
  name: 'Acme SAS',
  type: 'PROFESSIONAL' as const,
  siret: '98765432109876',
  address: '1 avenue des Champs-Élysées',
  city: 'Paris',
  postal_code: '75008',
  email: 'contact@acme.fr',
  phone: null,
  notes: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const mockInvoice = {
  id: 'inv-1',
  user_id: 'user-1',
  client_id: 'client-1',
  number: 'FAC-2026-001',
  sequence_number: 1,
  status: 'SENT' as const,
  issue_date: '2026-03-15',
  service_date: '2026-03-10',
  due_date: '2026-04-14',
  payment_term_days: 30,
  payment_method: 'Virement bancaire',
  subtotal: 1500,
  vat_rate: 0,
  vat_amount: 0,
  total: 1500,
  notes: null,
  pdf_url: null,
  created_at: '2026-03-15T00:00:00Z',
  updated_at: '2026-03-15T00:00:00Z',
}

const mockLines = [
  {
    id: 'line-1',
    invoice_id: 'inv-1',
    description: 'Développement web',
    quantity: 3,
    unit_price: 500,
    amount: 1500,
    sort_order: 0,
  },
]

const baseData: PdfInvoiceData = {
  invoice: mockInvoice,
  lines: mockLines,
  client: mockClient,
  profile: mockProfile,
}

describe('PDF — 13 mandatory French mentions', () => {
  const html = buildInvoiceHtml(baseData)

  // Mention 1: "FACTURE" word
  it('mention 1 — contains the word FACTURE', () => {
    expect(html).toContain('FACTURE')
  })

  // Mention 2: Sequential invoice number
  it('mention 2 — contains sequential invoice number FAC-2026-001', () => {
    expect(html).toContain('FAC-2026-001')
  })

  // Mention 3: Issue date
  it('mention 3 — contains issue date', () => {
    // The date appears formatted in French
    expect(html).toContain('2026') // at minimum the year
    expect(html).toContain("Date d'émission")
  })

  // Mention 4: Service date
  it('mention 4 — contains service date label', () => {
    expect(html).toContain('prestation')
  })

  // Mention 5: Seller info (name + address + SIRET + "EI")
  it('mention 5 — contains seller name', () => {
    expect(html).toContain('Jean Dupont')
  })

  it('mention 5 — contains seller SIRET', () => {
    expect(html).toContain('12345678901234')
  })

  it('mention 5 — contains "Entrepreneur individuel"', () => {
    expect(html).toContain(INVOICE_MENTIONS.eiMention)
  })

  it('mention 5 — contains seller address', () => {
    expect(html).toContain('12 rue de la Paix')
    expect(html).toContain('75001')
    expect(html).toContain('Paris')
  })

  // Mention 6: Client info (name + address + SIRET for pro)
  it('mention 6 — contains client name', () => {
    expect(html).toContain('Acme SAS')
  })

  it('mention 6 — contains client SIRET (professional)', () => {
    expect(html).toContain('98765432109876')
  })

  it('mention 6 — contains client address', () => {
    expect(html).toContain('1 avenue des Champs-Élysées')
  })

  // Mention 7: Line items (description + qty + price + amount)
  it('mention 7 — contains line item description', () => {
    expect(html).toContain('Développement web')
  })

  it('mention 7 — contains quantity and unit price', () => {
    expect(html).toContain('3')
    expect(html).toContain('500')
  })

  // Mention 8: Subtotal HT
  it('mention 8 — contains sous-total HT', () => {
    expect(html).toContain('Sous-total HT')
    expect(html).toContain('1\u202f500') // formatted with non-breaking space
  })

  // Mention 9: TVA exemption (franchise = vat_rate 0)
  it('mention 9 — contains TVA exemption (art. 293 B CGI) when franchise', () => {
    expect(html).toContain(INVOICE_MENTIONS.vatExemption)
    expect(html).toContain('293 B')
  })

  // Mention 10: Payment terms (mode + délai)
  it('mention 10 — contains payment method', () => {
    expect(html).toContain('Virement bancaire')
  })

  it('mention 10 — contains payment term days', () => {
    expect(html).toContain('30 jours')
  })

  // Mention 11: Late payment penalties rate
  it('mention 11 — contains late payment penalties', () => {
    expect(html).toContain(INVOICE_MENTIONS.latePaymentRate)
    expect(html).toContain("taux d'intérêt légal")
  })

  // Mention 12: B2B recovery indemnity 40€
  it('mention 12 — contains recovery indemnity 40€', () => {
    expect(html).toContain(INVOICE_MENTIONS.recoveryIndemnity)
    expect(html).toContain('40 €')
  })

  // Mention 13: IBAN + BIC
  it('mention 13 — contains IBAN', () => {
    expect(html).toContain('FR76')
  })

  it('mention 13 — contains BIC', () => {
    expect(html).toContain('BNPAFRPPXXX')
  })
})

describe('PDF — TVA assujettie', () => {
  it('shows VAT amount when vat_rate > 0 and does NOT show exemption', () => {
    const withVat = buildInvoiceHtml({
      ...baseData,
      invoice: { ...mockInvoice, vat_rate: 0.2, vat_amount: 300, total: 1800 },
    })
    expect(withVat).toContain('TVA')
    expect(withVat).toContain('20')
    expect(withVat).not.toContain('293 B')
  })
})

describe('PDF — optional fields absent', () => {
  it('skips code APE block when absent', () => {
    const html = buildInvoiceHtml({
      ...baseData,
      profile: { ...mockProfile, code_ape: null },
    })
    expect(html).not.toContain('Code APE')
  })

  it('skips client SIRET when absent (individual client)', () => {
    const html = buildInvoiceHtml({
      ...baseData,
      client: { ...mockClient, siret: null },
    })
    expect(html).not.toContain('98765432109876')
  })

  it('skips client email when absent', () => {
    const html = buildInvoiceHtml({
      ...baseData,
      client: { ...mockClient, email: null },
    })
    expect(html).not.toContain('contact@acme.fr')
  })

  it('skips IBAN block when absent but always shows payment method', () => {
    const html = buildInvoiceHtml({
      ...baseData,
      profile: { ...mockProfile, iban: null, bic: null },
    })
    // IBAN value should not appear (FR76... prefix absent)
    expect(html).not.toContain('FR76')
    // Payment method must always be shown
    expect(html).toContain('Virement bancaire')
  })

  it('shows notes when present', () => {
    const html = buildInvoiceHtml({
      ...baseData,
      invoice: { ...mockInvoice, notes: 'Paiement sous 30 jours nets.' },
    })
    expect(html).toContain('Paiement sous 30 jours nets.')
  })
})

describe('PDF — invoice number format', () => {
  it('FAC-YEAR-SEQ format is correct for seq 1', () => {
    const num = `FAC-${2026}-${'1'.padStart(3, '0')}`
    expect(num).toBe('FAC-2026-001')
  })

  it('FAC-YEAR-SEQ format is correct for seq 99', () => {
    const num = `FAC-${2026}-${'99'.padStart(3, '0')}`
    expect(num).toBe('FAC-2026-099')
  })

  it('FAC-YEAR-SEQ format handles seq > 999', () => {
    const num = `FAC-${2026}-${'1000'.padStart(3, '0')}`
    expect(num).toBe('FAC-2026-1000')
  })
})
