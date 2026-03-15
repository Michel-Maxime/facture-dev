<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useInvoices } from '@/composables/useInvoices'
import { useClients } from '@/composables/useClients'
import { formatCurrency, formatDate } from '@/utils/formatters'
import type { InvoiceStatus } from '@/lib/types'
import Button from '@/components/ui/Button.vue'
import DataTable from '@/components/ui/DataTable.vue'
import InvoiceStatusBadge from '@/components/invoices/InvoiceStatusBadge.vue'

const router = useRouter()
const { invoices, loading, fetchInvoices } = useInvoices()
const { clients, fetchClients } = useClients()

const search = ref('')
const activeTab = ref<InvoiceStatus | 'ALL'>('ALL')

const tabs: { key: InvoiceStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Toutes' },
  { key: 'DRAFT', label: 'Brouillons' },
  { key: 'SENT', label: 'Envoyées' },
  { key: 'PAID', label: 'Payées' },
  { key: 'OVERDUE', label: 'En retard' },
  { key: 'CANCELLED', label: 'Annulées' },
]

const columns = [
  { key: 'number', label: 'N°', sortable: true },
  { key: 'client', label: 'Client' },
  { key: 'date', label: 'Date', sortable: true },
  { key: 'total', label: 'Montant TTC', sortable: true },
  { key: 'status', label: 'Statut' },
  { key: 'actions', label: '' },
]

const clientMap = computed(() => {
  const map = new Map<string, string>()
  for (const c of clients.value) map.set(c.id, c.name)
  return map
})

const filteredInvoices = computed(() => {
  let list = invoices.value

  if (activeTab.value !== 'ALL') {
    list = list.filter((i) => i.status === activeTab.value)
  }

  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter((i) => {
      const matchNumber = (i.number ?? '').toLowerCase().includes(q)
      const matchClient = (clientMap.value.get(i.client_id) ?? i.client_id).toLowerCase().includes(q)
      return matchNumber || matchClient
    })
  }

  return list
})

const tableRows = computed(() =>
  filteredInvoices.value.map((invoice) => ({
    ...invoice,
    _id: invoice.id,
    _status: invoice.status,
    _total: invoice.total,
    _date: invoice.issue_date,
  }))
)

onMounted(async () => {
  await Promise.all([fetchInvoices(), fetchClients()])
})
</script>

<template>
  <div class="space-y-5 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-[22px] font-bold text-[#111827]">Factures</h1>
        <p class="text-sm text-[#6B7280] mt-0.5">
          {{ invoices.length }} facture{{ invoices.length !== 1 ? 's' : '' }} au total
        </p>
      </div>
      <RouterLink to="/invoices/new">
        <Button variant="default" size="md">
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" />
          </svg>
          Nouvelle facture
        </Button>
      </RouterLink>
    </div>

    <!-- Search bar -->
    <div class="flex items-center gap-3">
      <div class="relative flex-1 max-w-sm">
        <svg
          class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF] pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
        </svg>
        <input
          v-model="search"
          type="text"
          placeholder="Rechercher par n°, client..."
          class="h-9 w-full rounded-md border border-[#E5E7EB] bg-white pl-8 pr-3 text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-[#7C3AED]"
        />
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex items-center gap-1 border-b border-[#E5E7EB] overflow-x-auto">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="[
          'px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
          activeTab === tab.key
            ? 'border-[#7C3AED] text-[#7C3AED]'
            : 'border-transparent text-[#6B7280] hover:text-[#374151]',
        ]"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
        <span
          v-if="tab.key !== 'ALL'"
          :class="[
            'ml-1.5 text-xs px-1.5 py-0.5 rounded-full tabular-nums font-mono',
            activeTab === tab.key
              ? 'bg-[#EDE9FE] text-[#7C3AED]'
              : 'bg-[#F3F4F6] text-[#9CA3AF]',
          ]"
        >
          {{ invoices.filter(i => i.status === tab.key).length }}
        </span>
      </button>
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
          {{ clientMap.get(row.client_id as string) ?? '—' }}
        </td>
        <td class="px-4 py-3 text-sm text-[#374151]">
          {{ formatDate(row.issue_date as string) }}
        </td>
        <td class="px-4 py-3">
          <span class="font-mono text-sm font-semibold text-[#111827] tabular-nums">
            {{ formatCurrency(row.total as number) }}
          </span>
        </td>
        <td class="px-4 py-3">
          <InvoiceStatusBadge :status="row.status as InvoiceStatus" />
        </td>
        <td class="px-4 py-3 text-right">
          <button
            class="text-xs text-[#7C3AED] font-medium hover:underline"
            @click="router.push(`/invoices/${row.id}`)"
          >
            Voir
          </button>
        </td>
      </template>
    </DataTable>
  </div>
</template>
