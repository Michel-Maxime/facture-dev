import { describe, it, expect } from 'vitest'
import { clientSchema, loginSchema, registerSchema, invoiceSchema } from '@/utils/validators'

describe('clientSchema', () => {
  const validClient = {
    name: 'Acme Corp',
    type: 'PROFESSIONAL' as const,
    address: '1 rue de la Paix',
    city: 'Paris',
    postal_code: '75001',
  }

  it('validates a valid client', () => {
    const result = clientSchema.safeParse(validClient)
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = clientSchema.safeParse({ ...validClient, name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid postal code', () => {
    const result = clientSchema.safeParse({ ...validClient, postal_code: '7500' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid SIRET', () => {
    const result = clientSchema.safeParse({ ...validClient, siret: '123' })
    expect(result.success).toBe(false)
  })

  it('accepts valid SIRET', () => {
    const result = clientSchema.safeParse({ ...validClient, siret: '12345678901234' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = clientSchema.safeParse({ ...validClient, email: 'notanemail' })
    expect(result.success).toBe(false)
  })

  it('accepts empty email', () => {
    const result = clientSchema.safeParse({ ...validClient, email: '' })
    expect(result.success).toBe(true)
  })
})

describe('loginSchema', () => {
  it('validates valid credentials', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: 'password123' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'invalid', password: 'password123' })
    expect(result.success).toBe(false)
  })

  it('rejects short password', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: '123' })
    expect(result.success).toBe(false)
  })
})

describe('registerSchema', () => {
  const validRegister = {
    email: 'user@example.com',
    password: 'password123',
    confirmPassword: 'password123',
    first_name: 'Jean',
    last_name: 'Dupont',
    siret: '12345678901234',
    address: '1 rue Test',
    city: 'Paris',
    postal_code: '75001',
    company_created_at: '2024-01-01',
  }

  it('validates valid registration data', () => {
    const result = registerSchema.safeParse(validRegister)
    expect(result.success).toBe(true)
  })

  it('rejects mismatched passwords', () => {
    const result = registerSchema.safeParse({ ...validRegister, confirmPassword: 'different' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid SIRET', () => {
    const result = registerSchema.safeParse({ ...validRegister, siret: 'invalid' })
    expect(result.success).toBe(false)
  })
})

describe('invoiceSchema', () => {
  const validLine = {
    description: 'Développement web',
    quantity: 1,
    unit_price: 1000,
    amount: 1000,
    sort_order: 0,
  }

  const validInvoice = {
    client_id: '550e8400-e29b-41d4-a716-446655440000',
    issue_date: '2026-03-15',
    service_date: '2026-03-15',
    due_date: '2026-04-15',
    payment_term_days: 30,
    payment_method: 'Virement bancaire',
    vat_rate: 0,
    lines: [validLine],
  }

  it('validates a valid invoice', () => {
    const result = invoiceSchema.safeParse(validInvoice)
    expect(result.success).toBe(true)
  })

  it('rejects invoice with no lines', () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, lines: [] })
    expect(result.success).toBe(false)
  })

  it('rejects invalid client_id', () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, client_id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})
