import { supabase } from '@/lib/supabase'
import { useNotificationsStore } from '@/stores/notifications'
import type { PdfInvoiceData } from '@/utils/pdf-template'
import { buildInvoiceHtml } from '@/utils/pdf-template'

export function usePdf() {
  const notifications = useNotificationsStore()

  function openHtmlInWindow(html: string): Window | null {
    const win = window.open('', '_blank')
    if (!win) return null
    const doc = win.document
    doc.open()
    doc.write(html)
    doc.close()
    return win
  }

  function downloadPdf(data: PdfInvoiceData) {
    const html = buildInvoiceHtml(data)
    const win = openHtmlInWindow(html)
    if (!win) {
      notifications.error('Erreur', "Impossible d'ouvrir la fenêtre d'impression")
      return
    }
    win.addEventListener('load', () => {
      win.print()
    })
    notifications.success('PDF', 'Utilisez "Enregistrer en PDF" dans la boîte de dialogue')
  }

  function printInvoice(data: PdfInvoiceData) {
    const html = buildInvoiceHtml(data)
    const win = openHtmlInWindow(html)
    if (!win) {
      notifications.error('Erreur', "Impossible d'ouvrir la fenêtre d'impression")
      return
    }
    win.addEventListener('load', () => win.print())
  }

  async function downloadStoredPdf(pdfUrl: string, invoiceNumber: string): Promise<boolean> {
    const { data, error } = await supabase.storage
      .from('invoices')
      .download(pdfUrl)

    if (error || !data) {
      notifications.error('Erreur', 'Impossible de télécharger le PDF')
      return false
    }

    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoiceNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return true
  }

  return { downloadPdf, printInvoice, downloadStoredPdf }
}
