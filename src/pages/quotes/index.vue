<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuotes } from '@/composables/useQuotes'
import { formatCurrency, formatDate } from '@/utils/formatters'
import type { QuoteStatus } from '@/lib/types'
import DataTable from '@/components/ui/DataTable.vue'
import Badge from '@/components/ui/Badge.vue'

const router = useRouter()
const { quotes, loading, fetchQuotes } = useQuotes()

const columns = [
  { key: 'number', label: 'N°', sortable: true },
  { key: 'client', label: 'Client' },
  { key: 'issue_date', label: 'Date', sortable: true },
  { key: 'valid_until', label: 'Validité', sortable: true },
  { key: 'subtotal', label: 'Montant HT', sortable: true },
  { key: 'status', label: 'Statut' },
]

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

const statusVariantMap: Record<QuoteStatus, BadgeVariant> = {
  DRAFT: 'default',
  SENT: 'info',
  ACCEPTED: 'success',
  REFUSED: 'danger',
  EXPIRED: 'warning',
}

const statusLabelMap: Record<QuoteStatus, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyé',
  ACCEPTED: 'Accepté',
  REFUSED: 'Refusé',
  EXPIRED: 'Expiré',
}

const tableRows = computed(() =>
  quotes.value.map((q) => ({ ...q, _id: q.id }))
)

onMounted(() => fetchQuotes())
</script>

<template>
  <div class="space-y-5 max-w-6xl mx-auto">
    <!-- Header -->
    <div>
      <h1 class="text-[22px] font-bold text-[#111827]">Devis</h1>
      <p class="text-sm text-[#6B7280] mt-0.5">
        {{ quotes.length }} devis au total
      </p>
    </div>

    <!-- Table -->
    <DataTable :columns="columns" :rows="tableRows" :loading="loading">
      <template #row="{ row }">
        <td class="px-4 py-3">
          <span class="font-mono text-xs font-semibold text-[#7C3AED]">
            {{ row.number ?? '—' }}
          </span>
        </td>
        <td class="px-4 py-3 text-sm text-[#374151]">
          {{ row.client_id ?? '—' }}
        </td>
        <td class="px-4 py-3 text-sm text-[#374151]">
          {{ formatDate(row.issue_date as string) }}
        </td>
        <td class="px-4 py-3 text-sm text-[#374151]">
          {{ formatDate(row.valid_until as string) }}
        </td>
        <td class="px-4 py-3">
          <span class="font-mono text-sm font-semibold text-[#111827] tabular-nums">
            {{ formatCurrency(row.subtotal as number) }}
          </span>
        </td>
        <td class="px-4 py-3">
          <Badge :variant="statusVariantMap[row.status as QuoteStatus]">
            {{ statusLabelMap[row.status as QuoteStatus] }}
          </Badge>
        </td>
      </template>
    </DataTable>
  </div>
</template>
