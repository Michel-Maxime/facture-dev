<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuotes } from '@/composables/useQuotes'
import { useClients } from '@/composables/useClients'
import { formatCurrency, formatDate } from '@/utils/formatters'
import type { QuoteStatus } from '@/lib/types'
import type { QuoteFormData } from '@/utils/validators'
import DataTable from '@/components/ui/DataTable.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Modal from '@/components/ui/Modal.vue'
import QuoteForm from '@/components/quotes/QuoteForm.vue'

const router = useRouter()
const { quotes, loading, fetchQuotes, fetchQuoteWithLines, createQuote, updateQuote, deleteQuote, emitQuote, convertToInvoice } = useQuotes()
const { clients, fetchClients } = useClients()

// ─── Modal state ─────────────────────────────────────────────────────────────
const showModal = ref(false)
const editingQuoteId = ref<string | null>(null)
const formInitialData = ref<Partial<QuoteFormData> | undefined>(undefined)
const formLoading = ref(false)

function openCreateModal() {
  editingQuoteId.value = null
  formInitialData.value = undefined
  showModal.value = true
}

async function openEditModal(quoteId: string) {
  const result = await fetchQuoteWithLines(quoteId)
  if (!result) return

  const { quote, lines } = result
  editingQuoteId.value = quoteId
  formInitialData.value = {
    client_id: quote.client_id,
    issue_date: quote.issue_date,
    valid_until: quote.valid_until,
    notes: quote.notes ?? '',
    lines: lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unit_price,
      amount: l.amount,
      sort_order: l.sort_order,
    })),
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingQuoteId.value = null
  formInitialData.value = undefined
}

async function handleFormSubmit(data: QuoteFormData) {
  formLoading.value = true
  if (editingQuoteId.value) {
    await updateQuote(editingQuoteId.value, data)
  } else {
    await createQuote(data)
  }
  formLoading.value = false
  closeModal()
}

// ─── Actions ─────────────────────────────────────────────────────────────────
async function handleEmit(id: string) {
  await emitQuote(id)
}

async function handleDelete(id: string) {
  if (!confirm('Supprimer ce devis ?')) return
  await deleteQuote(id)
}

async function handleConvert(id: string) {
  const invoiceId = await convertToInvoice(id)
  if (invoiceId) {
    router.push(`/invoices/${invoiceId}`)
  }
}

// ─── Tabs & filtering ────────────────────────────────────────────────────────
const activeTab = ref<QuoteStatus | 'ALL'>('ALL')

const tabs: { key: QuoteStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Tous' },
  { key: 'DRAFT', label: 'Brouillons' },
  { key: 'SENT', label: 'Envoyés' },
  { key: 'ACCEPTED', label: 'Acceptés' },
  { key: 'REFUSED', label: 'Refusés' },
  { key: 'EXPIRED', label: 'Expirés' },
]

const search = ref('')

const filteredQuotes = computed(() => {
  let result = activeTab.value === 'ALL' ? quotes.value : quotes.value.filter((q) => q.status === activeTab.value)
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    result = result.filter(
      (quote) =>
        quote.number?.toLowerCase().includes(q) ||
        clientMap.value.get(quote.client_id)?.toLowerCase().includes(q),
    )
  }
  return result
})

// ─── Client name lookup ───────────────────────────────────────────────────────
const clientMap = computed(() => {
  const map = new Map<string, string>()
  for (const c of clients.value) map.set(c.id, c.name)
  return map
})

// ─── Table ────────────────────────────────────────────────────────────────────
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

const columns = [
  { key: 'number', label: 'N°', sortable: true },
  { key: 'client', label: 'Client' },
  { key: 'issue_date', label: 'Date', sortable: true },
  { key: 'valid_until', label: 'Validité', sortable: true },
  { key: 'subtotal', label: 'Montant HT', sortable: true },
  { key: 'status', label: 'Statut' },
  { key: 'actions', label: '' },
]

