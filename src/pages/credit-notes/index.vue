<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCreditNotes } from '@/composables/useCreditNotes'
import { formatCurrency, formatDate } from '@/utils/formatters'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'

const router = useRouter()
const { creditNotes, loading, fetchCreditNotes } = useCreditNotes()

const statusLabels: Record<string, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Émis',
}

const statusVariants: Record<string, 'default' | 'info'> = {
  DRAFT: 'default',
  SENT: 'info',
}

onMounted(fetchCreditNotes)
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-[22px] font-bold text-[#111827]">Avoirs</h1>
        <p class="text-sm text-[#6B7280] mt-0.5">Notes de crédit sur factures émises</p>
      </div>
    </div>

    <!-- Loading -->
    <template v-if="loading">
      <div class="space-y-3">
        <div v-for="i in 3" :key="i" class="h-16 bg-[#F3F4F6] rounded-xl animate-pulse" />
      </div>
    </template>

    <!-- Empty state -->
    <template v-else-if="creditNotes.length === 0">
      <Card>
        <div class="py-12 text-center">
          <svg class="mx-auto h-12 w-12 text-[#D1D5DB]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="mt-3 text-sm font-medium text-[#374151]">Aucun avoir</p>
          <p class="mt-1 text-sm text-[#6B7280]">
            Les avoirs sont créés depuis la page détail d'une facture émise.
          </p>
        </div>
      </Card>
    </template>

    <!-- Credit notes table -->
    <template v-else>
      <Card>
        <div class="overflow-x-auto -mx-6 px-6">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-[#E5E7EB]">
                <th class="pb-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wide">Numéro</th>
                <th class="pb-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wide">Date</th>
                <th class="pb-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wide">Statut</th>
                <th class="pb-3 text-right text-xs font-medium text-[#6B7280] uppercase tracking-wide">Montant</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="cn in creditNotes"
                :key="cn.id"
                class="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB] cursor-pointer transition-colors"
                @click="router.push(`/credit-notes/${cn.id}`)"
              >
                <td class="py-3 font-mono font-medium text-[#111827]">
                  {{ cn.number ?? 'Brouillon' }}
                </td>
                <td class="py-3 text-[#374151]">{{ formatDate(cn.issue_date) }}</td>
                <td class="py-3">
                  <Badge :variant="statusVariants[cn.status]">
                    {{ statusLabels[cn.status] }}
                  </Badge>
                </td>
                <td class="py-3 text-right font-mono tabular-nums font-semibold text-[#DC2626]">
                  {{ formatCurrency(cn.total) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </template>
  </div>
</template>
