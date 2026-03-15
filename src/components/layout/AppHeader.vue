<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'

interface Props {
  title?: string
}

const props = defineProps<Props>()

const route = useRoute()
const uiStore = useUiStore()
const authStore = useAuthStore()

const pageTitle = computed(() => {
  if (props.title) return props.title

  const routeTitles: Record<string, string> = {
    dashboard: 'Tableau de bord',
    invoices: 'Factures',
    'invoice-detail': 'Détail de la facture',
    quotes: 'Devis',
    clients: 'Clients',
    'client-detail': 'Détail du client',
    ledger: 'Livre de recettes',
    settings: 'Paramètres',
  }

  return routeTitles[route.name as string] ?? ''
})

const userInitials = computed(() => {
  const profile = authStore.profile
  if (!profile) return 'U'
  return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
})

const userFullName = computed(() => {
  const profile = authStore.profile
  if (!profile) return authStore.user?.email ?? 'Utilisateur'
  return `${profile.first_name} ${profile.last_name}`
})
</script>

<template>
  <header
    class="h-14 flex items-center justify-between px-5 bg-white border-b border-[#E5E7EB] shrink-0"
  >
    <!-- Left: hamburger + title -->
    <div class="flex items-center gap-3">
      <button
        class="p-1.5 rounded-md text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
        aria-label="Basculer le menu lateral"
        @click="uiStore.toggleSidebar"
      >
        <svg
          class="w-5 h-5"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <h1 v-if="pageTitle" class="text-base font-semibold text-[#111827]">
        {{ pageTitle }}
      </h1>
    </div>

    <!-- Right: user info -->
    <div class="flex items-center gap-3">
      <span class="hidden sm:block text-sm text-[#6B7280]">{{ userFullName }}</span>
      <div
        class="w-8 h-8 rounded-full bg-[#7C3AED] flex items-center justify-center shrink-0"
        :title="userFullName"
        aria-hidden="true"
      >
        <span class="text-xs font-semibold text-white">{{ userInitials }}</span>
      </div>
    </div>
  </header>
</template>
