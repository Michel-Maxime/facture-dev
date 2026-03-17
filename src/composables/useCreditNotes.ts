import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { useAuditLog } from '@/composables/useAuditLog'
import type { CreditNote, CreditNoteLine, Invoice, InvoiceLine } from '@/lib/types'

export function useCreditNotes() {
  const authStore = useAuthStore()
  const notifications = useNotificationsStore()
  const { logAction } = useAuditLog()

  const creditNotes = ref<CreditNote[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchCreditNotes() {
    if (!authStore.user) return
    loading.value = true
    error.value = null

    const { data, error: err } = await supabase
      .from('credit_notes')
      .select('*')
      .order('created_at', { ascending: false })

    if (err) {
      error.value = err.message
      notifications.error('Erreur', 'Impossible de charger les avoirs')
    } else {
      creditNotes.value = data ?? []
    }
    loading.value = false
  }

  async function getCreditNote(id: string): Promise<{ creditNote: CreditNote; lines: CreditNoteLine[] } | null> {
    const [cnRes, linesRes] = await Promise.all([
      supabase.from('credit_notes').select('*').eq('id', id).single(),
      supabase.from('credit_note_lines').select('*').eq('credit_note_id', id).order('sort_order'),
    ])

    if (cnRes.error || !cnRes.data) {
      notifications.error('Erreur', 'Avoir introuvable')
      return null
    }

    return { creditNote: cnRes.data, lines: linesRes.data ?? [] }
  }

  /**
   * Creates a DRAFT credit note pre-filled from the original invoice (amounts negated).
   */
  async function createCreditNote(originalInvoiceId: string): Promise<CreditNote | null> {
    if (!authStore.user) return null

    // Fetch original invoice and its lines
    const [invoiceRes, linesRes] = await Promise.all([
      supabase.from('invoices').select('*').eq('id', originalInvoiceId).single(),
      supabase.from('invoice_lines').select('*').eq('invoice_id', originalInvoiceId).order('sort_order'),
    ])

    if (invoiceRes.error || !invoiceRes.data) {
      notifications.error('Erreur', 'Facture originale introuvable')
      return null
    }

    const invoice: Invoice = invoiceRes.data
    const invoiceLines: InvoiceLine[] = linesRes.data ?? []

    // Negate amounts
    const subtotal = -Math.abs(invoice.subtotal)
    const vatAmount = -Math.abs(invoice.vat_amount)
    const total = -Math.abs(invoice.total)

    const today = new Date().toISOString().slice(0, 10)

    const { data: creditNote, error: cnErr } = await supabase
      .from('credit_notes')
      .insert({
        user_id: authStore.user.id,
        original_invoice_id: originalInvoiceId,
        issue_date: today,
        subtotal,
        vat_rate: invoice.vat_rate,
        vat_amount: vatAmount,
        total,
        status: 'DRAFT',
      })
      .select()
      .single()

    if (cnErr || !creditNote) {
      notifications.error('Erreur', "Impossible de créer l'avoir")
      return null
    }

    // Insert negated lines
    const lines = invoiceLines.map((l, i) => ({
      credit_note_id: creditNote.id,
      description: l.description,
      quantity: l.quantity,
      unit_price: -Math.abs(l.unit_price),
      amount: -Math.abs(l.amount),
      sort_order: i,
    }))

    if (lines.length > 0) {
      const { error: linesErr } = await supabase.from('credit_note_lines').insert(lines)
      if (linesErr) {
        notifications.error('Erreur', "Impossible de créer les lignes de l'avoir")
        return null
      }
    }

    creditNotes.value.unshift(creditNote)
    notifications.success('Avoir créé', 'Brouillon enregistré')
    await logAction('CREATE_CREDIT_NOTE', 'credit_notes', creditNote.id)
    return creditNote
  }

  /**
   * Emits a DRAFT credit note: assigns AV-YEAR-SEQ number, marks original invoice as CANCELLED.
   */
  async function emitCreditNote(id: string): Promise<{ creditNoteNumber: string } | null> {
    if (!authStore.user) return null

    const year = new Date().getFullYear()

    const { data: numData, error: rpcErr } = await supabase.rpc('generate_credit_note_number', {
      p_user_id: authStore.user.id,
      p_year: year,
    })

    if (rpcErr || !numData || numData.length === 0) {
      notifications.error('Erreur', "Impossible de générer le numéro d'avoir")
      return null
    }

    const { credit_note_number } = numData[0]

    const { data: updated, error: updateErr } = await supabase
      .from('credit_notes')
      .update({
        number: credit_note_number,
        status: 'SENT',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateErr || !updated) {
      notifications.error('Erreur', "Impossible d'émettre l'avoir")
      return null
    }

    // Mark the original invoice as CANCELLED
    const { error: cancelErr } = await supabase
      .from('invoices')
      .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
      .eq('id', updated.original_invoice_id)

    if (cancelErr) {
      notifications.error('Attention', 'Avoir émis mais la facture originale n\'a pas pu être annulée')
    }

    const idx = creditNotes.value.findIndex((cn) => cn.id === id)
    if (idx !== -1) creditNotes.value[idx] = updated

    notifications.success('Avoir émis', `Numéro ${credit_note_number} attribué`)
    await logAction('EMIT_CREDIT_NOTE', 'credit_notes', id)
    await logAction('CANCEL_INVOICE', 'invoices', updated.original_invoice_id)

    return { creditNoteNumber: credit_note_number }
  }

  async function deleteCreditNote(id: string): Promise<boolean> {
    const existing = creditNotes.value.find((cn) => cn.id === id)
    if (existing && existing.status !== 'DRAFT') {
      notifications.error('Erreur', 'Seuls les brouillons peuvent être supprimés')
      return false
    }

    const { error: err } = await supabase.from('credit_notes').delete().eq('id', id)

    if (err) {
      notifications.error('Erreur', "Impossible de supprimer l'avoir")
      return false
    }

    creditNotes.value = creditNotes.value.filter((cn) => cn.id !== id)
    notifications.success('Avoir supprimé')
    await logAction('DELETE_CREDIT_NOTE', 'credit_notes', id)
    return true
  }

  return {
    creditNotes,
    loading,
    error,
    fetchCreditNotes,
    getCreditNote,
    createCreditNote,
    emitCreditNote,
    deleteCreditNote,
  }
}
