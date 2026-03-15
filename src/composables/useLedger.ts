import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useNotificationsStore } from '@/stores/notifications'

export interface LedgerEntry {
  invoice_id: string
  invoice_number: string
  client_name: string
  payment_date: string
  amount: number
  method: string
  reference: string | null
}

export function useLedger() {
  const notifications = useNotificationsStore()
  const entries = ref<LedgerEntry[]>([])
  const loading = ref(false)

  async function fetchLedger(year?: number) {
    loading.value = true
    const currentYear = year ?? new Date().getFullYear()

    const { data, error } = await supabase
      .from('payments')
      .select(`
        id,
        invoice_id,
        amount,
        date,
        method,
        reference,
        invoices!inner(
          number,
          status,
          clients(name)
        )
      `)
      .eq('invoices.status', 'PAID')
      .gte('date', `${currentYear}-01-01`)
      .lte('date', `${currentYear}-12-31`)
      .order('date', { ascending: false })

    if (error) {
      notifications.error('Erreur', 'Impossible de charger le livre de recettes')
    } else {
      entries.value = (data ?? []).map((row: any) => ({
        invoice_id: row.invoice_id,
        invoice_number: row.invoices?.number ?? '',
        client_name: row.invoices?.clients?.name ?? '',
        payment_date: row.date,
        amount: row.amount,
        method: row.method,
        reference: row.reference,
      }))
    }
    loading.value = false
  }

  return { entries, loading, fetchLedger }
}
