import { supabase } from '@/lib/supabase'
import { useNotificationsStore } from '@/stores/notifications'

export function usePdf() {
  const notifications = useNotificationsStore()

  /**
   * Downloads a draft invoice as PDF via the preview-pdf Edge Function.
   * Works for any invoice status (DRAFT or emitted).
   */
  async function downloadDraftPdf(invoiceId: string, filename: string): Promise<boolean> {
    const { data, error } = await supabase.functions.invoke('preview-pdf', {
      body: { invoiceId },
    })

    if (error || !data?.pdf) {
      notifications.error('Erreur', "Impossible de générer l'aperçu PDF")
      return false
    }

    // Decode base64 to blob
    const binary = atob(data.pdf)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return true
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

  return { downloadDraftPdf, downloadStoredPdf }
}
