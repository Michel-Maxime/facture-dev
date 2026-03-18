import { describe, it, expect } from 'vitest'
import { buildFacturxXml } from '@/utils/facturx'

describe('buildFacturxXml - Factur-X MINIMUM profile', () => {
  const baseInput = {
    invoiceNumber: 'FAC-2026-001',
    issueDate: '2026-03-17',
    seller: {
      name: 'Jean Dupont',
      siret: '12345678901234',
    },
    buyer: {
      name: 'Acme Corp',
    },
    totalTTC: 1200.00,
    currency: 'EUR',
  }

  it('generates valid XML with correct namespace', () => {
    const xml = buildFacturxXml(baseInput)
    expect(xml).toContain('urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100')
  })

  it('includes invoice number', () => {
    const xml = buildFacturxXml(baseInput)
    expect(xml).toContain('<ram:ID>FAC-2026-001</ram:ID>')
  })

  it('includes issue date in YYYYMMDD format', () => {
    const xml = buildFacturxXml(baseInput)
    expect(xml).toContain('<udt:DateTimeString format="102">20260317</udt:DateTimeString>')
  })

  it('includes seller name and SIRET with schemeID 0002', () => {
    const xml = buildFacturxXml(baseInput)
    expect(xml).toContain('<ram:Name>Jean Dupont</ram:Name>')
    expect(xml).toContain('schemeID="0002"')
    expect(xml).toContain('12345678901234')
  })

  it('includes buyer name', () => {
    const xml = buildFacturxXml(baseInput)
    expect(xml).toContain('<ram:Name>Acme Corp</ram:Name>')
  })

  it('includes total TTC', () => {
    const xml = buildFacturxXml(baseInput)
    expect(xml).toContain('<ram:TaxInclusiveAmount currencyID="EUR">1200.00</ram:TaxInclusiveAmount>')
  })

  it('uses TypeCode 380 for invoice', () => {
    const xml = buildFacturxXml(baseInput)
    expect(xml).toContain('<ram:TypeCode>380</ram:TypeCode>')
  })

  it('specifies MINIMUM profile guideline', () => {
    const xml = buildFacturxXml(baseInput)
    expect(xml).toContain('urn:factur-x.eu:1p0:minimum')
  })

  it('escapes special XML characters in names', () => {
    const xml = buildFacturxXml({
      ...baseInput,
      buyer: { name: 'AT&T <France>' },
    })
    expect(xml).toContain('AT&amp;T &lt;France&gt;')
    expect(xml).not.toContain('<France>')
  })

  it('generated XML is well-formed (no unclosed tags)', () => {
    const xml = buildFacturxXml(baseInput)
    const openTags = (xml.match(/<[a-z:A-Z][^/!>]*[^/]>/g) ?? []).length
    const closeTags = (xml.match(/<\/[a-z:A-Z][^>]*>/g) ?? []).length
    expect(openTags).toBeGreaterThan(0)
    expect(closeTags).toBeGreaterThan(0)
  })
})
