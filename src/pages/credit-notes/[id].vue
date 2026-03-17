<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCreditNotes } from '@/composables/useCreditNotes'
import { useClients } from '@/composables/useClients'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/utils/formatters'
import type { CreditNote, CreditNoteLine, Client } from '@/lib/types'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'

const route = useRoute()
const router = useRouter()
const creditNoteId = computed(() => route.params.id as string)

const { getCreditNote, emitCreditNote, deleteCreditNote } = useCreditNotes()
const { getClient } = useClients()

const loading = ref(true)
const error = ref<string | null>(null)
const creditNote = ref<CreditNote | null>(null)
const lines = ref<CreditNoteLine[]>([])
const client = ref<Client | null>(null)
const emitting = ref(false)
const deleting = ref(false)

async function load() {
  loading.value = true
  error.value = null
  const result = await getCreditNote(creditNoteId.value)
  if (!result) {
    error.value = 'Avoir introuvable'
    loading.value = false
    return
  }
  creditNote.value = result.creditNote
  lines.value = result.lines

  // Fetch the original invoice to get the client_id
  const { data: invoice } = await supabase
    .from('invoices')
    .select('client_id')
    .eq('id', result.creditNote.original_invoice_id)
    .single()

  if (invoice?.client_id) {
    client.value = await getClient(invoice.client_id)
  }

  loading.value = false
}

async function handleEmit() {
  if (!creditNote.value) return
  emitting.value = true
  const result = await emitCreditNote(creditNote.value.id)
  emitting.value = false
  if (result) {
    await load()
  }
}

async function handleDelete() {
  if (!creditNote.value) return
  if (!confirm('Supprimer cet avoir brouillon ?')) return
  deleting.value = true
  const ok = await deleteCreditNote(creditNote.value.id)
  deleting.value = false
  if (ok) {
    router.push('/credit-notes')
  }
}

const subtotal = computed(() => lines.value.reduce((sum, l) => sum + l.amount, 0))

onMounted(load)
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-5">
    <!-- Back -->
    <button
      class="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#374151] transition-colors"
      @click="router.back()"
    >
      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
      </svg>
      Retour aux avoirs
    </button>

    <!-- Loading -->
    <template v-if="loading">
      <div class="space-y-4">
        <div class="h-10 w-48 bg-[#F3F4F6] rounded animate-pulse" />
        <div class="h-48 bg-[#F3F4F6] rounded-xl animate-pulse" />
      </div>
    </template>

    <!-- Error -->
    <template v-else-if="error">
      <div class="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-6 text-center">
        <p class="text-sm font-medium text-[#DC2626]">{{ error }}</p>
        <Button variant="outline" size="sm" class="mt-3" @click="router.push('/credit-notes')">
          Retour aux avoirs
        </Button>
      </div>
    </template>

    <template v-else-if="creditNote">
      <!-- Header -->
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-[22px] font-bold text-[#111827] font-mono">
              {{ creditNote.number ?? 'Avoir brouillon' }}
            </h1>
            <Badge :variant="creditNote.status === 'SENT' ? 'outline' : 'secondary'">
              {{ creditNote.status === 'SENT' ? 'Émis' : 'Brouillon' }}
            </Badge>
          </div>
          <p class="text-sm text-[#6B7280] mt-1">
            Émis le {{ formatDate(creditNote.issue_date) }}
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <Button
            v-if="creditNote.status === 'DRAFT'"
            variant="default"
            size="md"
            :loading="emitting"
            @click="handleEmit"
          >
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
            Émettre l'avoir
          </Button>
          <Button
            v-if="creditNote.status === 'DRAFT'"
            variant="outline"
            size="md"
            :loading="deleting"
            @click="handleDelete"
          >
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            Supprimer
          </Button>
          <Button
            variant="ghost"
            size="md"
            @click="router.push(`/invoices/${creditNote.original_invoice_id}`)"
          >
            Voir la facture originale
          </Button>
        </div>
      </div>

      <!-- Info grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Client">
          <template v-if="client">
            <p class="font-semibold text-[#111827]">{{ client.name }}</p>
            <p class="text-sm text-[#6B7280] mt-0.5">{{ client.address }}</p>
            <p class="text-sm text-[#6B7280]">{{ client.postal_code }} {{ client.city }}</p>
          </template>
          <template v-else>
            <p class="text-sm text-[#9CA3AF]">Client non trouvé</p>
          </template>
        </Card>

        <Card title="Détails">
          <dl class="space-y-2">
            <div class="flex justify-between text-sm">
              <dt class="text-[#6B7280]">Facture originale</dt>
              <dd>
                <button
                  class="text-[#7C3AED] hover:underline font-mono text-sm"
                  @click="router.push(`/invoices/${creditNote.original_invoice_id}`)"
                >
                  Voir
                </button>
              </dd>
            </div>
            <div v-if="creditNote.reason" class="flex justify-between text-sm">
              <dt class="text-[#6B7280]">Motif</dt>
              <dd class="text-[#374151] font-medium max-w-xs text-right">{{ creditNote.reason }}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <!-- Lines -->
      <Card title="Lignes">
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
                <td class="py-3 text-right font-mono tabular-nums font-semibold text-[#DC2626]">{{ formatCurrency(line.amount) }}</td>
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
          <div v-if="creditNote.vat_rate > 0" class="flex justify-between text-sm">
            <span class="text-[#6B7280]">TVA ({{ (creditNote.vat_rate * 100).toFixed(0) }} %)</span>
            <span class="font-mono tabular-nums text-[#374151]">{{ formatCurrency(creditNote.vat_amount) }}</span>
          </div>
          <div v-else class="flex justify-between text-sm">
            <span class="text-[#6B7280] italic text-xs">TVA non applicable</span>
          </div>
          <div class="flex justify-between text-base font-bold border-t border-[#E5E7EB] pt-2">
            <span class="text-[#111827]">Total TTC</span>
            <span class="font-mono tabular-nums text-[#DC2626]">{{ formatCurrency(creditNote.total) }}</span>
          </div>
        </div>
      </Card>
    </template>
  </div>
</template>
