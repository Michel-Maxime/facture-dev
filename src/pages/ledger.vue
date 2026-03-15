<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useLedger } from '@/composables/useLedger'
import { formatCurrency, formatDate } from '@/utils/formatters'
import DataTable from '@/components/ui/DataTable.vue'
import Card from '@/components/ui/Card.vue'

const { entries, loading, fetchLedger } = useLedger()

const currentYear = ref(new Date().getFullYear())

const years = computed(() => {
  const y = []
  for (let i = currentYear.value; i >= currentYear.value - 4; i--) {
    y.push(i)
  }
  return y
})

const columns = [
  { key: 'payment_date', label: 'Date de paiement', sortable: true },
  { key: 'invoice_number', label: 'N° facture' },
  { key: 'client_name', label: 'Client' },
  { key: 'method', label: 'Mode de paiement' },
  { key: 'amount', label: 'Montant', sortable: true },
]

const total = computed(() => entries.value.reduce((sum, e) => sum + e.amount, 0))

const tableRows = computed(() =>
  entries.value.map((e) => ({ ...e }))
)

watch(currentYear, (year) => fetchLedger(year))

onMounted(() => fetchLedger(currentYear.value))
</script>

<template>
  <div class="space-y-5 max-w-5xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 class="text-[22px] font-bold text-[#111827]">Livre de recettes</h1>
        <p class="text-sm text-[#6B7280] mt-0.5">
          Historique des paiements reçus — exercice {{ currentYear }}
        </p>
      </div>

      <!-- Year selector -->
      <div class="flex items-center gap-2">
        <label class="text-sm font-medium text-[#374151]">Exercice</label>
        <select
          v-model="currentYear"
          class="h-9 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-[#7C3AED]"
        >
          <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>
    </div>

    <!-- Summary -->
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
      <div class="bg-white border border-[#E5E7EB] rounded-xl p-5">
        <p class="text-xs font-medium text-[#6B7280] uppercase tracking-wide">Recettes totales</p>
        <template v-if="loading">
          <div class="h-7 w-28 bg-[#F3F4F6] rounded animate-pulse mt-2" />
        </template>
        <p v-else class="text-2xl font-bold font-mono text-[#059669] tabular-nums mt-2">
          {{ formatCurrency(total) }}
        </p>
      </div>
      <div class="bg-white border border-[#E5E7EB] rounded-xl p-5">
        <p class="text-xs font-medium text-[#6B7280] uppercase tracking-wide">Nombre de paiements</p>
        <template v-if="loading">
          <div class="h-7 w-16 bg-[#F3F4F6] rounded animate-pulse mt-2" />
        </template>
        <p v-else class="text-2xl font-bold font-mono text-[#111827] tabular-nums mt-2">
          {{ entries.length }}
        </p>
      </div>
    </div>

    <!-- Table -->
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
        <td class="px-4 py-3">
          <span class="font-mono text-sm font-semibold text-[#059669] tabular-nums">
            {{ formatCurrency(row.amount as number) }}
          </span>
        </td>
      </template>
    </DataTable>

    <!-- Total row -->
    <template v-if="!loading && entries.length > 0">
      <div class="bg-white border border-[#E5E7EB] rounded-xl px-4 py-3 flex items-center justify-end gap-6">
        <span class="text-sm font-semibold text-[#374151]">Total {{ currentYear }}</span>
        <span class="font-mono text-lg font-bold text-[#059669] tabular-nums">
          {{ formatCurrency(total) }}
        </span>
      </div>
    </template>
  </div>
</template>
