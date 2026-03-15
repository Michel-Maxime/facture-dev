import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { useNotificationsStore } from '@/stores/notifications'
import { useRouter } from 'vue-router'
import type { RegisterFormData } from '@/utils/validators'

export function useAuth() {
  const authStore = useAuthStore()
  const notifications = useNotificationsStore()
  const router = useRouter()

  async function login(email: string, password: string): Promise<boolean> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      notifications.error('Connexion échouée', error.message)
      return false
    }
    await authStore.initialize()
    notifications.success('Connecté', 'Bienvenue !')
    return true
  }

  async function register(data: RegisterFormData): Promise<boolean> {
    const { error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          first_name: data.first_name,
          last_name: data.last_name,
          address: data.address,
          city: data.city,
          postal_code: data.postal_code,
          siret: data.siret,
          code_ape: data.code_ape,
          company_created_at: data.company_created_at,
        },
      },
    })

    if (authError) {
      notifications.error("Erreur lors de l'inscription", authError.message)
      return false
    }

    notifications.success('Compte créé', 'Bienvenue sur facture.dev !')
    return true
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
    notifications.success('Déconnecté')
  }

  return { login, register, logout }
}
