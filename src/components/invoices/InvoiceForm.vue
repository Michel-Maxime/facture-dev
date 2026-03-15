<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useForm, useField, useFieldArray } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { invoiceSchema } from '@/utils/validators'
import type { Client } from '@/lib/types'
import type { InvoiceFormData } from '@/utils/validators'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'

const props = defineProps<{
  clients: Client[]
  loading?: boolean
  initialData?: Partial<InvoiceFormData>
}>()

const emit = defineEmits<{
  submit: [data: InvoiceFormData]
  cancel: []
}>()

const today = new Date().toISOString().slice(0, 10)
const in30Days = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)

const { handleSubmit, errors, setValues } = useForm({
  validationSchema: toTypedSchema(invoiceSchema),
  initialValues: {
    client_id: props.initialData?.client_id ?? '',
    issue_date: props.initialData?.issue_date ?? today,
    service_date: props.initialData?.service_date ?? today,
    due_date: props.initialData?.due_date ?? in30Days,
    payment_term_days: props.initialData?.payment_term_days ?? 30,
    payment_method: props.initialData?.payment_method ?? 'Virement bancaire',
    vat_rate: props.initialData?.vat_rate ?? 0,
    notes: props.initialData?.notes ?? '',
    lines: props.initialData?.lines ?? [
      { description: '', quantity: 1, unit_price: 0, amount: 0, sort_order: 0 },
    ],
  },
})

const { value: clientId } = useField<string>('client_id')
const { value: issueDate } = useField<string>('issue_date')
const { value: serviceDate } = useField<string>('service_date')
const { value: dueDate } = useField<string>('due_date')
const { value: paymentTermDays } = useField<number>('payment_term_days')
const { value: paymentMethod } = useField<string>('payment_method')
const { value: vatRate } = useField<number>('vat_rate')
const { value: notes } = useField<string>('notes')

const { fields: lines, push: addLine, remove: removeLine } = useFieldArray<{
  description: string
  quantity: number
  unit_price: number
  amount: number
  sort_order: number
}>('lines')

// Auto-calculate amount for each line
function updateLineAmount(index: number) {
  const line = lines.value[index]
  if (line) {
    const amount = (line.value.quantity ?? 0) * (line.value.unit_price ?? 0)
    lines.value[index].value.amount = Math.round(amount * 100) / 100
  }
}

// Auto-update due_date when issue_date or payment_term_days change
watch([issueDate, paymentTermDays], ([date, days]) => {
  if (date && days != null) {
    const d = new Date(date)
    d.setDate(d.getDate() + (days as number))
    dueDate.value = d.toISOString().slice(0, 10)
  }
})

const subtotal = computed(() =>
  lines.value.reduce((sum, l) => sum + (l.value.amount ?? 0), 0),
)
const vatAmount = computed(() => Math.round(subtotal.value * (vatRate.value ?? 0) * 100) / 100)
const total = computed(() => Math.round((subtotal.value + vatAmount.value) * 100) / 100)

const paymentMethods = [
  'Virement bancaire',
  'Chèque',
  'Espèces',
  'Carte bancaire',
  'PayPal',
  'Autre',
]

const vatOptions = [
  { label: 'Non assujetti (0 %)', value: 0 },
  { label: '5,5 %', value: 0.055 },
  { label: '10 %', value: 0.1 },
  { label: '20 %', value: 0.2 },
]

function appendLine() {
  push({
    description: '',
    quantity: 1,
    unit_price: 0,
    amount: 0,
    sort_order: lines.value.length,
  })
}

function push(line: { description: string; quantity: number; unit_price: number; amount: number; sort_order: number }) {
  addLine(line)
}

const onSubmit = handleSubmit((values) => {
  // Ensure amounts are up-to-date
  const processedLines = values.lines.map((l) => ({
    ...l,
    amount: Math.round(l.quantity * l.unit_price * 100) / 100,
  }))
  emit('submit', { ...values, lines: processedLines })
})
</script>

