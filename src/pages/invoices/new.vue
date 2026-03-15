<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useInvoices } from '@/composables/useInvoices'
import { useClients } from '@/composables/useClients'
import type { InvoiceFormData } from '@/utils/validators'
import InvoiceForm from '@/components/invoices/InvoiceForm.vue'
import Button from '@/components/ui/Button.vue'

const router = useRouter()
const { createInvoice, loading } = useInvoices()
const { clients, fetchClients } = useClients()

async function handleSubmit(data: InvoiceFormData) {
  const invoice = await createInvoice(data)
  if (invoice) {
    router.push(`/invoices/${invoice.id}`)
  }
}

onMounted(() => fetchClients())
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
      <h1 class="text-[22px] font-bold text-[#111827]">Nouvelle facture</h1>
    </div>

    <div class="bg-white border border-[#E5E7EB] rounded-xl p-6">
      <InvoiceForm
        :clients="clients"
        :loading="loading"
        @submit="handleSubmit"
        @cancel="router.back()"
      />
    </div>
  </div>
</template>
