<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'
import { RouterView } from 'vue-router'

const uiStore = useUiStore()
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
        v-show="uiStore.sidebarOpen"
        class="fixed inset-y-0 left-0 z-30 lg:static lg:z-auto lg:flex"
      >
        <AppSidebar />
      </div>
    </Transition>

    <!-- Main area -->
    <div class="flex flex-col flex-1 min-w-0 overflow-hidden">
      <AppHeader />

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
