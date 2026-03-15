<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useLedger } from '@/composables/useLedger'
import { formatCurrency } from '@/utils/formatters'
import LedgerTable from '@/components/ledger/LedgerTable.vue'

const { entries, loading, fetchLedger } = useLedger()

const currentYear = ref(new Date().getFullYear())

const years = computed(() => {
  const y = []
  for (let i = currentYear.value; i >= currentYear.value - 4; i--) {
    y.push(i)
  }
  return y
})

const total = computed(() => entries.value.reduce((sum, e) => sum + e.amount, 0))

function exportCsv() {
  const header = 'Date encaissement;Référence;Client;Mode;N° pièce;Montant\n'
  const rows = entries.value
    .map((e) =>
      [e.payment_date, e.invoice_number, e.client_name, e.method, e.reference ?? '', e.amount.toFixed(2)].join(';'),
    )
    .join('\n')

  const bom = '\uFEFF' // UTF-8 BOM for Excel
  const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `livre-recettes-${currentYear.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

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

    <!-- Summary cards -->
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

    <!-- Ledger table with CSV export -->
    <LedgerTable
      :entries="entries"
      :loading="loading"
      :year="currentYear"
      @export-csv="exportCsv"
    />
  </div>
</template>
