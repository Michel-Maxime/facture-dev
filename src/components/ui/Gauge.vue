<script setup lang="ts">
import { computed } from 'vue'
import { formatCurrency, formatPercentage } from '@/utils/formatters'
import { ALERT_THRESHOLDS } from '@/lib/constants'

interface Props {
  value: number
  label: string
  threshold?: number
  current?: number
}

const props = withDefaults(defineProps<Props>(), {
  value: 0,
})

// SVG semicircle gauge constants
const RADIUS = 54
const CIRCUMFERENCE = Math.PI * RADIUS // half-circle arc length (~169.6)
const CX = 64
const CY = 64

const clampedValue = computed(() => Math.max(0, Math.min(1, props.value)))

const strokeDashoffset = computed(() => {
  // offset goes from CIRCUMFERENCE (empty) to 0 (full)
  return CIRCUMFERENCE * (1 - clampedValue.value)
})

const color = computed(() => {
  if (clampedValue.value >= ALERT_THRESHOLDS.danger) return '#DC2626'
  if (clampedValue.value >= ALERT_THRESHOLDS.warning) return '#D97706'
  return '#059669'
})

const trackColor = computed(() => {
  if (clampedValue.value >= ALERT_THRESHOLDS.danger) return '#FEE2E2'
  if (clampedValue.value >= ALERT_THRESHOLDS.warning) return '#FEF3C7'
  return '#DCFCE7'
})

const percentage = computed(() => formatPercentage(clampedValue.value))

const formattedCurrent = computed(() =>
  props.current !== undefined ? formatCurrency(props.current) : null,
)

const formattedThreshold = computed(() =>
  props.threshold !== undefined ? formatCurrency(props.threshold) : null,
)
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <!-- SVG semicircular gauge -->
    <div class="relative" style="width: 128px; height: 72px; overflow: visible;">
      <svg
        width="128"
        height="72"
        viewBox="0 0 128 72"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <!-- Track (background half-circle) -->
        <path
          :d="`M 10,64 A ${RADIUS},${RADIUS} 0 0 1 118,64`"
          fill="none"
          :stroke="trackColor"
          stroke-width="8"
          stroke-linecap="round"
        />
        <!-- Progress arc -->
        <path
          :d="`M 10,64 A ${RADIUS},${RADIUS} 0 0 1 118,64`"
          fill="none"
          :stroke="color"
          stroke-width="8"
          stroke-linecap="round"
          :stroke-dasharray="CIRCUMFERENCE"
          :stroke-dashoffset="strokeDashoffset"
          style="transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease;"
        />
      </svg>

      <!-- Percentage label centered in the gauge -->
      <div class="absolute bottom-0 left-0 right-0 flex justify-center">
        <span
          class="font-mono text-base font-semibold tabular-nums"
          :style="{ color }"
        >
          {{ percentage }}
        </span>
      </div>
    </div>

    <!-- Label -->
    <p class="text-xs font-medium text-[#374151] text-center">{{ label }}</p>

    <!-- Current / Threshold values -->
    <div v-if="formattedCurrent || formattedThreshold" class="flex items-center gap-1 text-xs text-[#6B7280]">
      <span v-if="formattedCurrent" class="font-mono tabular-nums text-[#111827]">
        {{ formattedCurrent }}
      </span>
      <span v-if="formattedCurrent && formattedThreshold">/</span>
      <span v-if="formattedThreshold" class="font-mono tabular-nums">
        {{ formattedThreshold }}
      </span>
    </div>
  </div>
</template>
