import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import type { Payment } from '@/lib/types'

export function usePayments() {
  const authStore = useAuthStore()
  const notifications = useNotificationsStore()

  const payments = ref<Payment[]>([])
  const loading = ref(false)

  async function fetchPayments(invoiceId: string) {
    loading.value = true
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('date', { ascending: false })

    if (error) {
      notifications.error('Erreur', 'Impossible de charger les paiements')
    } else {
      payments.value = data ?? []
    }
    loading.value = false
  }

  async function recordPayment(
    invoiceId: string,
    amount: number,
    date: string,
    method: string,
    reference?: string,
  ): Promise<Payment | null> {
    if (!authStore.user) return null

    const { data, error } = await supabase
      .from('payments')
      .insert({ invoice_id: invoiceId, amount, date, method, reference: reference || null })
      .select()
      .single()

    if (error) {
      notifications.error('Erreur', "Impossible d'enregistrer le paiement")
      return null
    }

    // Mark invoice as PAID
    await supabase
      .from('invoices')
      .update({ status: 'PAID', updated_at: new Date().toISOString() })
      .eq('id', invoiceId)

    payments.value.unshift(data)
    notifications.success('Paiement enregistré', 'Facture marquée comme payée')

    await supabase.from('audit_logs').insert({
      user_id: authStore.user.id,
      action: 'RECORD_PAYMENT',
      entity: 'payments',
      entity_id: data.id,
      details: { invoice_id: invoiceId, amount },
    })

    return data
  }

  return { payments, loading, fetchPayments, recordPayment }
}
