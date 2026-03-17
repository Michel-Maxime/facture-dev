<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'
import { RouterView } from 'vue-router'

const uiStore = useUiStore()
const authStore = useAuthStore()
const route = useRoute()
const isDesktop = useMediaQuery('(min-width: 1024px)')

const showOnboardingBanner = computed(
  () => !authStore.isProfileComplete && route.path !== '/settings'
)

// On desktop: always show sidebar; sync store when crossing breakpoint
watch(isDesktop, (desktop) => {
  uiStore.sidebarOpen = desktop
}, { immediate: false })

// Auto-close sidebar on navigation on mobile
watch(route, () => {
  if (!isDesktop.value) {
    uiStore.sidebarOpen = false
  }
})
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-[#F9FAFB]">
    <!-- Sidebar overlay for mobile -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="uiStore.sidebarOpen"
        class="fixed inset-0 z-20 bg-black/30 lg:hidden"
        aria-hidden="true"
        @click="uiStore.toggleSidebar"
      />
    </Transition>

    <!-- Sidebar -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="-translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="-translate-x-full"
    >
      <div
        v-show="uiStore.sidebarOpen || isDesktop"
        class="fixed inset-y-0 left-0 z-30 lg:static lg:z-auto lg:flex"
      >
        <AppSidebar />
      </div>
    </Transition>

    <!-- Main area -->
    <div class="flex flex-col flex-1 min-w-0 overflow-hidden">
      <AppHeader />

      <!-- Onboarding banner -->
      <div
        v-if="showOnboardingBanner"
        class="mx-4 mt-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm"
      >
        <svg class="h-4 w-4 shrink-0 text-amber-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <span class="text-amber-800">
          Complétez votre profil avant de facturer —
          <router-link to="/settings" class="font-semibold underline underline-offset-2 hover:text-amber-900">
            Aller aux paramètres
          </router-link>
        </span>
      </div>

      <main
        id="main-content"
        class="flex-1 overflow-y-auto p-6 focus:outline-none"
        tabindex="-1"
      >
        <RouterView />
      </main>
    </div>
  </div>
</template>
