<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRecurringInvoices } from '@/composables/useRecurringInvoices'
import { useClients } from '@/composables/useClients'
import { useAuthStore } from '@/stores/auth'
import { formatDate, formatCurrency } from '@/utils/formatters'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
import Modal from '@/components/ui/Modal.vue'
import Input from '@/components/ui/Input.vue'
import type { Database } from '@/lib/types'

type RecurringSchedule = Database['public']['Tables']['recurring_schedules']['Row']

const authStore = useAuthStore()
const {
  schedules, loading,
  fetchSchedules, createSchedule, updateSchedule, deleteSchedule, toggleActive, generateNow,
} = useRecurringInvoices()
const { clients, fetchClients } = useClients()

onMounted(async () => {
  await Promise.all([fetchSchedules(), fetchClients()])
})

// ── Create/Edit modal ─────────────────────────────────────────────────
const showModal = ref(false)
const editingSchedule = ref<RecurringSchedule | null>(null)
const saving = ref(false)

// Form state
const form = ref({
  client_id: '',
  frequency: 'MONTHLY' as 'MONTHLY' | 'QUARTERLY',
  day_of_month: 1,
  payment_term_days: 30,
  payment_method: 'Virement bancaire',
  vat_rate: authStore.profile?.vat_regime === 'SUBJECT' ? 0.20 : 0,
  notes: '',
  lines: [{ description: '', quantity: 1, unit_price: 0, amount: 0, sort_order: 0 }],
})

function openCreate() {
  editingSchedule.value = null
  form.value = {
    client_id: '',
    frequency: 'MONTHLY',
    day_of_month: 1,
    payment_term_days: 30,
    payment_method: 'Virement bancaire',
    vat_rate: authStore.profile?.vat_regime === 'SUBJECT' ? 0.20 : 0,
    notes: '',
    lines: [{ description: '', quantity: 1, unit_price: 0, amount: 0, sort_order: 0 }],
  }
  showModal.value = true
}

function openEdit(schedule: RecurringSchedule) {
  editingSchedule.value = schedule
  form.value = {
    client_id: schedule.client_id,
    frequency: schedule.frequency,
    day_of_month: schedule.day_of_month,
    payment_term_days: schedule.payment_term_days,
    payment_method: schedule.payment_method,
    vat_rate: Number(schedule.vat_rate),
    notes: schedule.notes ?? '',
    lines: (schedule.template_lines as any[]).length > 0
      ? (schedule.template_lines as any[])
      : [{ description: '', quantity: 1, unit_price: 0, amount: 0, sort_order: 0 }],
  }
  showModal.value = true
}

function updateLineAmount(index: number) {
  const line = form.value.lines[index]
  line.amount = Math.round(line.quantity * line.unit_price * 100) / 100
}

function addLine() {
  form.value.lines.push({
    description: '', quantity: 1, unit_price: 0, amount: 0,
    sort_order: form.value.lines.length,
  })
}

function removeLine(index: number) {
  form.value.lines.splice(index, 1)
}

async function handleSave() {
  saving.value = true
  if (editingSchedule.value) {
    await updateSchedule(editingSchedule.value.id, {
      client_id: form.value.client_id,
      frequency: form.value.frequency,
      day_of_month: form.value.day_of_month,
      payment_term_days: form.value.payment_term_days,
      payment_method: form.value.payment_method,
      vat_rate: form.value.vat_rate,
      notes: form.value.notes,
      template_lines: form.value.lines,
    })
  } else {
    await createSchedule({
      client_id: form.value.client_id,
      frequency: form.value.frequency,
      day_of_month: form.value.day_of_month,
      payment_term_days: form.value.payment_term_days,
      payment_method: form.value.payment_method,
      vat_rate: form.value.vat_rate,
      notes: form.value.notes,
      template_lines: form.value.lines,
    })
  }
  saving.value = false
  showModal.value = false
}

// ── Actions ─────────────────────────────────────────────────────────
const generating = ref<string | null>(null)

async function handleGenerateNow(id: string) {
  generating.value = id
  await generateNow(id)
  generating.value = null
}

async function handleDelete(id: string) {
  if (!confirm('Supprimer ce modèle récurrent ?')) return
  await deleteSchedule(id)
}

function clientName(clientId: string): string {
  return clients.value.find((c) => c.id === clientId)?.name ?? '—'
}

function subtotal(schedule: RecurringSchedule): number {
  return (schedule.template_lines as any[]).reduce((sum, l) => sum + l.amount, 0)
}

const frequencyOptions = [
  { value: 'MONTHLY', label: 'Mensuelle' },
  { value: 'QUARTERLY', label: 'Trimestrielle' },
]

