import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import type { Client } from '@/lib/types'
import type { ClientFormData } from '@/utils/validators'

export function useClients() {
  const authStore = useAuthStore()
  const notifications = useNotificationsStore()

  const clients = ref<Client[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchClients() {
    if (!authStore.user) return
    loading.value = true
    error.value = null

    const { data, error: err } = await supabase
      .from('clients')
      .select('*')
      .order('name')

    if (err) {
      error.value = err.message
      notifications.error('Erreur', 'Impossible de charger les clients')
    } else {
      clients.value = data ?? []
    }
    loading.value = false
  }

  async function getClient(id: string): Promise<Client | null> {
    const { data, error: err } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single()

    if (err) {
      notifications.error('Erreur', 'Client introuvable')
      return null
    }
    return data
  }

  async function createClient(formData: ClientFormData): Promise<Client | null> {
    if (!authStore.user) return null

    const payload = {
      ...formData,
      user_id: authStore.user.id,
      siret: formData.siret || null,
      email: formData.email || null,
      phone: formData.phone || null,
      notes: formData.notes || null,
    }

    const { data, error: err } = await supabase
      .from('clients')
      .insert(payload)
      .select()
      .single()

    if (err) {
      notifications.error('Erreur', 'Impossible de créer le client')
      return null
    }

    clients.value.push(data)
    clients.value.sort((a, b) => a.name.localeCompare(b.name))
    notifications.success('Client créé', `${data.name} a été ajouté`)

    await logAction('CREATE_CLIENT', 'clients', data.id)
    return data
  }

  async function updateClient(id: string, formData: Partial<ClientFormData>): Promise<Client | null> {
    const payload = {
      ...formData,
      siret: formData.siret || null,
      email: formData.email || null,
      phone: formData.phone || null,
      notes: formData.notes || null,
      updated_at: new Date().toISOString(),
    }

    const { data, error: err } = await supabase
      .from('clients')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (err) {
      notifications.error('Erreur', 'Impossible de mettre à jour le client')
      return null
    }

    const idx = clients.value.findIndex((c) => c.id === id)
    if (idx !== -1) clients.value[idx] = data

    notifications.success('Client mis à jour')
    await logAction('UPDATE_CLIENT', 'clients', id)
    return data
  }

  async function deleteClient(id: string): Promise<boolean> {
    const { error: err } = await supabase.from('clients').delete().eq('id', id)

    if (err) {
      notifications.error('Erreur', 'Impossible de supprimer le client')
      return false
    }

    clients.value = clients.value.filter((c) => c.id !== id)
    notifications.success('Client supprimé')
    await logAction('DELETE_CLIENT', 'clients', id)
    return true
  }

  async function logAction(action: string, entity: string, entityId: string) {
    if (!authStore.user) return
    await supabase.from('audit_logs').insert({
      user_id: authStore.user.id,
      action,
      entity,
      entity_id: entityId,
    })
  }

  return { clients, loading, error, fetchClients, getClient, createClient, updateClient, deleteClient }
}
