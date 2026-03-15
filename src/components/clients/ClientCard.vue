<script setup lang="ts">
import { computed } from 'vue'
import Badge from '@/components/ui/Badge.vue'
import type { Client } from '@/lib/types'

interface Props {
  client: Client
}

const props = defineProps<Props>()

const emit = defineEmits<{
  edit: [client: Client]
  delete: [client: Client]
  click: [client: Client]
}>()

const initials = computed(() => {
  const parts = props.client.name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
})

const typeLabel = computed(() =>
  props.client.type === 'PROFESSIONAL' ? 'Professionnel' : 'Particulier',
)

const typeVariant = computed(() =>
  props.client.type === 'PROFESSIONAL' ? 'info' : 'default',
)

// Consistent avatar background color derived from name
const avatarColor = computed(() => {
  const colors = [
    '#7C3AED', '#059669', '#D97706', '#DC2626',
    '#2563EB', '#7C3AED', '#DB2777', '#0891B2',
  ]
  let hash = 0
  for (let i = 0; i < props.client.name.length; i++) {
    hash = props.client.name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
})
</script>

<template>
  <div
    class="bg-white border border-[#E5E7EB] rounded-xl p-4 hover:border-[#7C3AED]/30 hover:shadow-sm transition-all cursor-pointer group"
    role="article"
    :aria-label="`Client ${client.name}`"
    @click="emit('click', client)"
  >
    <!-- Header: avatar + actions -->
    <div class="flex items-start justify-between mb-3">
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-semibold text-sm"
        :style="{ backgroundColor: avatarColor }"
        aria-hidden="true"
      >
        {{ initials }}
      </div>

      <!-- Action buttons (visible on hover) -->
      <div
        class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        @click.stop
      >
        <button
          class="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors"
          title="Modifier"
          aria-label="`Modifier ${client.name}`"
          @click="emit('edit', client)"
        >
          <svg
            class="w-3.5 h-3.5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button
          class="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
          title="Supprimer"
          :aria-label="`Supprimer ${client.name}`"
          @click="emit('delete', client)"
        >
          <svg
            class="w-3.5 h-3.5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Name + type badge -->
    <div class="mb-2">
      <h3 class="text-sm font-semibold text-[#111827] truncate">{{ client.name }}</h3>
      <div class="mt-1">
        <Badge :variant="typeVariant">{{ typeLabel }}</Badge>
      </div>
    </div>

    <!-- Contact info -->
    <div class="space-y-1.5 mt-3">
      <div v-if="client.email" class="flex items-center gap-1.5 text-xs text-[#6B7280]">
        <svg
          class="w-3.5 h-3.5 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
        <span class="truncate">{{ client.email }}</span>
      </div>

      <div class="flex items-center gap-1.5 text-xs text-[#6B7280]">
        <svg
          class="w-3.5 h-3.5 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span class="truncate">{{ client.postal_code }} {{ client.city }}</span>
      </div>
    </div>
  </div>
</template>
