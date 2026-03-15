<script setup lang="ts">
import ClientCard from './ClientCard.vue'
import type { Client } from '@/lib/types'

interface Props {
  clients: Client[]
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false,
})

const emit = defineEmits<{
  edit: [client: Client]
  delete: [client: Client]
  click: [client: Client]
}>()
</script>

<template>
  <!-- Loading skeleton grid -->
  <div
    v-if="loading"
    class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    aria-busy="true"
    aria-label="Chargement des clients"
  >
    <div
      v-for="n in 8"
      :key="`skeleton-${n}`"
      class="bg-white border border-[#E5E7EB] rounded-xl p-4"
    >
      <div class="flex items-start justify-between mb-3">
        <div class="w-10 h-10 rounded-xl bg-[#F3F4F6] animate-pulse" />
      </div>
      <div class="space-y-2">
        <div class="h-4 bg-[#F3F4F6] rounded animate-pulse w-3/4" />
        <div class="h-5 bg-[#F3F4F6] rounded-full animate-pulse w-1/3" />
      </div>
      <div class="space-y-2 mt-3">
        <div class="h-3 bg-[#F3F4F6] rounded animate-pulse w-full" />
        <div class="h-3 bg-[#F3F4F6] rounded animate-pulse w-2/3" />
      </div>
    </div>
  </div>

  <!-- Empty state -->
  <div
    v-else-if="clients.length === 0"
    class="flex flex-col items-center justify-center py-20 text-center"
  >
    <div
      class="w-16 h-16 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mb-4"
      aria-hidden="true"
    >
      <svg
        class="w-8 h-8 text-[#D1D5DB]"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    </div>
    <p class="text-sm font-medium text-[#374151]">Aucun client pour le moment</p>
    <p class="text-xs text-[#9CA3AF] mt-1">
      Ajoutez votre premier client pour commencer a facturer.
    </p>
  </div>

  <!-- Client grid -->
  <div
    v-else
    class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    role="list"
    aria-label="Liste des clients"
  >
    <div v-for="client in clients" :key="client.id" role="listitem">
      <ClientCard
        :client="client"
        @edit="emit('edit', $event)"
        @delete="emit('delete', $event)"
        @click="emit('click', $event)"
      />
    </div>
  </div>
</template>
