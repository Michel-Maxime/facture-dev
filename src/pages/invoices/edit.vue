<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInvoices } from '@/composables/useInvoices'
import { useClients } from '@/composables/useClients'
import type { InvoiceFormData } from '@/utils/validators'
import InvoiceForm from '@/components/invoices/InvoiceForm.vue'

const route = useRoute()
const router = useRouter()
const invoiceId = computed(() => route.params.id as string)

const { getInvoice, updateInvoiceFull, loading } = useInvoices()
const { clients, fetchClients } = useClients()

const initialData = ref<Partial<InvoiceFormData> | undefined>(undefined)
const loadError = ref<string | null>(null)

async function load() {
  const result = await getInvoice(invoiceId.value)
  if (!result) {
    loadError.value = 'Facture introuvable'
    return
  }
  if (result.invoice.status !== 'DRAFT') {
    loadError.value = 'Seuls les brouillons peuvent être modifiés'
    return
  }
  initialData.value = {
    client_id: result.invoice.client_id,
    issue_date: result.invoice.issue_date,
    service_date: result.invoice.service_date,
    due_date: result.invoice.due_date,
    payment_term_days: result.invoice.payment_term_days,
    payment_method: result.invoice.payment_method,
    vat_rate: result.invoice.vat_rate,
    notes: result.invoice.notes ?? '',
    lines: result.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unit_price,
      amount: l.amount,
      sort_order: l.sort_order,
    })),
  }
}

async function handleSubmit(data: InvoiceFormData) {
  const updated = await updateInvoiceFull(invoiceId.value, data)
  if (updated) {
    router.push(`/invoices/${invoiceId.value}`)
  }
}

onMounted(() => {
  fetchClients()
  load()
})
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-5">
    <div class="flex items-center gap-3">
      <button
        class="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#374151] transition-colors"
        @click="router.back()"
      >
        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
        Retour
      </button>
      <h1 class="text-[22px] font-bold text-[#111827]">Modifier la facture</h1>
    </div>

    <div v-if="loadError" class="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-6 text-center">
      <p class="text-sm font-medium text-[#DC2626]">{{ loadError }}</p>
    </div>

    <div v-else-if="initialData" class="bg-white border border-[#E5E7EB] rounded-xl p-6">
      <InvoiceForm
        :clients="clients"
        :loading="loading"
        :initial-data="initialData"
        @submit="handleSubmit"
        @cancel="router.back()"
      />
    </div>

    <div v-else class="space-y-4">
      <div class="h-10 w-48 bg-[#F3F4F6] rounded animate-pulse" />
      <div class="h-48 bg-[#F3F4F6] rounded-xl animate-pulse" />
    </div>
  </div>
</template>