const tableRows = computed(() =>
  filteredQuotes.value.map((q) => ({ ...q, _id: q.id }))
)

onMounted(async () => {
  await Promise.all([fetchQuotes(), fetchClients()])
})
</script>

<template>
  <div class="space-y-5 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-[22px] font-bold text-[#111827]">Devis</h1>
        <p class="text-sm text-[#6B7280] mt-0.5">
          {{ quotes.length }} devis au total
        </p>
      </div>
      <Button variant="default" size="md" @click="openCreateModal">
        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
        Nouveau devis
      </Button>
    </div>

    <!-- Search -->
    <div class="relative max-w-xs">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
      </svg>
      <input
        v-model="search"
        type="search"
        placeholder="Rechercher un devis…"
        class="w-full h-9 pl-9 pr-3 rounded-md border border-[#E5E7EB] bg-white text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-[#7C3AED]"
      />
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
          {{ quotes.filter((q) => q.status === tab.key).length }}
        </span>
      </button>
    </div>

    <!-- Empty state -->
    <div
      v-if="!loading && filteredQuotes.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <div class="w-12 h-12 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-3">
        <svg class="h-6 w-6 text-[#9CA3AF]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p class="text-sm font-medium text-[#374151]">Aucun devis</p>
      <p class="text-xs text-[#9CA3AF] mt-1">
        {{ activeTab === 'ALL' ? 'Créez votre premier devis.' : 'Aucun devis avec ce statut.' }}
      </p>
      <Button v-if="activeTab === 'ALL'" variant="default" size="sm" class="mt-4" @click="openCreateModal">
        Nouveau devis
      </Button>
    </div>

    <!-- Table -->
    <DataTable v-else :columns="columns" :rows="tableRows" :loading="loading">
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
        <td class="px-4 py-3">
          <div class="flex items-center justify-end gap-2">
            <!-- DRAFT actions -->
            <template v-if="row.status === 'DRAFT'">
              <button
                class="text-xs font-medium text-[#7C3AED] hover:underline whitespace-nowrap"
                @click="handleEmit(row.id as string)"
              >
                Émettre
              </button>
              <span class="text-[#E5E7EB]">|</span>
              <button
                class="text-xs font-medium text-[#6B7280] hover:text-[#374151] hover:underline"
                @click="openEditModal(row.id as string)"
              >
                Modifier
              </button>
              <span class="text-[#E5E7EB]">|</span>
              <button
                class="text-xs font-medium text-[#DC2626] hover:underline"
                @click="handleDelete(row.id as string)"
              >
                Supprimer
              </button>
            </template>

            <!-- SENT actions -->
            <template v-else-if="row.status === 'SENT'">
              <button
                v-if="!row.converted_invoice_id"
                class="text-xs font-medium text-[#059669] hover:underline whitespace-nowrap"
                @click="handleConvert(row.id as string)"
              >
                Convertir en facture
              </button>
              <span v-else class="text-xs text-[#9CA3AF] italic">Converti</span>
            </template>

            <!-- ACCEPTED: link to converted invoice -->
            <template v-else-if="row.status === 'ACCEPTED'">
              <button
                v-if="row.converted_invoice_id"
                class="text-xs font-medium text-[#7C3AED] hover:underline whitespace-nowrap"
                @click="router.push(`/invoices/${row.converted_invoice_id}`)"
              >
                Voir la facture
              </button>
            </template>
          </div>
        </td>
      </template>
    </DataTable>

    <!-- Create / Edit modal -->
    <Modal
      v-model="showModal"
      :title="editingQuoteId ? 'Modifier le devis' : 'Nouveau devis'"
      size="lg"
    >
      <QuoteForm
        :clients="clients"
        :loading="formLoading"
        :initial-data="formInitialData"
        @submit="handleFormSubmit"
        @cancel="closeModal"
      />
    </Modal>
  </div>
</template>
