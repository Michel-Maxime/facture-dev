import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { useAuditLog } from '@/composables/useAuditLog'
import type { Invoice, InvoiceLine } from '@/lib/types'
import type { InvoiceFormData } from '@/utils/validators'

export function useInvoices() {
  const authStore = useAuthStore()
  const notifications = useNotificationsStore()
  const { logAction } = useAuditLog()

  const invoices = ref<Invoice[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchInvoices() {
    if (!authStore.user) return
    loading.value = true
    error.value = null

    // Trigger overdue detection before fetching (scoped to current user)
    try {
      await supabase.rpc('mark_overdue_invoices', { p_user_id: authStore.user.id })
    } catch {
      // Non-critical — continue even if this fails
    }

    const { data, error: err } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })

    if (err) {
      error.value = err.message
      notifications.error('Erreur', 'Impossible de charger les factures')
    } else {
      invoices.value = data ?? []
    }
    loading.value = false
  }

  async function getInvoice(id: string): Promise<{ invoice: Invoice; lines: InvoiceLine[] } | null> {
    const [invoiceRes, linesRes] = await Promise.all([
      supabase.from('invoices').select('*').eq('id', id).single(),
      supabase.from('invoice_lines').select('*').eq('invoice_id', id).order('sort_order'),
    ])

    if (invoiceRes.error || !invoiceRes.data) {
      notifications.error('Erreur', 'Facture introuvable')
      return null
    }

    return { invoice: invoiceRes.data, lines: linesRes.data ?? [] }
  }

  async function createInvoice(formData: InvoiceFormData): Promise<Invoice | null> {
    if (!authStore.user) return null

    const subtotal = formData.lines.reduce((sum, l) => sum + l.amount, 0)
    const vatAmount = subtotal * formData.vat_rate
    const total = subtotal + vatAmount

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        user_id: authStore.user.id,
        client_id: formData.client_id,
        issue_date: formData.issue_date,
        service_date: formData.service_date,
        due_date: formData.due_date,
        payment_term_days: formData.payment_term_days,
        payment_method: formData.payment_method,
        vat_rate: formData.vat_rate,
        vat_amount: vatAmount,
        subtotal,
        total,
        notes: formData.notes || null,
        status: 'DRAFT',
      })
      .select()
      .single()

    if (invErr || !invoice) {
      notifications.error('Erreur', 'Impossible de créer la facture')
      return null
    }

    const lines = formData.lines.map((l, i) => ({
      invoice_id: invoice.id,
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unit_price,
      amount: l.amount,
      sort_order: i,
    }))

    const { error: linesErr } = await supabase.from('invoice_lines').insert(lines)

    if (linesErr) {
      notifications.error('Erreur', 'Impossible de créer les lignes de facture')
      return null
    }

    invoices.value.unshift(invoice)
    notifications.success('Facture créée', 'Brouillon enregistré')
    await logAction('CREATE_INVOICE', 'invoices', invoice.id)
    return invoice
  }

  async function updateInvoice(id: string, updates: Partial<InvoiceFormData>): Promise<Invoice | null> {
    const existing = invoices.value.find((i) => i.id === id)
    if (existing && existing.status !== 'DRAFT') {
      notifications.error('Erreur', 'Seuls les brouillons peuvent être modifiés')
      return null
    }

    const { data, error: err } = await supabase
      .from('invoices')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (err) {
      notifications.error('Erreur', 'Impossible de mettre à jour la facture')
      return null
    }

    const idx = invoices.value.findIndex((i) => i.id === id)
    if (idx !== -1) invoices.value[idx] = data

    notifications.success('Facture mise à jour')
    await logAction('UPDATE_INVOICE', 'invoices', id)
    return data
  }

  async function deleteInvoice(id: string): Promise<boolean> {
    const existing = invoices.value.find((i) => i.id === id)
    if (existing && existing.status !== 'DRAFT') {
      notifications.error('Erreur', 'Seuls les brouillons peuvent être supprimés')
      return false
    }

    const { error: err, count } = await supabase
      .from('invoices')
      .delete({ count: 'exact' })
      .eq('id', id)

    if (err || count === 0) {
      notifications.error('Erreur', 'Impossible de supprimer la facture')
      return false
    }

    invoices.value = invoices.value.filter((i) => i.id !== id)
    notifications.success('Facture supprimée')
    await logAction('DELETE_INVOICE', 'invoices', id)
    return true
  }

  async function emitInvoice(id: string): Promise<{ invoiceNumber: string } | null> {
    const { data, error } = await supabase.functions.invoke('generate-invoice-number', {
      body: { invoiceId: id },
    })

    if (error) {
      notifications.error('Erreur', error.message ?? "Impossible d'émettre la facture")
      return null
    }

    const idx = invoices.value.findIndex((i) => i.id === id)
    if (idx !== -1) invoices.value[idx] = data.invoice

    notifications.success('Facture émise', `Numéro ${data.invoiceNumber} attribué`)
    return { invoiceNumber: data.invoiceNumber }
  }

  async function cancelInvoice(id: string): Promise<boolean> {
    const existing = invoices.value.find((i) => i.id === id)
    if (existing && (existing.status === 'PAID' || existing.status === 'CANCELLED')) {
      notifications.error('Erreur', 'Cette facture ne peut pas être annulée')
      return false
    }

    const { data: updated, error: err } = await supabase
      .from('invoices')
      .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (err || !updated) {
      notifications.error('Erreur', "Impossible d'annuler la facture")
      return false
    }

    const idx = invoices.value.findIndex((i) => i.id === id)
    if (idx !== -1) invoices.value[idx] = updated

    notifications.success('Facture annulée')
    await logAction('CANCEL_INVOICE', 'invoices', id)
    return true
  }

  async function sendInvoiceEmail(id: string, recipientEmail?: string): Promise<boolean> {
    const { data, error } = await supabase.functions.invoke('send-invoice-email', {
      body: { invoiceId: id, recipientEmail },
    })

    if (error) {
      notifications.error('Erreur', error.message ?? "Impossible d'envoyer l'email")
      return false
    }

    notifications.success('Email envoyé', `Facture transmise par email`)
    return true
  }

  return { invoices, loading, error, fetchInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice, emitInvoice, cancelInvoice, sendInvoiceEmail }
}
