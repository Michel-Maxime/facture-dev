<script setup lang="ts">
import { useNotificationsStore } from '@/stores/notifications'
import { storeToRefs } from 'pinia'

const notificationsStore = useNotificationsStore()
const { notifications } = storeToRefs(notificationsStore)
</script>

<template>
  <RouterView />

  <!-- Toast notifications -->
  <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
    <TransitionGroup name="toast" tag="div" class="flex flex-col gap-2">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg min-w-[320px] max-w-sm"
        :class="{
          'bg-green-50 border border-green-200 text-green-800': notification.type === 'success',
          'bg-red-50 border border-red-200 text-red-800': notification.type === 'error',
          'bg-yellow-50 border border-yellow-200 text-yellow-800': notification.type === 'warning',
          'bg-blue-50 border border-blue-200 text-blue-800': notification.type === 'info',
        }"
      >
        <div class="flex-1">
          <p class="font-medium text-sm">{{ notification.title }}</p>
          <p v-if="notification.message" class="text-xs mt-0.5 opacity-80">{{ notification.message }}</p>
        </div>
        <button
          class="opacity-60 hover:opacity-100 transition-opacity"
          @click="notificationsStore.remove(notification.id)"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
