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
        .invoice-number { color: #7C3AED; }
        .parties { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .party h3 { font-size: 12px; text-transform: uppercase; color: #666; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #F5F3FF; text-align: left; padding: 10px 12px; font-size: 12px; text-transform: uppercase; color: #666; }
        td { padding: 10px 12px; border-bottom: 1px solid #E5E7EB; }
        .right { text-align: right; }
        .totals { float: right; width: 300px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5E7EB; }
        .total-final { font-size: 18px; font-weight: 700; color: #7C3AED; border-top: 2px solid #7C3AED; padding-top: 12px; }
        .mentions { margin-top: 60px; font-size: 11px; color: #666; border-top: 1px solid #E5E7EB; padding-top: 16px; }
        .mention-item { margin-bottom: 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="company-name">${profile.first_name} ${profile.last_name}</div>
          <div>${INVOICE_MENTIONS.eiMention}</div>
          <div>SIRET : ${profile.siret}</div>
          <div>${profile.address}</div>
          <div>${profile.postal_code} ${profile.city}</div>
        </div>
        <div>
          <div class="invoice-title">FACTURE</div>
          <div class="invoice-number">${invoice.number}</div>
          <div>Date : ${formatDateLong(invoice.issue_date)}</div>
          <div>Prestation : ${formatDateLong(invoice.service_date)}</div>
          <div>Échéance : ${formatDateLong(invoice.due_date)}</div>
        </div>
      </div>

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

      ${
        profile.iban
          ? `
        <div style="margin-top: 40px;">
          <strong>Coordonnées bancaires</strong>
          <div>IBAN : ${formatIban(profile.iban)}</div>
          ${profile.bic ? `<div>BIC : ${profile.bic}</div>` : ''}
          <div>Mode de règlement : ${invoice.payment_method}</div>
        </div>
      `
          : ''
      }

      <div class="mentions">
        ${invoice.vat_rate === 0 ? `<div class="mention-item">${INVOICE_MENTIONS.vatExemption}</div>` : ''}
        <div class="mention-item">${INVOICE_MENTIONS.recoveryIndemnity}</div>
        <div class="mention-item">${INVOICE_MENTIONS.latePaymentRate}</div>
        ${invoice.notes ? `<div class="mention-item" style="margin-top:12px">${invoice.notes}</div>` : ''}
      </div>
    </body>
    </html>
  `
}
