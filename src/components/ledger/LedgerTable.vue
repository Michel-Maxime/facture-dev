<script setup lang="ts">
import { computed } from 'vue'
import type { LedgerEntry } from '@/composables/useLedger'
import { formatCurrency, formatDate } from '@/utils/formatters'
import DataTable from '@/components/ui/DataTable.vue'
import Button from '@/components/ui/Button.vue'

const props = defineProps<{
  entries: LedgerEntry[]
  loading: boolean
  year: number
}>()

const emit = defineEmits<{
  exportCsv: []
}>()

const columns = [
  { key: 'payment_date', label: 'Date encaissement', sortable: true },
  { key: 'invoice_number', label: 'Référence' },
  { key: 'client_name', label: 'Client' },
  { key: 'method', label: 'Mode' },
  { key: 'reference', label: 'N° pièce' },
  { key: 'amount', label: 'Montant', sortable: true },
]

const total = computed(() => props.entries.reduce((sum, e) => sum + e.amount, 0))
const tableRows = computed(() => props.entries.map((e) => ({ ...e })))
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" :disabled="loading || entries.length === 0" @click="emit('exportCsv')">
        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
        Exporter CSV
      </Button>
    </div>

    <DataTable :columns="columns" :rows="tableRows" :loading="loading">
      <template #row="{ row }">
        <td class="px-4 py-3 text-sm text-[#374151]">
          {{ formatDate(row.payment_date as string) }}
        </td>
        <td class="px-4 py-3">
          <span class="font-mono text-xs font-semibold text-[#7C3AED]">
            {{ row.invoice_number || '—' }}
          </span>
        </td>
        <td class="px-4 py-3 text-sm text-[#374151]">{{ row.client_name || '—' }}</td>
        <td class="px-4 py-3 text-sm text-[#374151]">{{ row.method }}</td>
        <td class="px-4 py-3 text-sm text-[#6B7280]">{{ row.reference || '—' }}</td>
        <td class="px-4 py-3">
          <span class="font-mono text-sm font-semibold text-[#059669] tabular-nums">
            {{ formatCurrency(row.amount as number) }}
          </span>
        </td>
      </template>
    </DataTable>

    <template v-if="!loading && entries.length > 0">
      <div class="bg-white border border-[#E5E7EB] rounded-xl px-4 py-3 flex items-center justify-end gap-6">
        <span class="text-sm font-semibold text-[#374151]">Total {{ year }}</span>
        <span class="font-mono text-lg font-bold text-[#059669] tabular-nums">
          {{ formatCurrency(total) }}
        </span>
      </div>
    </template>
  </div>
</template>
