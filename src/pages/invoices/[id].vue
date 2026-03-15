<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInvoices } from '@/composables/useInvoices'
import { usePayments } from '@/composables/usePayments'
import { usePdf } from '@/composables/usePdf'
import { useClients } from '@/composables/useClients'
import { useAuthStore } from '@/stores/auth'
import { formatCurrency, formatDate } from '@/utils/formatters'
import type { Invoice, InvoiceLine, Client, Payment } from '@/lib/types'
import type { PdfInvoiceData } from '@/utils/pdf-template'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import Modal from '@/components/ui/Modal.vue'
import InvoiceStatusBadge from '@/components/invoices/InvoiceStatusBadge.vue'
import Input from '@/components/ui/Input.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { getInvoice, emitInvoice } = useInvoices()
const { payments, loading: paymentsLoading, fetchPayments, recordPayment } = usePayments()
const { downloadPdf } = usePdf()
const { getClient } = useClients()

const invoiceId = computed(() => route.params.id as string)

const loading = ref(true)
const error = ref<string | null>(null)
const invoice = ref<Invoice | null>(null)
const lines = ref<InvoiceLine[]>([])
const client = ref<Client | null>(null)

const emitting = ref(false)

async function handleEmitInvoice() {
  if (!invoice.value) return
  emitting.value = true
  const result = await emitInvoice(invoice.value.id)
  emitting.value = false
  if (result) {
    await load()
  }
}

const showPaymentModal = ref(false)
const paymentLoading = ref(false)
const paymentDate = ref(new Date().toISOString().slice(0, 10))
const paymentMethod = ref('virement')
const paymentReference = ref('')

const paymentMethods = [
  'Virement bancaire',
  'Chèque',
  'Espèces',
  'Carte bancaire',
  'PayPal',
  'Autre',
]

async function load() {
  loading.value = true
  error.value = null
  const result = await getInvoice(invoiceId.value)
  if (!result) {
    error.value = 'Facture introuvable'
    loading.value = false
    return
  }
  invoice.value = result.invoice
  lines.value = result.lines
  if (result.invoice.client_id) {
    client.value = await getClient(result.invoice.client_id)
  }
  if (result.invoice.status === 'SENT' || result.invoice.status === 'PAID') {
    await fetchPayments(invoiceId.value)
  }
  loading.value = false
}

async function handleRecordPayment() {
  if (!invoice.value) return
  paymentLoading.value = true
  const result = await recordPayment(
    invoice.value.id,
    invoice.value.total,
    paymentDate.value,
    paymentMethod.value,
    paymentReference.value || undefined,
  )
  paymentLoading.value = false
  if (result) {
    showPaymentModal.value = false
    await load()
  }
}

function handleDownloadPdf() {
  if (!invoice.value || !client.value || !authStore.profile) return
  const data: PdfInvoiceData = {
    invoice: invoice.value,
    lines: lines.value,
    client: client.value,
    profile: authStore.profile,
  }
  downloadPdf(data)
}

const subtotal = computed(() => lines.value.reduce((sum, l) => sum + l.amount, 0))

