import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

export function useAuditLog() {
  const authStore = useAuthStore()

  async function logAction(action: string, entity: string, entityId: string) {
    if (!authStore.user) return
    await supabase.from('audit_logs').insert({
      user_id: authStore.user.id,
      action,
      entity,
      entity_id: entityId,
    })
  }

  return { logAction }
}
