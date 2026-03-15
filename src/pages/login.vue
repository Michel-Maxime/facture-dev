<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { loginSchema } from '@/utils/validators'
import { useAuth } from '@/composables/useAuth'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'

const router = useRouter()
const { login } = useAuth()

const loading = ref(false)

const { handleSubmit, defineField, errors } = useForm({
  validationSchema: toTypedSchema(loginSchema),
  initialValues: { email: '', password: '' },
})

const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')

const onSubmit = handleSubmit(async (values) => {
  loading.value = true
  const success = await login(values.email, values.password)
  loading.value = false
  if (success) {
    router.push('/')
  }
})
</script>

<template>
  <div class="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
    <div class="w-full max-w-sm">
      <!-- Logo -->
      <div class="text-center mb-8">
        <span class="text-2xl font-bold text-[#7C3AED] tracking-tight">facture.dev</span>
        <p class="text-sm text-[#6B7280] mt-1">Facturation pour micro-entrepreneurs</p>
      </div>

      <!-- Card -->
      <div class="bg-white border border-[#E5E7EB] rounded-xl p-8">
        <h1 class="text-[22px] font-bold text-[#111827] mb-1">Connexion</h1>
        <p class="text-sm text-[#6B7280] mb-6">Accédez à votre espace de facturation</p>

        <form class="space-y-4" novalidate @submit.prevent="onSubmit">
          <Input
            v-model="email"
            v-bind="emailAttrs"
            label="Adresse email"
            type="email"
            placeholder="vous@exemple.fr"
            :error="errors.email"
            required
          />

          <Input
            v-model="password"
            v-bind="passwordAttrs"
            label="Mot de passe"
            type="password"
            placeholder="••••••••"
            :error="errors.password"
            required
          />

          <Button
            type="submit"
            class="w-full"
            :loading="loading"
            size="lg"
          >
            Se connecter
          </Button>
        </form>
      </div>

      <!-- Link to register -->
      <p class="text-center text-sm text-[#6B7280] mt-4">
        Pas encore de compte ?
        <RouterLink to="/register" class="text-[#7C3AED] font-medium hover:underline">
          Créer un compte
        </RouterLink>
      </p>
    </div>
  </div>
</template>
