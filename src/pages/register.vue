<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { registerSchema } from '@/utils/validators'
import { useAuth } from '@/composables/useAuth'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'

const { register } = useAuth()

const loading = ref(false)
const success = ref(false)

const { handleSubmit, defineField, errors } = useForm({
  validationSchema: toTypedSchema(registerSchema),
  initialValues: {
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    siret: '',
    address: '',
    city: '',
    postal_code: '',
    company_created_at: '',
  },
})

const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')
const [confirmPassword, confirmPasswordAttrs] = defineField('confirmPassword')
const [firstName, firstNameAttrs] = defineField('first_name')
const [lastName, lastNameAttrs] = defineField('last_name')
const [siret, siretAttrs] = defineField('siret')
const [address, addressAttrs] = defineField('address')
const [city, cityAttrs] = defineField('city')
const [postalCode, postalCodeAttrs] = defineField('postal_code')
const [companyCreatedAt, companyCreatedAtAttrs] = defineField('company_created_at')

const onSubmit = handleSubmit(async (values) => {
  loading.value = true
  const ok = await register(values)
  loading.value = false
  if (ok) {
    success.value = true
  }
})
</script>

<template>
  <div class="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
    <div class="w-full max-w-lg">
      <!-- Logo -->
      <div class="text-center mb-8">
        <span class="text-2xl font-bold text-[#7C3AED] tracking-tight">facture.dev</span>
        <p class="text-sm text-[#6B7280] mt-1">Facturation pour micro-entrepreneurs</p>
      </div>

      <!-- Success state -->
      <div
        v-if="success"
        class="bg-white border border-[#E5E7EB] rounded-xl p-8 text-center"
      >
        <div class="w-12 h-12 bg-[#DCFCE7] rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="h-6 w-6 text-[#059669]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
        </div>
        <h2 class="text-lg font-semibold text-[#111827] mb-2">Compte créé avec succès !</h2>
        <p class="text-sm text-[#6B7280] mb-6">
          Vérifiez votre boîte mail pour confirmer votre adresse email, puis connectez-vous.
        </p>
        <RouterLink to="/login">
          <Button variant="default" size="md">Se connecter</Button>
        </RouterLink>
      </div>

      <!-- Form -->
      <div v-else class="bg-white border border-[#E5E7EB] rounded-xl p-8">
        <h1 class="text-[22px] font-bold text-[#111827] mb-1">Créer un compte</h1>
        <p class="text-sm text-[#6B7280] mb-6">Renseignez vos informations professionnelles</p>

        <form class="space-y-5" novalidate @submit.prevent="onSubmit">
          <!-- Identité -->
          <div>
            <p class="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">Identité</p>
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

          <!-- Connexion -->
          <div>
            <p class="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">Connexion</p>
            <div class="space-y-4">
              <Input
                v-model="email"
                v-bind="emailAttrs"
                label="Adresse email"
                type="email"
                placeholder="vous@exemple.fr"
                :error="errors.email"
                required
              />
              <div class="grid grid-cols-2 gap-4">
                <Input
                  v-model="password"
                  v-bind="passwordAttrs"
                  label="Mot de passe"
                  type="password"
                  placeholder="••••••••"
                  :error="errors.password"
                  required
                />
                <Input
                  v-model="confirmPassword"
                  v-bind="confirmPasswordAttrs"
                  label="Confirmer"
                  type="password"
                  placeholder="••••••••"
                  :error="errors.confirmPassword"
                  required
                />
              </div>
            </div>
          </div>

          <!-- Entreprise -->
          <div>
            <p class="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">Entreprise</p>
            <div class="space-y-4">
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
                v-model="companyCreatedAt"
                v-bind="companyCreatedAtAttrs"
                label="Date de création de l'entreprise"
                type="date"
                :error="errors.company_created_at"
                required
              />
            </div>
          </div>

          <!-- Adresse -->
          <div>
            <p class="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">Adresse</p>
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
          </div>

          <Button type="submit" class="w-full" :loading="loading" size="lg">
            Créer mon compte
          </Button>
        </form>
      </div>

      <!-- Link to login -->
      <p class="text-center text-sm text-[#6B7280] mt-4">
        Déjà un compte ?
        <RouterLink to="/login" class="text-[#7C3AED] font-medium hover:underline">
          Se connecter
        </RouterLink>
      </p>
    </div>
  </div>
</template>
