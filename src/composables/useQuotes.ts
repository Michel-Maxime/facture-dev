import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import type { Quote } from '@/lib/types'

export function useQuotes() {
  const authStore = useAuthStore()
  const notifications = useNotificationsStore()

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

  return { quotes, loading, fetchQuotes }
}
