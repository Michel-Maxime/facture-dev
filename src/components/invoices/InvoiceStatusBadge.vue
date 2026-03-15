<script setup lang="ts">
import { computed } from 'vue'
import Badge from '@/components/ui/Badge.vue'
import type { InvoiceStatus } from '@/lib/types'

interface Props {
  status: InvoiceStatus
}

const props = defineProps<Props>()

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

const variantMap: Record<InvoiceStatus, BadgeVariant> = {
  DRAFT: 'default',
  SENT: 'info',
  PAID: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'default',
}

const labelMap: Record<InvoiceStatus, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyée',
  PAID: 'Payée',
  OVERDUE: 'En retard',
  CANCELLED: 'Annulée',
}

const variant = computed(() => variantMap[props.status])
const label = computed(() => labelMap[props.status])
</script>

<template>
  <Badge :variant="variant">{{ label }}</Badge>
</template>
