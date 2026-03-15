<script setup lang="ts">
import { computed, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { clientSchema } from '@/utils/validators'
import type { ClientFormData } from '@/utils/validators'
import type { Client } from '@/lib/types'
import Input from '@/components/ui/Input.vue'
import Select from '@/components/ui/Select.vue'
import Button from '@/components/ui/Button.vue'

interface Props {
  client?: Client | null
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  client: null,
  loading: false,
})

const emit = defineEmits<{
  submit: [formData: ClientFormData]
  cancel: []
}>()

const isEditMode = computed(() => !!props.client)

const { handleSubmit, resetForm, defineField, errors } = useForm<ClientFormData>({
  validationSchema: toTypedSchema(clientSchema),
  initialValues: {
    name: props.client?.name ?? '',
    type: props.client?.type ?? 'PROFESSIONAL',
    siret: props.client?.siret ?? '',
    address: props.client?.address ?? '',
    city: props.client?.city ?? '',
    postal_code: props.client?.postal_code ?? '',
    email: props.client?.email ?? '',
    phone: props.client?.phone ?? '',
    notes: props.client?.notes ?? '',
  },
})

// Reactive field bindings
const [name, nameAttrs] = defineField('name')
const [type, typeAttrs] = defineField('type')
const [siret, siretAttrs] = defineField('siret')
const [address, addressAttrs] = defineField('address')
const [city, cityAttrs] = defineField('city')
const [postalCode, postalCodeAttrs] = defineField('postal_code')
const [email, emailAttrs] = defineField('email')
const [phone, phoneAttrs] = defineField('phone')
const [notes, notesAttrs] = defineField('notes')

// Reset form when client prop changes (e.g. switching to edit a different client)
watch(
  () => props.client,
  (newClient) => {
    resetForm({
      values: {
        name: newClient?.name ?? '',
        type: newClient?.type ?? 'PROFESSIONAL',
        siret: newClient?.siret ?? '',
        address: newClient?.address ?? '',
        city: newClient?.city ?? '',
        postal_code: newClient?.postal_code ?? '',
        email: newClient?.email ?? '',
        phone: newClient?.phone ?? '',
        notes: newClient?.notes ?? '',
      },
    })
  },
)

const onSubmit = handleSubmit((values) => {
  emit('submit', values)
})

const typeOptions = [
  { value: 'PROFESSIONAL', label: 'Professionnel' },
  { value: 'INDIVIDUAL', label: 'Particulier' },
]

const showSiret = computed(() => type.value === 'PROFESSIONAL')
</script>

<template>
  <form
    class="space-y-5"
    novalidate
    @submit.prevent="onSubmit"
  >
    <!-- Type + Nom -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Select
        v-model="type"
        v-bind="typeAttrs"
        label="Type de client"
        :options="typeOptions"
        :error="errors.type"
        required
      />
      <div class="sm:col-span-2">
        <Input
          v-model="name"
          v-bind="nameAttrs"
          label="Nom / Raison sociale"
          placeholder="Ex : Dupont Consulting"
          :error="errors.name"
          required
        />
      </div>
    </div>

    <!-- SIRET (professionnel uniquement) -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <Input
        v-if="showSiret"
        v-model="siret"
        v-bind="siretAttrs"
        label="SIRET"
        placeholder="14 chiffres"
        :error="errors.siret"
        hint="Facultatif pour les professionnels"
        maxlength="14"
      />
    </Transition>

    <!-- Adresse -->
    <Input
      v-model="address"
      v-bind="addressAttrs"
      label="Adresse"
      placeholder="Ex : 12 rue de la Paix"
      :error="errors.address"
      required
    />

    <!-- Ville + Code postal -->
    <div class="grid grid-cols-2 gap-4">
      <Input
        v-model="postalCode"
        v-bind="postalCodeAttrs"
        label="Code postal"
        placeholder="75001"
        :error="errors.postal_code"
        maxlength="5"
        required
      />
      <Input
        v-model="city"
        v-bind="cityAttrs"
        label="Ville"
        placeholder="Paris"
        :error="errors.city"
        required
      />
    </div>

    <!-- Email + Téléphone -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Input
        v-model="email"
        v-bind="emailAttrs"
        label="Email"
        type="email"
        placeholder="contact@example.com"
        :error="errors.email"
      />
      <Input
        v-model="phone"
        v-bind="phoneAttrs"
        label="Telephone"
        type="tel"
        placeholder="06 00 00 00 00"
        :error="errors.phone"
      />
    </div>

    <!-- Notes -->
    <div class="flex flex-col gap-1.5">
      <label class="text-sm font-medium text-[#374151]">Notes</label>
      <textarea
        v-model="notes"
        v-bind="notesAttrs"
        rows="3"
        placeholder="Informations supplementaires..."
        class="w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] placeholder:text-[#9CA3AF] resize-none transition-colors focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-[#7C3AED]"
      />
      <p v-if="errors.notes" class="text-xs text-[#DC2626]">{{ errors.notes }}</p>
    </div>

    <!-- Form actions -->
    <div class="flex items-center justify-end gap-3 pt-2 border-t border-[#E5E7EB]">
      <Button
        variant="ghost"
        type="button"
        @click="emit('cancel')"
      >
        Annuler
      </Button>
      <Button
        variant="default"
        type="submit"
        :loading="loading"
      >
        {{ isEditMode ? 'Enregistrer les modifications' : 'Creer le client' }}
      </Button>
    </div>
  </form>
</template>
