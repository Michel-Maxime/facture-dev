<script setup lang="ts">
import { computed, useId } from 'vue'

interface Props {
  modelValue: string
  label?: string
  error?: string
  hint?: string
  type?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  required: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const id = useId()

const inputClasses = computed(() => {
  const base =
    'w-full h-9 rounded-md border bg-white px-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] transition-colors focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:ring-offset-0 focus:border-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#F9FAFB]'
  const errorClass = props.error
    ? 'border-[#DC2626] focus:ring-[#DC2626] focus:border-[#DC2626]'
    : 'border-[#E5E7EB]'
  return `${base} ${errorClass}`
})
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label
      v-if="label"
      :for="id"
      class="text-sm font-medium text-[#374151]"
    >
      {{ label }}
      <span v-if="required" class="text-[#DC2626] ml-0.5">*</span>
    </label>

    <input
      :id="id"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :class="inputClasses"
      :aria-describedby="error ? `${id}-error` : hint ? `${id}-hint` : undefined"
      :aria-invalid="!!error"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />

    <p
      v-if="error"
      :id="`${id}-error`"
      class="text-xs text-[#DC2626] flex items-center gap-1"
      role="alert"
    >
      <svg
        class="h-3 w-3 shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
          clip-rule="evenodd"
        />
      </svg>
      {{ error }}
    </p>

    <p
      v-else-if="hint"
      :id="`${id}-hint`"
      class="text-xs text-[#6B7280]"
    >
      {{ hint }}
    </p>
  </div>
</template>
