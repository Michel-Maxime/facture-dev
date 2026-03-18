<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useAuth } from '@/composables/useAuth'
import { useCotisations } from '@/composables/useCotisations'

const route = useRoute()
const authStore = useAuthStore()
const uiStore = useUiStore()
const { logout } = useAuth()

// Use the cotisations composable for declaration deadline logic (business logic belongs in composables)
const { nextDeadline: nextDeclarationDate, daysUntilDeadline: daysUntilDeclaration } = useCotisations(ref(0))

interface NavItem {
  label: string
  path: string
  icon: string
}

const navItems: NavItem[] = [
  { label: 'Tableau de bord', path: '/', icon: 'dashboard' },
  { label: 'Factures', path: '/invoices', icon: 'invoices' },
  { label: 'Devis', path: '/quotes', icon: 'quotes' },
  { label: 'Récurrentes', path: '/recurring', icon: 'recurring' },
  { label: 'Clients', path: '/clients', icon: 'clients' },
  { label: 'Avoirs', path: '/credit-notes', icon: 'credit-notes' },
  { label: 'Livre de recettes', path: '/ledger', icon: 'ledger' },
  { label: 'Paramètres', path: '/settings', icon: 'settings' },
]

function isActive(path: string): boolean {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

const userFullName = computed(() => {
  const profile = authStore.profile
  if (!profile) return authStore.user?.email ?? 'Utilisateur'
  return `${profile.first_name} ${profile.last_name}`
})

const userInitials = computed(() => {
  const profile = authStore.profile
  if (!profile) return 'U'
  return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
})
</script>

<template>
  <aside
    class="flex flex-col h-full bg-white border-r border-[#E5E7EB]"
    style="width: 220px; min-width: 220px;"
  >
    <!-- Brand -->
    <div class="px-5 py-5 border-b border-[#E5E7EB]">
      <router-link to="/" class="flex items-center gap-2 group">
        <div
          class="w-7 h-7 rounded-lg bg-[#7C3AED] flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <svg
            class="w-4 h-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
            />
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="white" stroke-width="1.5" stroke-linecap="round" fill="none" />
          </svg>
        </div>
        <span class="text-sm font-bold text-[#111827] tracking-tight">facture.dev</span>
      </router-link>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Navigation principale">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors group"
        :class="
          isActive(item.path)
            ? 'bg-[#EDE9FE] text-[#7C3AED] font-medium'
            : 'text-[#374151] hover:bg-[#F9FAFB] hover:text-[#111827]'
        "
      >
        <!-- Dashboard icon -->
        <svg
          v-if="item.icon === 'dashboard'"
          class="w-4 h-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>

        <!-- Invoices icon -->
        <svg
          v-else-if="item.icon === 'invoices'"
          class="w-4 h-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>

        <!-- Quotes icon -->
        <svg
          v-else-if="item.icon === 'quotes'"
          class="w-4 h-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>

        <!-- Recurring icon -->
        <svg
          v-else-if="item.icon === 'recurring'"
          class="w-4 h-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M17 1l4 4-4 4" />
          <path d="M3 11V9a4 4 0 014-4h14" />
          <path d="M7 23l-4-4 4-4" />
          <path d="M21 13v2a4 4 0 01-4 4H3" />
        </svg>

        <!-- Clients icon -->
        <svg
          v-else-if="item.icon === 'clients'"
          class="w-4 h-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>

        <!-- Credit notes icon -->
        <svg
          v-else-if="item.icon === 'credit-notes'"
          class="w-4 h-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>

        <!-- Ledger icon -->
        <svg
          v-else-if="item.icon === 'ledger'"
          class="w-4 h-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
          <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
        </svg>

        <!-- Settings icon -->
        <svg
          v-else-if="item.icon === 'settings'"
          class="w-4 h-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>

        <span>{{ item.label }}</span>
      </router-link>
    </nav>

    <!-- Declaration reminder -->
    <div class="px-3 pb-3">
      <div class="rounded-lg bg-[#EDE9FE] border border-[#DDD6FE] px-3 py-3">
        <div class="flex items-start gap-2">
          <svg
            class="w-4 h-4 text-[#7C3AED] shrink-0 mt-0.5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <div class="min-w-0">
            <p class="text-xs font-semibold text-[#5B21B6]">Déclaration Urssaf</p>
            <p class="text-xs text-[#6D28D9] mt-0.5">{{ nextDeclarationDate }}</p>
            <p class="text-xs text-[#7C3AED] font-mono tabular-nums">
              J-{{ daysUntilDeclaration }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- User profile -->
    <div class="px-3 pb-4 border-t border-[#E5E7EB] pt-3">
      <div class="flex items-center gap-2.5">
        <div
          class="w-8 h-8 rounded-full bg-[#7C3AED] flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <span class="text-xs font-semibold text-white">{{ userInitials }}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium text-[#111827] truncate">{{ userFullName }}</p>
          <p class="text-xs text-[#9CA3AF] truncate">{{ authStore.user?.email }}</p>
        </div>
        <button
          class="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors shrink-0"
          title="Se déconnecter"
          aria-label="Se déconnecter"
          @click="logout"
        >
          <svg
            class="w-4 h-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  </aside>
</template>
