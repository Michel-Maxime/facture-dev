<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useClients } from '@/composables/useClients'
import { useInvoices } from '@/composables/useInvoices'
import { formatCurrency, formatDate, formatPhone, formatSiret } from '@/utils/formatters'
import type { Client, Invoice } from '@/lib/types'
import type { ClientFormData } from '@/utils/validators'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import Modal from '@/components/ui/Modal.vue'
import InvoiceStatusBadge from '@/components/invoices/InvoiceStatusBadge.vue'
import ClientForm from '@/components/clients/ClientForm.vue'

const route = useRoute()
const router = useRouter()
const clientId = computed(() => route.params.id as string)

const { getClient, updateClient } = useClients()
const { invoices, fetchInvoices } = useInvoices()

const loading = ref(true)
const error = ref<string | null>(null)
const client = ref<Client | null>(null)
const showEditModal = ref(false)
const editLoading = ref(false)

const clientInvoices = computed(() =>
  invoices.value.filter((i) => i.client_id === clientId.value)
)

const totalBilled = computed(() =>
  clientInvoices.value.reduce((sum, i) => sum + i.total, 0)
)

async function load() {
  loading.value = true
  error.value = null
  const result = await getClient(clientId.value)
  if (!result) {
    error.value = 'Client introuvable'
    loading.value = false
    return
  }
  client.value = result
  await fetchInvoices()
  loading.value = false
}

async function handleEditSubmit(formData: ClientFormData) {
  editLoading.value = true
  const updated = await updateClient(clientId.value, formData)
  editLoading.value = false
  if (updated) {
    client.value = updated
    showEditModal.value = false
  }
}

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
      Retour aux clients
    </button>

    <!-- Loading -->
    <template v-if="loading">
      <div class="h-8 w-48 bg-[#F3F4F6] rounded animate-pulse" />
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="h-40 bg-[#F3F4F6] rounded-xl animate-pulse" />
        <div class="h-40 bg-[#F3F4F6] rounded-xl animate-pulse" />
      </div>
    </template>

    <!-- Error -->
    <template v-else-if="error">
      <div class="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-6 text-center">
        <p class="text-sm font-medium text-[#DC2626]">{{ error }}</p>
        <Button variant="outline" size="sm" class="mt-3" @click="router.push('/clients')">
          Retour aux clients
        </Button>
      </div>
    </template>

    <template v-else-if="client">
      <!-- Header -->
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-[22px] font-bold text-[#111827]">{{ client.name }}</h1>
            <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#6B7280]">
              {{ client.type === 'PROFESSIONAL' ? 'Professionnel' : 'Particulier' }}
            </span>
          </div>
          <p class="text-sm text-[#6B7280] mt-0.5">
            Client depuis le {{ formatDate(client.created_at) }}
          </p>
        </div>
        <Button variant="outline" size="md" @click="showEditModal = true">
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
          Modifier
        </Button>
      </div>

      <!-- Info grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Contact info -->
        <Card title="Coordonnées">
          <dl class="space-y-2.5">
            <div>
              <dt class="text-xs text-[#9CA3AF] uppercase tracking-wide">Adresse</dt>
              <dd class="text-sm text-[#374151] mt-0.5">
                {{ client.address }}<br />{{ client.postal_code }} {{ client.city }}
              </dd>
            </div>
            <div v-if="client.email">
              <dt class="text-xs text-[#9CA3AF] uppercase tracking-wide">Email</dt>
              <dd class="text-sm text-[#374151] mt-0.5">
                <a :href="`mailto:${client.email}`" class="hover:text-[#7C3AED] transition-colors">
                  {{ client.email }}
                </a>
              </dd>
            </div>
            <div v-if="client.phone">
              <dt class="text-xs text-[#9CA3AF] uppercase tracking-wide">Téléphone</dt>
              <dd class="text-sm text-[#374151] mt-0.5">{{ formatPhone(client.phone) }}</dd>
            </div>
            <div v-if="client.siret">
              <dt class="text-xs text-[#9CA3AF] uppercase tracking-wide">SIRET</dt>
              <dd class="text-sm font-mono text-[#374151] mt-0.5">{{ formatSiret(client.siret) }}</dd>
            </div>
          </dl>
        </Card>

        <!-- Stats -->
        <Card title="Statistiques">
          <dl class="space-y-3">
            <div class="flex justify-between items-center">
              <dt class="text-sm text-[#6B7280]">Factures émises</dt>
              <dd class="font-mono font-semibold text-[#111827] tabular-nums">
                {{ clientInvoices.length }}
              </dd>
            </div>
            <div class="flex justify-between items-center">
              <dt class="text-sm text-[#6B7280]">Total facturé</dt>
              <dd class="font-mono font-semibold text-[#7C3AED] tabular-nums">
                {{ formatCurrency(totalBilled) }}
              </dd>
            </div>
            <div class="flex justify-between items-center">
              <dt class="text-sm text-[#6B7280]">Factures payées</dt>
              <dd class="font-mono font-semibold text-[#059669] tabular-nums">
                {{ clientInvoices.filter(i => i.status === 'PAID').length }}
              </dd>
            </div>
            <div class="flex justify-between items-center">
              <dt class="text-sm text-[#6B7280]">En attente</dt>
              <dd class="font-mono font-semibold text-[#D97706] tabular-nums">
                {{ clientInvoices.filter(i => i.status === 'SENT' || i.status === 'OVERDUE').length }}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <!-- Notes -->
      <Card v-if="client.notes" title="Notes">
        <p class="text-sm text-[#374151] whitespace-pre-line">{{ client.notes }}</p>
      </Card>

      <!-- Invoice history -->
      <Card title="Historique des factures">
        <template v-if="clientInvoices.length === 0">
          <div class="flex flex-col items-center justify-center py-6 gap-2">
            <svg class="h-7 w-7 text-[#D1D5DB]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p class="text-sm text-[#9CA3AF]">Aucune facture pour ce client</p>
          </div>
        </template>
        <template v-else>
          <div class="overflow-x-auto -mx-6 px-6">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-[#E5E7EB]">
                  <th class="pb-2 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wide">N°</th>
                  <th class="pb-2 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wide">Date</th>
                  <th class="pb-2 text-right text-xs font-medium text-[#6B7280] uppercase tracking-wide">Montant TTC</th>
                  <th class="pb-2 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wide">Statut</th>
                  <th class="pb-2" />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="inv in clientInvoices"
                  :key="inv.id"
                  class="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                  @click="router.push(`/invoices/${inv.id}`)"
                >
                  <td class="py-3 font-mono text-xs font-semibold text-[#7C3AED]">{{ inv.number ?? '—' }}</td>
                  <td class="py-3 text-[#374151]">{{ formatDate(inv.issue_date) }}</td>
                  <td class="py-3 text-right font-mono tabular-nums font-semibold text-[#111827]">
                    {{ formatCurrency(inv.total) }}
                  </td>
                  <td class="py-3">
                    <InvoiceStatusBadge :status="inv.status" />
                  </td>
                  <td class="py-3 text-right">
                    <span class="text-xs text-[#7C3AED] font-medium">Voir</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </Card>
    </template>

    <!-- Edit modal -->
    <Modal
      v-model="showEditModal"
      title="Modifier le client"
      size="lg"
    >
      <ClientForm
        :client="client"
        :loading="editLoading"
        @submit="handleEditSubmit"
        @cancel="showEditModal = false"
      />
    </Modal>
  </div>
</template>
