import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'

const MAX_SIZE_BYTES = 512 * 1024 // 512 KB
const ALLOWED_TYPES = ['image/png', 'image/jpeg']

export function useLogo() {
  const authStore = useAuthStore()
  const notifications = useNotificationsStore()
  const uploading = ref(false)
  const logoUrl = ref<string | null>(authStore.profile?.logo_url ?? null)

  async function getLogoSignedUrl(path: string): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from('logos')
      .createSignedUrl(path, 3600) // 1h
    if (error || !data) return null
    return data.signedUrl
  }

  async function uploadLogo(file: File): Promise<boolean> {
    if (!authStore.user) return false

    if (!ALLOWED_TYPES.includes(file.type)) {
      notifications.error('Format non supporté', 'PNG ou JPEG uniquement')
      return false
    }
    if (file.size > MAX_SIZE_BYTES) {
      notifications.error('Fichier trop volumineux', 'Maximum 512 Ko')
      return false
    }

    uploading.value = true

    const ext = file.type === 'image/png' ? 'png' : 'jpg'
    const storagePath = `${authStore.user.id}/logo.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(storagePath, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      notifications.error('Erreur', "Impossible d'uploader le logo")
      uploading.value = false
      return false
    }

    // Save path in profile
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      // @ts-ignore — logo_url is in the schema but type inference breaks on optional columns
      .update({ logo_url: storagePath, updated_at: new Date().toISOString() })
      .eq('id', authStore.user.id)
      .select()
      .single()

    if (updateError || !updated) {
      notifications.error('Erreur', 'Impossible de sauvegarder le logo')
      uploading.value = false
      return false
    }

    authStore.setProfile(updated)
    logoUrl.value = storagePath
    notifications.success('Logo uploadé')
    uploading.value = false
    return true
  }

  async function removeLogo(): Promise<boolean> {
    if (!authStore.user || !authStore.profile?.logo_url) return false

    const { error: removeError } = await supabase.storage
      .from('logos')
      .remove([authStore.profile.logo_url])

    if (removeError) {
      notifications.error('Erreur', 'Impossible de supprimer le logo')
      return false
    }

    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      // @ts-ignore — logo_url is in the schema but type inference breaks on optional columns
      .update({ logo_url: null, updated_at: new Date().toISOString() })
      .eq('id', authStore.user.id)
      .select()
      .single()

    if (!updateError && updated) {
      authStore.setProfile(updated)
    }

    logoUrl.value = null
    notifications.success('Logo supprimé')
    return true
  }

  return { uploading, logoUrl, uploadLogo, removeLogo, getLogoSignedUrl }
}
