<script setup lang="ts">
import { computed, useId } from 'vue'

interface Option {
  value: string
  label: string
}

interface Props {
  modelValue: string
  options: Option[]
  label?: string
  error?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  required: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const id = useId()

const selectClasses = computed(() => {
  const base =
    'w-full h-9 rounded-md border bg-white px-3 pr-8 text-sm text-[#111827] appearance-none cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:ring-offset-0 focus:border-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#F9FAFB]'
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

    <div class="relative">
      <select
        :id="id"
        :value="modelValue"
        :disabled="disabled"
        :required="required"
        :class="selectClasses"
        :aria-invalid="!!error"
        @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      >
        <option v-if="placeholder" value="" disabled :selected="!modelValue">
          {{ placeholder }}
        </option>
        <option
          v-for="option in options"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>

      <!-- Chevron icon -->
      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 text-[#9CA3AF]"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
    </div>

    <p
      v-if="error"
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
  </div>
</template>
