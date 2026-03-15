import { useNotificationsStore } from '@/stores/notifications'
import type { PdfInvoiceData } from '@/utils/pdf-template'
import { buildInvoiceHtml } from '@/utils/pdf-template'

export function usePdf() {
  const notifications = useNotificationsStore()

  function downloadPdf(data: PdfInvoiceData) {
    const html = buildInvoiceHtml(data)
    const win = window.open('', '_blank')
    if (!win) {
      notifications.error('Erreur', "Impossible d'ouvrir la fenêtre d'impression")
      return
    }
    win.document.write(html)
    win.document.close()
    win.addEventListener('load', () => {
      win.print()
    })
    notifications.success('PDF', 'Utilisez "Enregistrer en PDF" dans la boîte de dialogue')
  }

  function printInvoice(data: PdfInvoiceData) {
    const html = buildInvoiceHtml(data)
    const win = window.open('', '_blank')
    if (!win) {
      notifications.error('Erreur', "Impossible d'ouvrir la fenêtre d'impression")
      return
    }
    win.document.write(html)
    win.document.close()
    win.addEventListener('load', () => win.print())
  }

  return { downloadPdf, printInvoice }
}
