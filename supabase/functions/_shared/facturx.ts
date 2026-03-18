/**
 * Factur-X MINIMUM profile XML generator.
 * Conforms to EN 16931 / FNFE-MPE Factur-X 1.0 MINIMUM profile.
 *
 * The MINIMUM profile contains the legally required minimum fields
 * for a Cross-Industry Invoice (CII) document.
 */

export interface FacturxInput {
  invoiceNumber: string
  issueDate: string       // ISO 8601: YYYY-MM-DD
  seller: {
    name: string
    siret: string         // 14 digits, SchemeID=0002 (SIRET)
  }
  buyer: {
    name: string
  }
  totalTTC: number
  currency: string        // ISO 4217, e.g. 'EUR'
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function isoToYYYYMMDD(iso: string): string {
  return iso.replace(/-/g, '')
}

/**
 * Builds a Factur-X MINIMUM profile XML string.
 * The returned string is UTF-8 encoded XML.
 */
export function buildFacturxXml(input: FacturxInput): string {
  const { invoiceNumber, issueDate, seller, buyer, totalTTC, currency } = input
  const issueDateFormatted = isoToYYYYMMDD(issueDate)
  const totalFormatted = totalTTC.toFixed(2)

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">

  <!-- ── Context: Factur-X MINIMUM profile ───────────────────────── -->
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:minimum</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <!-- ── Document header ──────────────────────────────────────────── -->
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(invoiceNumber)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${issueDateFormatted}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>

  <!-- ── Trade transaction ────────────────────────────────────────── -->
  <rsm:SupplyChainTradeTransaction>

    <!-- Seller -->
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(seller.name)}</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${escapeXml(seller.siret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>
      </ram:SellerTradeParty>

      <!-- Buyer -->
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(buyer.name)}</ram:Name>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery />

    <!-- Settlement / totals -->
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${escapeXml(currency)}</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:TaxInclusiveAmount currencyID="${escapeXml(currency)}">${totalFormatted}</ram:TaxInclusiveAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>

  </rsm:SupplyChainTradeTransaction>

</rsm:CrossIndustryInvoice>`
}