onMounted(load)
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-5">
    <!-- Back button -->
    <button
      class="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#374151] transition-colors"
      @click="router.back()"
    >
      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
      </svg>
      Retour aux factures
    </button>

    <!-- Loading -->
    <template v-if="loading">
      <div class="space-y-4">
        <div class="h-10 w-48 bg-[#F3F4F6] rounded animate-pulse" />
        <div class="h-48 bg-[#F3F4F6] rounded-xl animate-pulse" />
        <div class="h-64 bg-[#F3F4F6] rounded-xl animate-pulse" />
      </div>
    </template>

    <!-- Error -->
    <template v-else-if="error">
      <div class="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-6 text-center">
        <p class="text-sm font-medium text-[#DC2626]">{{ error }}</p>
        <Button variant="outline" size="sm" class="mt-3" @click="router.push('/invoices')">
          Retour aux factures
        </Button>
      </div>
    </template>

    <template v-else-if="invoice">
      <!-- Header -->
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-[22px] font-bold text-[#111827] font-mono">
              {{ invoice.number ?? 'Brouillon' }}
            </h1>
            <InvoiceStatusBadge :status="invoice.status" />
          </div>
          <p class="text-sm text-[#6B7280] mt-1">
            Émise le {{ formatDate(invoice.issue_date) }} · Échéance le {{ formatDate(invoice.due_date) }}
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <Button
            v-if="invoice.status === 'DRAFT'"
            variant="default"
            size="md"
            :loading="emitting"
            @click="handleEmitInvoice"
          >
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
            Émettre la facture
          </Button>
          <Button
            v-if="invoice.status === 'SENT'"
            variant="default"
            size="md"
            @click="showPaymentModal = true"
          >
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
            </svg>
            Enregistrer le paiement
          </Button>
          <Button variant="outline" size="md" @click="handleDownloadPdf">
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clip-rule="evenodd" />
            </svg>
            Télécharger PDF
          </Button>
        </div>
      </div>

      <!-- Invoice details grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Client info -->
        <Card title="Client">
          <template v-if="client">
            <p class="font-semibold text-[#111827]">{{ client.name }}</p>
            <p class="text-sm text-[#6B7280] mt-0.5">{{ client.address }}</p>
            <p class="text-sm text-[#6B7280]">{{ client.postal_code }} {{ client.city }}</p>
            <p v-if="client.siret" class="text-xs text-[#9CA3AF] mt-1 font-mono">
              SIRET {{ client.siret }}
            </p>
            <p v-if="client.email" class="text-sm text-[#374151] mt-1">{{ client.email }}</p>
          </template>
          <template v-else>
            <p class="text-sm text-[#9CA3AF]">Client non trouvé</p>
          </template>
        </Card>

        <!-- Invoice metadata -->
        <Card title="Détails">
          <dl class="space-y-2">
            <div class="flex justify-between text-sm">
              <dt class="text-[#6B7280]">Date de prestation</dt>
              <dd class="text-[#374151] font-medium">{{ formatDate(invoice.service_date) }}</dd>
            </div>
            <div class="flex justify-between text-sm">
              <dt class="text-[#6B7280]">Mode de règlement</dt>
              <dd class="text-[#374151] font-medium">{{ invoice.payment_method }}</dd>
            </div>
            <div class="flex justify-between text-sm">
              <dt class="text-[#6B7280]">Délai de paiement</dt>
              <dd class="text-[#374151] font-medium">{{ invoice.payment_term_days }} jours</dd>
            </div>
            <div v-if="invoice.vat_rate > 0" class="flex justify-between text-sm">
              <dt class="text-[#6B7280]">Taux TVA</dt>
              <dd class="text-[#374151] font-mono font-medium tabular-nums">
                {{ (invoice.vat_rate * 100).toFixed(0) }} %
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <!-- Line items -->
      <Card title="Prestations">
        <div class="overflow-x-auto -mx-6 px-6">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-[#E5E7EB]">
                <th class="pb-2 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wide">Description</th>
                <th class="pb-2 text-right text-xs font-medium text-[#6B7280] uppercase tracking-wide">Qté</th>
                <th class="pb-2 text-right text-xs font-medium text-[#6B7280] uppercase tracking-wide">P.U. HT</th>
                <th class="pb-2 text-right text-xs font-medium text-[#6B7280] uppercase tracking-wide">Montant HT</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="line in lines"
                :key="line.id"
                class="border-b border-[#F3F4F6] last:border-0"
              >
                <td class="py-3 text-[#374151]">{{ line.description }}</td>
                <td class="py-3 text-right font-mono tabular-nums text-[#374151]">{{ line.quantity }}</td>
                <td class="py-3 text-right font-mono tabular-nums text-[#374151]">{{ formatCurrency(line.unit_price) }}</td>
                <td class="py-3 text-right font-mono tabular-nums font-semibold text-[#111827]">{{ formatCurrency(line.amount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Totals -->
        <div class="mt-4 border-t border-[#E5E7EB] pt-4 space-y-2 max-w-xs ml-auto">
          <div class="flex justify-between text-sm">
            <span class="text-[#6B7280]">Sous-total HT</span>
            <span class="font-mono tabular-nums text-[#374151]">{{ formatCurrency(subtotal) }}</span>
          </div>
          <div v-if="invoice.vat_rate > 0" class="flex justify-between text-sm">
            <span class="text-[#6B7280]">TVA ({{ (invoice.vat_rate * 100).toFixed(0) }} %)</span>
            <span class="font-mono tabular-nums text-[#374151]">{{ formatCurrency(invoice.vat_amount) }}</span>
          </div>
          <div v-else class="flex justify-between text-sm">
            <span class="text-[#6B7280] italic text-xs">TVA non applicable</span>
          </div>
          <div class="flex justify-between text-base font-bold border-t border-[#E5E7EB] pt-2">
            <span class="text-[#111827]">Total TTC</span>
            <span class="font-mono tabular-nums text-[#7C3AED]">{{ formatCurrency(invoice.total) }}</span>
          </div>
        </div>
      </Card>

      <!-- Notes -->
      <Card v-if="invoice.notes" title="Notes">
        <p class="text-sm text-[#374151] whitespace-pre-line">{{ invoice.notes }}</p>
      </Card>

      <!-- Payments history -->
      <Card
        v-if="payments.length > 0 || invoice.status === 'PAID'"
        title="Paiements"
      >
        <template v-if="paymentsLoading">
          <div class="h-10 bg-[#F3F4F6] rounded animate-pulse" />
        </template>
        <template v-else-if="payments.length === 0">
          <p class="text-sm text-[#9CA3AF]">Aucun paiement enregistré</p>
        </template>
        <template v-else>
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-[#E5E7EB]">
                <th class="pb-2 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wide">Date</th>
                <th class="pb-2 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wide">Mode</th>
                <th class="pb-2 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wide">Référence</th>
                <th class="pb-2 text-right text-xs font-medium text-[#6B7280] uppercase tracking-wide">Montant</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="payment in payments"
                :key="payment.id"
                class="border-b border-[#F3F4F6] last:border-0"
              >
                <td class="py-3 text-[#374151]">{{ formatDate(payment.date) }}</td>
                <td class="py-3 text-[#374151]">{{ payment.method }}</td>
                <td class="py-3 text-[#6B7280]">{{ payment.reference ?? '—' }}</td>
                <td class="py-3 text-right font-mono font-semibold text-[#059669] tabular-nums">
                  {{ formatCurrency(payment.amount) }}
                </td>
              </tr>
            </tbody>
          </table>
        </template>
      </Card>
    </template>

    <!-- Payment modal -->
    <Modal
      v-model="showPaymentModal"
      title="Enregistrer un paiement"
      description="Saisissez les informations du paiement reçu"
      size="sm"
    >
      <div class="space-y-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-[#374151]">Montant <span class="text-[#DC2626]">*</span></label>
          <p class="font-mono text-lg font-bold text-[#059669]">
            {{ invoice ? formatCurrency(invoice.total) : '—' }}
          </p>
        </div>

        <Input
          v-model="paymentDate"
          label="Date de paiement"
          type="date"
          required
        />

        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-[#374151]">Mode de paiement <span class="text-[#DC2626]">*</span></label>
          <select
            v-model="paymentMethod"
            class="w-full h-9 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-[#7C3AED]"
          >
            <option v-for="m in paymentMethods" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>

        <Input
          v-model="paymentReference"
          label="Référence (facultatif)"
          placeholder="Ex : REF-2026-001"
        />
      </div>

      <template #footer>
        <Button variant="ghost" @click="showPaymentModal = false">Annuler</Button>
        <Button variant="default" :loading="paymentLoading" @click="handleRecordPayment">
          Confirmer le paiement
        </Button>
      </template>
    </Modal>
  </div>
</template>
