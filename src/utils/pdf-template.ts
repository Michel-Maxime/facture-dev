import { INVOICE_MENTIONS } from '@/lib/constants'
import type { Invoice, InvoiceLine, Client, Profile } from '@/lib/types'
import { formatCurrency, formatDateLong, formatIban } from './formatters'

export interface PdfInvoiceData {
  invoice: Invoice
  lines: InvoiceLine[]
  client: Client
  profile: Profile
}

export function buildInvoiceHtml(data: PdfInvoiceData): string {
  const { invoice, lines, client, profile } = data

  const linesHtml = lines
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(
      (line) => `
      <tr>
        <td>${line.description}</td>
        <td class="right">${line.quantity}</td>
        <td class="right">${formatCurrency(line.unit_price)}</td>
        <td class="right">${formatCurrency(line.amount)}</td>
      </tr>
    `,
    )
    .join('')

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8" />
      <title>Facture ${invoice.number}</title>
      <style>
        body { font-family: 'DM Sans', system-ui, sans-serif; font-size: 14px; color: #111; margin: 0; padding: 40px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .company-name { font-size: 24px; font-weight: 700; color: #7C3AED; }
        .invoice-title { font-size: 32px; font-weight: 700; text-align: right; }
        .invoice-number { color: #7C3AED; font-size: 18px; font-weight: 700; }
        .parties { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .party h3 { font-size: 12px; text-transform: uppercase; color: #666; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #F5F3FF; text-align: left; padding: 10px 12px; font-size: 12px; text-transform: uppercase; color: #666; }
        td { padding: 10px 12px; border-bottom: 1px solid #E5E7EB; }
        .right { text-align: right; }
        .totals { float: right; width: 300px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5E7EB; }
        .total-final { font-size: 18px; font-weight: 700; color: #7C3AED; border-top: 2px solid #7C3AED; padding-top: 12px; }
        .payment-info { margin-top: 40px; font-size: 13px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 16px; }
        .payment-info h4 { font-size: 12px; text-transform: uppercase; color: #666; margin: 0 0 10px 0; }
        .payment-row { display: flex; gap: 24px; flex-wrap: wrap; }
        .payment-field { margin-bottom: 6px; }
        .payment-field label { font-size: 11px; color: #888; display: block; margin-bottom: 2px; }
        .mentions { margin-top: 40px; font-size: 11px; color: #666; border-top: 1px solid #E5E7EB; padding-top: 16px; }
        .mention-item { margin-bottom: 4px; }
      </style>
    </head>
    <body>
      <!-- Mention 1: FACTURE -->
      <div class="header">
        <!-- Mention 5: Seller info -->
        <div>
          <div class="company-name">${profile.first_name} ${profile.last_name}</div>
          <div>${INVOICE_MENTIONS.eiMention}</div>
          <div>SIRET : ${profile.siret}</div>
          ${profile.code_ape ? `<div>Code APE : ${profile.code_ape}</div>` : ''}
          <div>${profile.address}</div>
          <div>${profile.postal_code} ${profile.city}</div>
        </div>
        <div>
          <div class="invoice-title">FACTURE</div>
          <!-- Mention 2: Sequential number -->
          <div class="invoice-number">${invoice.number}</div>
          <!-- Mention 3: Issue date -->
          <div>Date d'émission : ${formatDateLong(invoice.issue_date)}</div>
          <!-- Mention 4: Service date -->
          <div>Date de prestation : ${formatDateLong(invoice.service_date)}</div>
          <div>Échéance : ${formatDateLong(invoice.due_date)}</div>
        </div>
      </div>

      <!-- Mention 6: Client info -->
      <div class="parties">
        <div class="party">
          <h3>Facturé à</h3>
          <strong>${client.name}</strong>
          ${client.siret ? `<div>SIRET : ${client.siret}</div>` : ''}
          <div>${client.address}</div>
          <div>${client.postal_code} ${client.city}</div>
          ${client.email ? `<div>${client.email}</div>` : ''}
        </div>
      </div>

      <!-- Mention 7: Line items -->
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="right">Quantité</th>
            <th class="right">Prix unitaire HT</th>
            <th class="right">Montant HT</th>
          </tr>
        </thead>
        <tbody>${linesHtml}</tbody>
      </table>

      <!-- Mentions 8–9: Totals + TVA -->
      <div class="totals">
        <div class="total-row">
          <span>Sous-total HT</span>
          <span>${formatCurrency(invoice.subtotal)}</span>
        </div>
        ${
          invoice.vat_rate > 0
            ? `
          <div class="total-row">
            <span>TVA (${(invoice.vat_rate * 100).toFixed(0)} %)</span>
            <span>${formatCurrency(invoice.vat_amount)}</span>
          </div>
        `
            : ''
        }
        <div class="total-row total-final">
          <span>Total TTC</span>
          <span>${formatCurrency(invoice.total)}</span>
        </div>
      </div>

      <div style="clear:both"></div>

      <!-- Mentions 10 + 13: Payment terms + IBAN/BIC -->
      <div class="payment-info">
        <h4>Règlement</h4>
        <div class="payment-row">
          <div class="payment-field">
            <label>Mode de règlement</label>
            <strong>${invoice.payment_method}</strong>
          </div>
          <div class="payment-field">
            <label>Délai de paiement</label>
            <strong>${invoice.payment_term_days} jours</strong>
          </div>
          <div class="payment-field">
            <label>Date d'échéance</label>
            <strong>${formatDateLong(invoice.due_date)}</strong>
          </div>
          ${profile.iban ? `
          <div class="payment-field">
            <label>IBAN</label>
            <strong>${formatIban(profile.iban)}</strong>
          </div>
          ${profile.bic ? `
          <div class="payment-field">
            <label>BIC</label>
            <strong>${profile.bic}</strong>
          </div>` : ''}
          ` : ''}
        </div>
      </div>

      <!-- Mandatory legal mentions -->
      <div class="mentions">
        <!-- Mention 9: TVA exemption (franchise) -->
        ${invoice.vat_rate === 0 ? `<div class="mention-item">${INVOICE_MENTIONS.vatExemption}</div>` : ''}
        <!-- Mention 11: Late payment penalties -->
        <div class="mention-item">${INVOICE_MENTIONS.latePaymentRate}</div>
        <!-- Mention 12: B2B recovery indemnity -->
        <div class="mention-item">${INVOICE_MENTIONS.recoveryIndemnity}</div>
        ${invoice.notes ? `<div class="mention-item" style="margin-top:12px">${invoice.notes}</div>` : ''}
      </div>
    </body>
    </html>
  `
}