const paymentMethods = [
  'Virement bancaire', 'Chèque', 'Espèces', 'Carte bancaire', 'PayPal', 'Autre',
]
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-[22px] font-bold text-[#111827]">Récurrentes</h1>
        <p class="text-sm text-[#6B7280] mt-0.5">
          Modèles de factures générés automatiquement
        </p>
      </div>
      <Button variant="default" size="md" @click="openCreate">
        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
        Nouveau modèle
      </Button>
    </div>

    <!-- Loading -->
    <template v-if="loading">
      <div class="space-y-3">
        <div v-for="i in 3" :key="i" class="h-20 bg-[#F3F4F6] rounded-xl animate-pulse" />
      </div>
    </template>

    <!-- Empty state -->
    <template v-else-if="schedules.length === 0">
      <Card>
        <div class="py-12 text-center">
          <svg class="mx-auto h-12 w-12 text-[#D1D5DB]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <h3 class="mt-3 text-sm font-semibold text-[#111827]">Aucun modèle récurrent</h3>
          <p class="mt-1 text-sm text-[#6B7280]">
            Créez un modèle pour générer automatiquement vos factures mensuelles ou trimestrielles.
          </p>
          <Button variant="default" size="sm" class="mt-4" @click="openCreate">
            Créer un modèle
          </Button>
        </div>
      </Card>
    </template>

    <!-- Schedule list -->
    <template v-else>
      <div class="space-y-3">
        <Card
          v-for="schedule in schedules"
          :key="schedule.id"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-semibold text-[#111827]">{{ clientName(schedule.client_id) }}</span>
                <Badge :variant="schedule.frequency === 'MONTHLY' ? 'default' : 'outline'">
                  {{ schedule.frequency === 'MONTHLY' ? 'Mensuelle' : 'Trimestrielle' }}
                </Badge>
                <Badge :variant="schedule.is_active ? 'success' : 'secondary'">
                  {{ schedule.is_active ? 'Actif' : 'Inactif' }}
                </Badge>
              </div>
              <div class="mt-1 flex items-center gap-4 text-sm text-[#6B7280]">
                <span>
                  Prochaine génération :
                  <span class="font-medium text-[#374151]">{{ formatDate(schedule.next_run_date) }}</span>
                </span>
                <span>
                  Montant HT :
                  <span class="font-mono font-medium text-[#374151]">{{ formatCurrency(subtotal(schedule)) }}</span>
                </span>
                <span>Le {{ schedule.day_of_month }} du mois</span>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                :loading="generating === schedule.id"
                @click="handleGenerateNow(schedule.id)"
              >
                Générer maintenant
              </Button>
              <button
                class="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors"
                :title="schedule.is_active ? 'Désactiver' : 'Activer'"
                @click="toggleActive(schedule.id)"
              >
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button
                class="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors"
                title="Modifier"
                @click="openEdit(schedule)"
              >
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
              <button
                class="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                title="Supprimer"
                @click="handleDelete(schedule.id)"
              >
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </Card>
      </div>
    </template>

    <!-- Create/Edit modal -->
    <Modal
      v-model="showModal"
      :title="editingSchedule ? 'Modifier le modèle' : 'Nouveau modèle récurrent'"
      size="lg"
    >
      <div class="space-y-4">
        <!-- Client -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-[#374151]">Client <span class="text-[#DC2626]">*</span></label>
          <select
            v-model="form.client_id"
            class="w-full h-9 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
          >
            <option value="" disabled>Sélectionner un client</option>
            <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>

        <!-- Frequency + Day -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-[#374151]">Fréquence</label>
            <select
              v-model="form.frequency"
              class="w-full h-9 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            >
              <option v-for="opt in frequencyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <Input
            v-model.number="form.day_of_month"
            label="Jour du mois (1-28)"
            type="number"
            min="1"
            max="28"
          />
        </div>

        <!-- Payment -->
        <div class="grid grid-cols-2 gap-4">
          <Input
            v-model.number="form.payment_term_days"
            label="Délai de paiement (jours)"
            type="number"
          />
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-[#374151]">Mode de règlement</label>
            <select
              v-model="form.payment_method"
              class="w-full h-9 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            >
              <option v-for="m in paymentMethods" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
        </div>

        <!-- Lines -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium text-[#374151]">Prestations</label>
            <button
              type="button"
              class="text-xs text-[#7C3AED] hover:underline"
              @click="addLine"
            >
              + Ajouter une ligne
            </button>
          </div>
          <div
            v-for="(line, idx) in form.lines"
            :key="idx"
            class="grid grid-cols-12 gap-2 items-end"
          >
            <div class="col-span-5">
              <Input v-model="line.description" :label="idx === 0 ? 'Description' : ''" placeholder="Ex: Développement web" />
            </div>
            <div class="col-span-2">
              <Input
                v-model.number="line.quantity"
                :label="idx === 0 ? 'Qté' : ''"
                type="number"
                min="0"
                step="0.5"
                @input="updateLineAmount(idx)"
              />
            </div>
            <div class="col-span-3">
              <Input
                v-model.number="line.unit_price"
                :label="idx === 0 ? 'P.U. HT' : ''"
                type="number"
                min="0"
                step="0.01"
                @input="updateLineAmount(idx)"
              />
            </div>
            <div class="col-span-1">
              <p class="text-xs text-[#6B7280] font-mono tabular-nums text-right pt-5">
                {{ formatCurrency(line.amount) }}
              </p>
            </div>
            <div class="col-span-1 flex justify-end">
              <button
                v-if="form.lines.length > 1"
                type="button"
                class="p-1 text-[#9CA3AF] hover:text-[#DC2626] mt-5"
                @click="removeLine(idx)"
              >
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <Input v-model="form.notes" label="Notes (facultatif)" placeholder="Visible sur la facture" />
      </div>

      <template #footer>
        <Button variant="ghost" @click="showModal = false">Annuler</Button>
        <Button
          variant="default"
          :loading="saving"
          :disabled="!form.client_id || form.lines.every(l => !l.description)"
          @click="handleSave"
        >
          {{ editingSchedule ? 'Enregistrer' : 'Créer le modèle' }}
        </Button>
      </template>
    </Modal>
  </div>
</template>
