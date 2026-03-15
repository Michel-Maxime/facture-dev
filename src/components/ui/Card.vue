<script setup lang="ts">
interface Props {
  title?: string
  description?: string
}

defineProps<Props>()
</script>

<template>
  <div class="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
    <div v-if="title || description" class="px-6 py-4 border-b border-[#E5E7EB]">
      <h3 v-if="title" class="text-sm font-semibold text-[#111827]">{{ title }}</h3>
      <p v-if="description" class="text-xs text-[#6B7280] mt-0.5">{{ description }}</p>
    </div>
    <div class="p-6">
      <slot />
    </div>
  </div>
</template>
