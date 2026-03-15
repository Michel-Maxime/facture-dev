<script setup lang="ts">
import { ref } from 'vue'

interface Column {
  key: string
  label: string
  sortable?: boolean
}

interface Props {
  columns: Column[]
  rows: Array<Record<string, unknown>>
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false,
})

const emit = defineEmits<{
  sort: [key: string, direction: 'asc' | 'desc']
}>()

const sortKey = ref<string | null>(null)
const sortDirection = ref<'asc' | 'desc'>('asc')

function handleSort(column: Column) {
  if (!column.sortable) return

  if (sortKey.value === column.key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = column.key
    sortDirection.value = 'asc'
  }

  emit('sort', sortKey.value, sortDirection.value)
}
</script>

<template>
  <div class="w-full overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-[#E5E7EB] bg-[#F9FAFB]">
            <th
              v-for="column in columns"
              :key="column.key"
              :class="[
                'px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wide',
                column.sortable ? 'cursor-pointer select-none hover:text-[#111827]' : '',
              ]"
              @click="handleSort(column)"
            >
              <span class="inline-flex items-center gap-1.5">
                {{ column.label }}
                <span
                  v-if="column.sortable"
                  class="inline-flex flex-col gap-px"
                  aria-hidden="true"
                >
                  <svg
                    :class="[
                      'h-2.5 w-2.5 transition-colors',
                      sortKey === column.key && sortDirection === 'asc'
                        ? 'text-[#7C3AED]'
                        : 'text-[#D1D5DB]',
                    ]"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  <svg
                    :class="[
                      'h-2.5 w-2.5 transition-colors',
                      sortKey === column.key && sortDirection === 'desc'
                        ? 'text-[#7C3AED]'
                        : 'text-[#D1D5DB]',
                    ]"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </span>
              </span>
            </th>
          </tr>
        </thead>

        <tbody>
          <!-- Loading skeleton -->
          <template v-if="loading">
            <tr
              v-for="n in 5"
              :key="`skeleton-${n}`"
              class="border-b border-[#F3F4F6] last:border-0"
            >
              <td
                v-for="column in columns"
                :key="column.key"
                class="px-4 py-3"
              >
                <div class="h-4 bg-[#F3F4F6] rounded animate-pulse" :style="{ width: `${60 + Math.random() * 40}%` }" />
              </td>
            </tr>
          </template>

          <!-- Empty state -->
          <template v-else-if="rows.length === 0">
            <tr>
              <td :colspan="columns.length" class="px-4 py-12 text-center">
                <div class="flex flex-col items-center gap-2">
                  <svg
                    class="h-8 w-8 text-[#D1D5DB]"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p class="text-sm text-[#9CA3AF]">Aucun résultat</p>
                </div>
              </td>
            </tr>
          </template>

          <!-- Data rows -->
          <template v-else>
            <tr
              v-for="(row, index) in rows"
              :key="index"
              class="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB] transition-colors"
            >
              <slot name="row" :row="row" :index="index">
                <td
                  v-for="column in columns"
                  :key="column.key"
                  class="px-4 py-3 text-sm text-[#374151]"
                >
                  {{ row[column.key] }}
                </td>
              </slot>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
