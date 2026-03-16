import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { useAuditLog } from '@/composables/useAuditLog'
import type { Quote, QuoteLine } from '@/lib/types'
import type { QuoteFormData } from '@/utils/validators'

export function useQuotes() {
  const authStore = useAuthStore()
  const notifications = useNotificationsStore()
  const { logAction } = useAuditLog()

  const quotes = ref<Quote[]>([])
  const loading = ref(false)

  async function fetchQuotes() {
    if (!authStore.user) return
    loading.value = true

    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      notifications.error('Erreur', 'Impossible de charger les devis')
    } else {
      quotes.value = data ?? []
    }
    loading.value = false
  }

  async function createQuote(formData: QuoteFormData): Promise<Quote | null> {
    if (!authStore.user) return null

    const subtotal = formData.lines.reduce((sum, l) => sum + l.amount, 0)

    const { data: quote, error: quoteErr } = await supabase
      .from('quotes')
      .insert({
        user_id: authStore.user.id,
        client_id: formData.client_id,
        issue_date: formData.issue_date,
        valid_until: formData.valid_until,
        subtotal,
        notes: formData.notes || null,
        status: 'DRAFT',
      })
      .select()
      .single()

    if (quoteErr || !quote) {
      notifications.error('Erreur', 'Impossible de créer le devis')
      return null
    }

    const lines = formData.lines.map((l, i) => ({
      quote_id: quote.id,
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unit_price,
      amount: l.amount,
      sort_order: i,
    }))

    const { error: linesErr } = await supabase.from('quote_lines').insert(lines)

    if (linesErr) {
      notifications.error('Erreur', 'Impossible de créer les lignes du devis')
      return null
    }

    quotes.value.unshift(quote)
    notifications.success('Devis créé', 'Brouillon enregistré')
    await logAction('CREATE_QUOTE', 'quotes', quote.id)
    return quote
  }

  async function updateQuote(id: string, updates: Partial<QuoteFormData>): Promise<Quote | null> {
    const existing = quotes.value.find((q) => q.id === id)
    if (existing && existing.status !== 'DRAFT') {
      notifications.error('Erreur', 'Seuls les brouillons peuvent être modifiés')
      return null
    }

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (updates.client_id !== undefined) payload.client_id = updates.client_id
    if (updates.issue_date !== undefined) payload.issue_date = updates.issue_date
    if (updates.valid_until !== undefined) payload.valid_until = updates.valid_until
    if (updates.notes !== undefined) payload.notes = updates.notes || null
    if (updates.lines !== undefined) {
      payload.subtotal = updates.lines.reduce((sum, l) => sum + l.amount, 0)
    }

    const { data, error: err } = await supabase
      .from('quotes')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (err) {
      notifications.error('Erreur', 'Impossible de mettre à jour le devis')
      return null
    }

    // Replace lines if provided
    if (updates.lines) {
      await supabase.from('quote_lines').delete().eq('quote_id', id)

      const newLines = updates.lines.map((l, i) => ({
        quote_id: id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        amount: l.amount,
        sort_order: i,
      }))
      await supabase.from('quote_lines').insert(newLines)
    }

    const idx = quotes.value.findIndex((q) => q.id === id)
    if (idx !== -1) quotes.value[idx] = data

    notifications.success('Devis mis à jour')
    await logAction('UPDATE_QUOTE', 'quotes', id)
    return data
  }

  async function deleteQuote(id: string): Promise<boolean> {
    const existing = quotes.value.find((q) => q.id === id)
    if (existing && existing.status !== 'DRAFT') {
      notifications.error('Erreur', 'Seuls les brouillons peuvent être supprimés')
      return false
    }

    const { error: err } = await supabase.from('quotes').delete().eq('id', id)

    if (err) {
      notifications.error('Erreur', 'Impossible de supprimer le devis')
      return false
    }

    quotes.value = quotes.value.filter((q) => q.id !== id)
    notifications.success('Devis supprimé')
    await logAction('DELETE_QUOTE', 'quotes', id)
    return true
  }

  async function emitQuote(id: string): Promise<boolean> {
    if (!authStore.user) return false

    const year = new Date().getFullYear()

    const { data, error: rpcErr } = await supabase.rpc('generate_quote_number', {
      p_user_id: authStore.user.id,
      p_year: year,
    })

    if (rpcErr || !data || data.length === 0) {
      notifications.error('Erreur', "Impossible de générer le numéro de devis")
      return false
    }

    const { quote_number, seq_number } = data[0]

    const { data: updated, error: updateErr } = await supabase
      .from('quotes')
      .update({
        number: quote_number,
        status: 'SENT',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) {
      notifications.error('Erreur', "Impossible d'émettre le devis")
      return false
    }

    const idx = quotes.value.findIndex((q) => q.id === id)
    if (idx !== -1) quotes.value[idx] = updated

    notifications.success('Devis émis', `Numéro ${quote_number} attribué`)
    await logAction('EMIT_QUOTE', 'quotes', id)

    // seq_number is used in the RPC return but we only need quote_number for display
    void seq_number

    return true
  }

  async function fetchQuoteWithLines(quoteId: string): Promise<{ quote: Quote; lines: QuoteLine[] } | null> {
    const [quoteRes, linesRes] = await Promise.all([
      supabase.from('quotes').select('*').eq('id', quoteId).single(),
      supabase.from('quote_lines').select('*').eq('quote_id', quoteId).order('sort_order'),
    ])

    if (quoteRes.error || !quoteRes.data) {
      notifications.error('Erreur', 'Devis introuvable')
      return null
    }

    return { quote: quoteRes.data, lines: linesRes.data ?? [] }
  }

  async function convertToInvoice(quoteId: string): Promise<string | null> {
    if (!authStore.user) return null

    const existing = quotes.value.find((q) => q.id === quoteId)
    if (existing && existing.status !== 'SENT' && existing.status !== 'ACCEPTED') {
      notifications.error('Erreur', 'Seuls les devis émis peuvent être convertis')
      return null
    }

    // Fetch quote with its lines
    const [quoteRes, linesRes] = await Promise.all([
      supabase.from('quotes').select('*').eq('id', quoteId).single(),
      supabase.from('quote_lines').select('*').eq('quote_id', quoteId).order('sort_order'),
    ])

    if (quoteRes.error || !quoteRes.data) {
      notifications.error('Erreur', 'Devis introuvable')
      return null
    }

    const quote = quoteRes.data
    const quoteLines: QuoteLine[] = linesRes.data ?? []

    const today = new Date().toISOString().slice(0, 10)
    const dueDate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)

    // Create invoice from quote data
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        user_id: authStore.user.id,
        client_id: quote.client_id,
        issue_date: today,
        service_date: today,
        due_date: dueDate,
        payment_term_days: 30,
        payment_method: 'Virement bancaire',
        subtotal: quote.subtotal,
        vat_rate: 0,
        vat_amount: 0,
        total: quote.subtotal,
        notes: quote.notes || null,
        status: 'DRAFT',
      })
      .select()
      .single()

    if (invErr || !invoice) {
      notifications.error('Erreur', 'Impossible de créer la facture')
      return null
    }

    // Insert invoice lines from quote lines
    if (quoteLines.length > 0) {
      const invoiceLines = quoteLines.map((l) => ({
        invoice_id: invoice.id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        amount: l.amount,
        sort_order: l.sort_order,
      }))

      const { error: linesErr } = await supabase.from('invoice_lines').insert(invoiceLines)

      if (linesErr) {
        notifications.error('Erreur', 'Impossible de créer les lignes de facture')
        return null
      }
    }

    // Update quote: status ACCEPTED, link to new invoice
    const { data: updatedQuote, error: quoteUpdateErr } = await supabase
      .from('quotes')
      .update({
        status: 'ACCEPTED',
        converted_invoice_id: invoice.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId)
      .select()
      .single()

    if (quoteUpdateErr) {
      notifications.error('Erreur', 'Impossible de mettre à jour le devis')
      return null
    }

    const idx = quotes.value.findIndex((q) => q.id === quoteId)
    if (idx !== -1) quotes.value[idx] = updatedQuote

    notifications.success('Devis converti', 'Facture brouillon créée')
    await logAction('CONVERT_QUOTE', 'quotes', quoteId)

    return invoice.id
  }

  return {
    quotes,
    loading,
    fetchQuotes,
    fetchQuoteWithLines,
    createQuote,
    updateQuote,
    deleteQuote,
    emitQuote,
    convertToInvoice,
  }
}