<template>
  <form class="space-y-6" @submit.prevent="onSubmit">
    <!-- Client -->
    <div class="flex flex-col gap-1.5">
      <label class="text-sm font-medium text-[#374151]">
        Client <span class="text-[#DC2626]">*</span>
      </label>
      <select
        v-model="clientId"
        class="w-full h-9 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-[#7C3AED]"
        :class="{ 'border-[#DC2626]': errors.client_id }"
      >
        <option value="">Sélectionner un client...</option>
        <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <p v-if="errors.client_id" class="text-xs text-[#DC2626]">{{ errors.client_id }}</p>
    </div>

    <!-- Dates row -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Input
        v-model="issueDate"
        label="Date d'émission"
        type="date"
        required
        :error="errors.issue_date"
      />
      <Input
        v-model="serviceDate"
        label="Date de prestation"
        type="date"
        required
        :error="errors.service_date"
      />
      <Input
        v-model="dueDate"
        label="Date d'échéance"
        type="date"
        required
        :error="errors.due_date"
      />
    </div>

    <!-- Payment row -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-[#374151]">Mode de paiement</label>
        <select
          v-model="paymentMethod"
          class="w-full h-9 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-[#7C3AED]"
        >
          <option v-for="m in paymentMethods" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>
      <Input
        v-model.number="paymentTermDays"
        label="Délai de paiement (jours)"
        type="number"
        min="0"
        :error="errors.payment_term_days"
      />
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-[#374151]">TVA</label>
        <select
          v-model.number="vatRate"
          class="w-full h-9 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-[#7C3AED]"
        >
          <option v-for="opt in vatOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Line items -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <label class="text-sm font-medium text-[#374151]">
          Prestations <span class="text-[#DC2626]">*</span>
        </label>
        <button
          type="button"
          class="text-xs text-[#7C3AED] font-medium hover:underline flex items-center gap-1"
          @click="appendLine"
        >
          <svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" />
          </svg>
          Ajouter une ligne
        </button>
      </div>

      <div class="rounded-lg border border-[#E5E7EB] overflow-hidden">
        <!-- Header -->
        <div class="grid grid-cols-[1fr_80px_110px_110px_36px] gap-2 px-3 py-2 bg-[#F9FAFB] text-xs font-medium text-[#6B7280] uppercase tracking-wide">
          <span>Description</span>
          <span class="text-right">Qté</span>
          <span class="text-right">P.U. HT</span>
          <span class="text-right">Montant HT</span>
          <span />
        </div>

        <!-- Lines -->
        <div
          v-for="(line, index) in lines"
          :key="line.key"
          class="grid grid-cols-[1fr_80px_110px_110px_36px] gap-2 px-3 py-2 border-t border-[#E5E7EB] items-center"
        >
          <input
            v-model="line.value.description"
            type="text"
            placeholder="Description de la prestation"
            class="w-full h-8 rounded border border-[#E5E7EB] px-2 text-sm text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#7C3AED] focus:border-[#7C3AED]"
            @blur="updateLineAmount(index)"
          />
          <input
            v-model.number="line.value.quantity"
            type="number"
            min="0"
            step="0.01"
            class="w-full h-8 rounded border border-[#E5E7EB] px-2 text-sm text-right font-mono text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#7C3AED] focus:border-[#7C3AED]"
            @input="updateLineAmount(index)"
          />
          <input
            v-model.number="line.value.unit_price"
            type="number"
            min="0"
            step="0.01"
            class="w-full h-8 rounded border border-[#E5E7EB] px-2 text-sm text-right font-mono text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#7C3AED] focus:border-[#7C3AED]"
            @input="updateLineAmount(index)"
          />
          <div class="h-8 flex items-center justify-end px-2 text-sm font-mono font-semibold text-[#111827] tabular-nums">
            {{ line.value.amount?.toFixed(2) ?? '0.00' }} €
          </div>
          <button
            v-if="lines.length > 1"
            type="button"
            class="h-8 w-8 flex items-center justify-center text-[#9CA3AF] hover:text-[#DC2626] transition-colors rounded"
            @click="removeLine(index)"
          >
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
          <div v-else class="w-8" />
        </div>

        <!-- Totals -->
        <div class="border-t border-[#E5E7EB] bg-[#F9FAFB] px-3 py-3 space-y-1">
          <div class="flex justify-end gap-6 text-sm">
            <span class="text-[#6B7280]">Sous-total HT</span>
            <span class="font-mono font-semibold text-[#374151] tabular-nums w-28 text-right">
              {{ subtotal.toFixed(2) }} €
            </span>
          </div>
          <div v-if="vatRate > 0" class="flex justify-end gap-6 text-sm">
            <span class="text-[#6B7280]">TVA ({{ (vatRate * 100).toFixed(0) }} %)</span>
            <span class="font-mono font-semibold text-[#374151] tabular-nums w-28 text-right">
              {{ vatAmount.toFixed(2) }} €
            </span>
          </div>
          <div class="flex justify-end gap-6 text-base border-t border-[#E5E7EB] pt-2 mt-1">
            <span class="font-semibold text-[#111827]">Total TTC</span>
            <span class="font-mono font-bold text-[#7C3AED] tabular-nums w-28 text-right">
              {{ total.toFixed(2) }} €
            </span>
          </div>
        </div>
      </div>

      <p v-if="errors.lines" class="mt-1 text-xs text-[#DC2626]">{{ errors.lines }}</p>
    </div>

    <!-- Notes -->
    <div class="flex flex-col gap-1.5">
      <label class="text-sm font-medium text-[#374151]">Notes (facultatif)</label>
      <textarea
        v-model="notes"
        rows="2"
        placeholder="Conditions particulières, mentions additionnelles..."
        class="w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-[#7C3AED] resize-none"
      />
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-3 pt-2 border-t border-[#E5E7EB]">
      <Button type="button" variant="ghost" @click="emit('cancel')">Annuler</Button>
      <Button type="submit" variant="default" :loading="loading">
        Enregistrer le brouillon
      </Button>
    </div>
  </form>
</template>
