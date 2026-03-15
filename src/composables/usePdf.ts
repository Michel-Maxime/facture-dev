import { useNotificationsStore } from '@/stores/notifications'
import type { PdfInvoiceData } from '@/utils/pdf-template'
import { buildInvoiceHtml } from '@/utils/pdf-template'

export function usePdf() {
  const notifications = useNotificationsStore()

  function downloadPdf(data: PdfInvoiceData) {
    const html = buildInvoiceHtml(data)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.invoice.number}.html`
    a.click()
    URL.revokeObjectURL(url)
    notifications.success('PDF téléchargé')
  }

  function printInvoice(data: PdfInvoiceData) {
    const html = buildInvoiceHtml(data)
    const win = window.open('', '_blank')
    if (!win) {
      notifications.error('Erreur', 'Impossible d\'ouvrir la fenêtre d\'impression')
      return
    }
    win.document.write(html)
    win.document.close()
    win.print()
  }

  return { downloadPdf, printInvoice }
}
