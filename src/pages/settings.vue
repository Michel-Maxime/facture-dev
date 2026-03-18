<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { profileSchema } from '@/utils/validators'
import type { ProfileFormData } from '@/utils/validators'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { supabase } from '@/lib/supabase'
import { useLogo } from '@/composables/useLogo'
import Input from '@/components/ui/Input.vue'
import Select from '@/components/ui/Select.vue'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'

const authStore = useAuthStore()
const notifications = useNotificationsStore()
const { uploading: logoUploading, logoUrl, uploadLogo, removeLogo, getLogoSignedUrl } = useLogo()

const logoSignedUrl = ref<string | null>(null)

onMounted(async () => {
  if (logoUrl.value) {
    logoSignedUrl.value = await getLogoSignedUrl(logoUrl.value)
  }
})

async function handleLogoUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const success = await uploadLogo(file)
  if (success && logoUrl.value) {
    logoSignedUrl.value = await getLogoSignedUrl(logoUrl.value)
  }
  input.value = ''
}

async function handleRemoveLogo() {
  await removeLogo()
  logoSignedUrl.value = null
}

const saving = ref(false)
const saveSuccess = ref(false)

const vatRegimeOptions = [
  { value: 'FRANCHISE', label: 'Franchise en base de TVA' },
  { value: 'SUBJECT', label: 'Assujetti à la TVA' },
]

const declarationFreqOptions = [
  { value: 'MONTHLY', label: 'Mensuelle' },
  { value: 'QUARTERLY', label: 'Trimestrielle' },
]

const { handleSubmit, defineField, errors, resetForm } = useForm<ProfileFormData>({
  validationSchema: toTypedSchema(profileSchema),
  initialValues: buildInitialValues(),
})

function buildInitialValues(): ProfileFormData {
  const p = authStore.profile
  return {
    first_name: p?.first_name ?? '',
    last_name: p?.last_name ?? '',
    address: p?.address ?? '',
    city: p?.city ?? '',
    postal_code: p?.postal_code ?? '',
    siret: p?.siret ?? '',
    code_ape: p?.code_ape ?? '',
    iban: p?.iban ?? '',
    bic: p?.bic ?? '',
    company_created_at: p?.company_created_at ?? '',
    vat_regime: p?.vat_regime ?? 'FRANCHISE',
    declaration_freq: p?.declaration_freq ?? 'QUARTERLY',
    cotisation_rate: p?.cotisation_rate ?? 0.256,
    is_acre: p?.is_acre ?? false,
    facturx_enabled: p?.facturx_enabled ?? true,
  }
}

// Re-fill form when profile loads
watch(
  () => authStore.profile,
  () => {
    resetForm({ values: buildInitialValues() })
  },
)

const [firstName, firstNameAttrs] = defineField('first_name')
const [lastName, lastNameAttrs] = defineField('last_name')
const [address, addressAttrs] = defineField('address')
const [city, cityAttrs] = defineField('city')
const [postalCode, postalCodeAttrs] = defineField('postal_code')
const [siret, siretAttrs] = defineField('siret')
const [codeApe, codeApeAttrs] = defineField('code_ape')
const [iban, ibanAttrs] = defineField('iban')
const [bic, bicAttrs] = defineField('bic')
const [companyCreatedAt, companyCreatedAtAttrs] = defineField('company_created_at')
const [vatRegime, vatRegimeAttrs] = defineField('vat_regime')
const [declarationFreq, declarationFreqAttrs] = defineField('declaration_freq')
const [cotisationRate, cotisationRateAttrs] = defineField('cotisation_rate')
const [isAcre, isAcreAttrs] = defineField('is_acre')
const [facturxEnabled, facturxEnabledAttrs] = defineField('facturx_enabled')

