import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { useAuditLog } from '@/composables/useAuditLog'
import type { Database } from '@/lib/types'

type RecurringSchedule = Database['public']['Tables']['recurring_schedules']['Row']
type RecurringFrequency = Database['public']['Enums']['recurring_frequency']

export interface RecurringScheduleFormData {
  client_id: string
  frequency: RecurringFrequency
  day_of_month: number
  payment_term_days: number
  payment_method: string
  vat_rate: number
  notes?: string
  template_lines: Array<{
    description: string
    quantity: number
    unit_price: number
    amount: number
    sort_order: number
  }>
}

/**
 * Computes the next run date for a recurring schedule.
 * Exported for unit testing.
 */
export function computeNextRunDate(
  frequency: RecurringFrequency,
  dayOfMonth: number,
  from: Date = new Date(),
): string {
  const year = from.getFullYear()
  const month = from.getMonth() // 0-indexed
  const day = from.getDate()

  if (frequency === 'MONTHLY') {
    // If today < day_of_month this month → this month
    if (day < dayOfMonth) {
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`
    }
    // Otherwise next month
    const nextMonth = month + 1
    const nextYear = nextMonth > 11 ? year + 1 : year
    const adjustedMonth = nextMonth > 11 ? 0 : nextMonth
    return `${nextYear}-${String(adjustedMonth + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`
  }

  // QUARTERLY: find the start of the next quarter
  // Quarters: Q1=jan-mar, Q2=apr-jun, Q3=jul-sep, Q4=oct-dec
  const currentQuarter = Math.floor(month / 3)
  const nextQuarterStart = (currentQuarter + 1) * 3 // 0-indexed month of next quarter start
  let nextQYear = year
  let nextQMonth = nextQuarterStart
  if (nextQMonth > 11) {
    nextQMonth = 0
    nextQYear = year + 1
  }
  return `${nextQYear}-${String(nextQMonth + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`
}

export function useRecurringInvoices() {
  const authStore = useAuthStore()
  const notifications = useNotificationsStore()
  const { logAction } = useAuditLog()

  const schedules = ref<RecurringSchedule[]>([])
  const loading = ref(false)

  async function fetchSchedules() {
    if (!authStore.user) return
    loading.value = true

    const { data, error } = await supabase
      .from('recurring_schedules')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      notifications.error('Erreur', 'Impossible de charger les modèles récurrents')
    } else {
      schedules.value = data ?? []
    }
    loading.value = false
  }

  async function createSchedule(formData: RecurringScheduleFormData): Promise<RecurringSchedule | null> {
    if (!authStore.user) return null

    const nextRunDate = computeNextRunDate(formData.frequency, formData.day_of_month)

    const { data, error } = await supabase
      .from('recurring_schedules')
      .insert({
        user_id: authStore.user.id,
        client_id: formData.client_id,
        frequency: formData.frequency,
        day_of_month: formData.day_of_month,
        next_run_date: nextRunDate,
        payment_term_days: formData.payment_term_days,
        payment_method: formData.payment_method,
        vat_rate: formData.vat_rate,
        notes: formData.notes || null,
        template_lines: formData.template_lines,
        is_active: true,
      })
      .select()
      .single()

    if (error || !data) {
      notifications.error('Erreur', 'Impossible de créer le modèle récurrent')
      return null
    }

    schedules.value.unshift(data)
    notifications.success('Modèle créé', `Prochaine génération : ${nextRunDate}`)
    await logAction('CREATE_RECURRING', 'recurring_schedules', data.id)
    return data
  }

  async function updateSchedule(
    id: string,
    updates: Partial<RecurringScheduleFormData & { is_active: boolean }>,
  ): Promise<RecurringSchedule | null> {
    const { data, error } = await supabase
      .from('recurring_schedules')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error || !data) {
      notifications.error('Erreur', 'Impossible de mettre à jour le modèle')
      return null
    }

    const idx = schedules.value.findIndex((s) => s.id === id)
    if (idx !== -1) schedules.value[idx] = data
    notifications.success('Modèle mis à jour')
    return data
  }

  async function deleteSchedule(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('recurring_schedules')
      .delete()
      .eq('id', id)

    if (error) {
      notifications.error('Erreur', 'Impossible de supprimer le modèle')
      return false
    }

    schedules.value = schedules.value.filter((s) => s.id !== id)
    notifications.success('Modèle supprimé')
    await logAction('DELETE_RECURRING', 'recurring_schedules', id)
    return true
  }

  async function toggleActive(id: string): Promise<boolean> {
    const schedule = schedules.value.find((s) => s.id === id)
    if (!schedule) return false

    const updated = await updateSchedule(id, { is_active: !schedule.is_active })
    if (updated) {
      notifications.success(updated.is_active ? 'Modèle activé' : 'Modèle désactivé')
    }
    return !!updated
  }

  /**
   * Manually triggers the generation of invoices for all due schedules.
   * Calls the process-recurring-invoices Edge Function.
   */
  async function generateNow(scheduleId?: string): Promise<number> {
    const { data, error } = await supabase.functions.invoke('process-recurring-invoices', {
      body: { scheduleId: scheduleId ?? null },
    })

    if (error || !data) {
      notifications.error('Erreur', 'Impossible de déclencher la génération')
      return 0
    }

    const count = data.invoicesCreated ?? 0
    if (count > 0) {
      notifications.success('Factures générées', `${count} brouillon(s) créé(s)`)
    } else {
      notifications.success('Aucune facture due', "Aucun modèle à déclencher pour aujourd'hui")
    }

    // Refresh schedules to get updated next_run_date
    await fetchSchedules()
    return count
  }

  return {
    schedules,
    loading,
    fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    toggleActive,
    generateNow,
  }
}