const onSubmit = handleSubmit(async (values) => {
  if (!authStore.user) return
  saving.value = true
  saveSuccess.value = false

  const { data, error } = await supabase
    .from('profiles')
    .update({
      first_name: values.first_name,
      last_name: values.last_name,
      address: values.address,
      city: values.city,
      postal_code: values.postal_code,
      siret: values.siret,
      code_ape: values.code_ape || null,
      iban: values.iban || null,
      bic: values.bic || null,
      company_created_at: values.company_created_at,
      vat_regime: values.vat_regime,
      declaration_freq: values.declaration_freq,
      cotisation_rate: values.cotisation_rate,
      is_acre: values.is_acre,
      facturx_enabled: values.facturx_enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', authStore.user.id)
    .select()
    .single()

  saving.value = false

  if (error) {
    notifications.error('Erreur', 'Impossible de sauvegarder les paramètres')
    return
  }

  if (data) {
    authStore.setProfile(data)
  }

  saveSuccess.value = true
  notifications.success('Paramètres sauvegardés')
  setTimeout(() => { saveSuccess.value = false }, 3000)
})
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-[22px] font-bold text-[#111827]">Paramètres</h1>
      <p class="text-sm text-[#6B7280] mt-0.5">Gérez votre profil et vos informations professionnelles</p>
    </div>

    <form novalidate @submit.prevent="onSubmit">
      <!-- Identity section -->
      <Card title="Identité" description="Vos informations personnelles" class="mb-4">
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <Input
              v-model="firstName"
              v-bind="firstNameAttrs"
              label="Prénom"
              placeholder="Jean"
              :error="errors.first_name"
              required
            />
            <Input
              v-model="lastName"
              v-bind="lastNameAttrs"
              label="Nom"
              placeholder="Dupont"
              :error="errors.last_name"
              required
            />
          </div>
        </div>
      </Card>

      <!-- Logo section -->
      <Card title="Logo" description="Apparaît en haut de vos factures (PNG ou JPEG · max 512 Ko)" class="mb-4">
        <div class="flex items-center gap-4">
          <!-- Preview -->
          <div class="w-24 h-14 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-center overflow-hidden shrink-0">
            <img
              v-if="logoSignedUrl"
              :src="logoSignedUrl"
              alt="Logo"
              class="max-w-full max-h-full object-contain"
            />
            <svg v-else class="w-8 h-8 text-[#D1D5DB]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>

          <!-- Actions -->
          <div class="flex flex-col gap-2">
            <label
              class="inline-flex items-center gap-2 cursor-pointer rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
              :class="{ 'opacity-50 cursor-not-allowed': logoUploading }"
            >
              <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {{ logoUploading ? 'Envoi...' : (logoUrl ? 'Remplacer' : 'Uploader un logo') }}
              <input
                type="file"
                class="sr-only"
                accept="image/png,image/jpeg"
                :disabled="logoUploading"
                @change="handleLogoUpload"
              />
            </label>
            <button
              v-if="logoUrl"
              type="button"
              class="text-xs text-[#DC2626] hover:underline text-left"
              @click="handleRemoveLogo"
            >
              Supprimer le logo
            </button>
          </div>
        </div>
      </Card>

      <!-- Enterprise section -->
      <Card title="Entreprise" description="Informations légales de votre activité" class="mb-4">
        <div class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              v-model="siret"
              v-bind="siretAttrs"
              label="SIRET"
              placeholder="14 chiffres"
              :error="errors.siret"
              maxlength="14"
              required
            />
            <Input
              v-model="codeApe"
              v-bind="codeApeAttrs"
              label="Code APE / NAF"
              placeholder="Ex : 6201Z"
              :error="errors.code_ape"
            />
          </div>
          <Input
            v-model="companyCreatedAt"
            v-bind="companyCreatedAtAttrs"
            label="Date de création de l'entreprise"
            type="date"
            :error="errors.company_created_at"
            required
          />
        </div>
      </Card>

      <!-- Address section -->
      <Card title="Adresse professionnelle" class="mb-4">
        <div class="space-y-4">
          <Input
            v-model="address"
            v-bind="addressAttrs"
            label="Adresse"
            placeholder="12 rue de la Paix"
            :error="errors.address"
            required
          />
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
        </div>
      </Card>

      <!-- Banking section -->
      <Card title="Coordonnées bancaires" description="Utilisées sur vos factures" class="mb-4">
        <div class="space-y-4">
          <Input
            v-model="iban"
            v-bind="ibanAttrs"
            label="IBAN"
            placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
            :error="errors.iban"
          />
          <Input
            v-model="bic"
            v-bind="bicAttrs"
            label="BIC / SWIFT"
            placeholder="BNPAFRPP"
            :error="errors.bic"
          />
        </div>
      </Card>

      <!-- Fiscal section -->
      <Card title="Régime fiscal & cotisations" class="mb-4">
        <div class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              v-model="vatRegime"
              v-bind="vatRegimeAttrs"
              label="Régime TVA"
              :options="vatRegimeOptions"
              :error="errors.vat_regime"
              required
            />
            <Select
              v-model="declarationFreq"
              v-bind="declarationFreqAttrs"
              label="Fréquence de déclaration"
              :options="declarationFreqOptions"
              :error="errors.declaration_freq"
              required
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-[#374151]">
              Taux de cotisations sociales
              <span class="text-[#DC2626] ml-0.5">*</span>
            </label>
            <div class="flex items-center gap-3">
              <input
                v-model.number="cotisationRate"
                v-bind="cotisationRateAttrs"
                type="range"
                min="0"
                max="0.5"
                step="0.001"
                class="flex-1 h-2 rounded-full accent-[#7C3AED]"
              />
              <span class="font-mono text-sm font-semibold text-[#111827] tabular-nums w-14 text-right">
                {{ (cotisationRate * 100).toFixed(1) }} %
              </span>
            </div>
            <p class="text-xs text-[#9CA3AF]">
              BNC SSI : 25,6 % · BNC CIPAV : 23,2 %
            </p>
            <p v-if="errors.cotisation_rate" class="text-xs text-[#DC2626]">{{ errors.cotisation_rate }}</p>
          </div>

          <!-- ACRE toggle -->
          <div class="flex items-center justify-between gap-4 pt-1">
            <div>
              <p class="text-sm font-medium text-[#374151]">Bénéficiaire ACRE</p>
              <p class="text-xs text-[#6B7280] mt-0.5">
                Réduit les cotisations de 50 % la première année d'activité
              </p>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="isAcre"
              v-bind="isAcreAttrs"
              :class="[
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:ring-offset-2',
                isAcre ? 'bg-[#7C3AED]' : 'bg-[#D1D5DB]',
              ]"
              @click="isAcre = !isAcre"
            >
              <span
                :class="[
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  isAcre ? 'translate-x-5' : 'translate-x-0',
                ]"
              />
            </button>
          </div>

          <!-- Factur-X toggle -->
          <div class="flex items-center justify-between gap-4 pt-1 border-t border-[#F3F4F6] mt-2">
            <div>
              <p class="text-sm font-medium text-[#374151]">Factur-X (facturation électronique)</p>
              <p class="text-xs text-[#6B7280] mt-0.5">
                Embarque un XML Factur-X MINIMUM dans vos PDFs. Requis pour l'obligation légale de 2026/2027.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="facturxEnabled"
              v-bind="facturxEnabledAttrs"
              :class="[
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:ring-offset-2',
                facturxEnabled ? 'bg-[#7C3AED]' : 'bg-[#D1D5DB]',
              ]"
              @click="facturxEnabled = !facturxEnabled"
            >
              <span
                :class="[
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  facturxEnabled ? 'translate-x-5' : 'translate-x-0',
                ]"
              />
            </button>
          </div>
        </div>
      </Card>

      <!-- Save button -->
      <div class="flex items-center justify-end gap-3">
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 translate-x-2"
          enter-to-class="opacity-100 translate-x-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-x-0"
          leave-to-class="opacity-0 translate-x-2"
        >
          <span v-if="saveSuccess" class="text-sm text-[#059669] font-medium flex items-center gap-1.5">
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
            Sauvegardé
          </span>
        </Transition>
        <Button type="submit" variant="default" size="md" :loading="saving">
          Enregistrer les modifications
        </Button>
      </div>
    </form>
  </div>
</template>
