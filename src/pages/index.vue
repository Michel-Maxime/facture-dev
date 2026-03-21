<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useInvoices } from '@/composables/useInvoices'
import { useThresholds } from '@/composables/useThresholds'
import { useCotisations, isAcrePostReform, isWithinAcrePeriod } from '@/composables/useCotisations'
import { useAuthStore } from '@/stores/auth'
import { formatCurrency, formatDate, formatPercentage } from '@/utils/formatters'
import { THRESHOLDS } from '@/lib/constants'
import Card from '@/components/ui/Card.vue'
import Gauge from '@/components/ui/Gauge.vue'
import InvoiceStatusBadge from '@/components/invoices/InvoiceStatusBadge.vue'
import type { Database } from '@/lib/types'

type DashboardStats = Database['public']['Views']['dashboard_stats']['Row']

const router = useRouter()
const authStore = useAuthStore()
const { invoices, loading: invoicesLoading, fetchInvoices } = useInvoices()

const statsLoading = ref(false)
const stats = ref<DashboardStats | null>(null)

const caEncaisse = computed(() => stats.value?.ca_encaisse ?? 0)

const thresholds = useThresholds(caEncaisse)
const cotisations = useCotisations(caEncaisse)

const recentInvoices = computed(() => invoices.value.slice(0, 5))

const showAcreReformAlert = computed(() => {
  const profile = authStore.profile
  if (!profile?.is_acre) return false
  if (!profile.company_created_at) return false
  return isAcrePostReform(profile.company_created_at)
})

const showAcreExpiredNote = computed(() => {
  const profile = authStore.profile
  if (!profile?.is_acre) return false
  if (!profile.company_created_at) return false
  return !isWithinAcrePeriod(profile.company_created_at)
})

async function loadStats() {
  if (!authStore.user) return
  statsLoading.value = true
  const { data } = await supabase
    .from('dashboard_stats')
    .select('*')
    .eq('user_id', authStore.user.id)
    .single()
  stats.value = data
  statsLoading.value = false
}

const metricCards = computed(() => [
  {
    label: 'CA encaissé',
    value: formatCurrency(stats.value?.ca_encaisse ?? 0),
    description: 'Paiements reçus',
    color: 'text-[#059669]',
  },
  {
    label: 'CA facturé',
    value: formatCurrency(stats.value?.ca_facture ?? 0),
    description: 'Total facturé',
    color: 'text-[#7C3AED]',
  },
  {
    label: 'En attente',
    value: formatCurrency(stats.value?.en_attente ?? 0),
    description: 'Montant à encaisser',
    color: 'text-[#D97706]',
  },
  {
    label: 'Factures en attente',
    value: String(stats.value?.nb_en_attente ?? 0),
    description: 'Factures non payées',
    color: 'text-[#374151]',
    mono: true,
  },
])

onMounted(async () => {
  await Promise.all([loadStats(), fetchInvoices()])
})
</script>

<template>
  <div class="space-y-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div>
      <h1 class="text-[22px] font-bold text-[#111827]">Tableau de bord</h1>
      <p class="text-sm text-[#6B7280] mt-0.5">
        Bonjour {{ authStore.profile?.first_name }} — voici votre activité du moment.
      </p>
    </div>

    <!-- ACRE reform alert -->
    <div
      v-if="showAcreReformAlert"
      class="flex items-start gap-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-4 py-3"
      role="alert"
    >
      <svg class="h-5 w-5 text-[#3B82F6] shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
      </svg>
      <div>
        <p class="text-sm font-semibold text-[#1E40AF]">Réforme ACRE active</p>
        <p class="text-xs text-[#1E40AF] mt-0.5">
          Votre entreprise a été créée après le 1er juillet 2026 : vos cotisations ACRE sont réduites de 25 % (au lieu de 50 % avant la réforme). Le taux appliqué ci-dessous en tient compte.
        </p>
      </div>
    </div>

    <!-- Bank account alert -->
    <div
      v-if="caEncaisse >= THRESHOLDS.dedicatedBankAccount"
      class="flex items-start gap-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl px-4 py-3"
      role="alert"
    >
      <svg class="h-5 w-5 text-[#D97706] shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
      <div>
        <p class="text-sm font-semibold text-[#92400E]">Compte bancaire dédié requis</p>
        <p class="text-xs text-[#92400E] mt-0.5">
          Votre CA dépasse {{ formatCurrency(THRESHOLDS.dedicatedBankAccount) }} — vous devez ouvrir un compte bancaire dédié à votre activité professionnelle.
        </p>
      </div>
    </div>

    <!-- Metric cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        v-for="(card, i) in metricCards"
        :key="i"
        class="bg-white border border-[#E5E7EB] rounded-xl p-5"
      >
        <p class="text-xs font-medium text-[#6B7280] uppercase tracking-wide">{{ card.label }}</p>
        <div class="mt-2">
          <template v-if="statsLoading">
            <div class="h-7 w-24 bg-[#F3F4F6] rounded animate-pulse" />
          </template>
          <p
            v-else
            :class="['text-2xl font-bold tabular-nums', card.color, card.mono ? 'font-mono' : '']"
          >
            {{ card.value }}
          </p>
        </div>
        <p class="text-xs text-[#9CA3AF] mt-1">{{ card.description }}</p>
      </div>
    </div>

    <!-- Gauges + Cotisations -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- VAT threshold gauge -->
      <Card title="Seuil franchise TVA">
        <div class="flex flex-col items-center gap-2 py-2">
          <Gauge
            :value="thresholds.vatRatio.value"
            :current="caEncaisse.value"
            :threshold="thresholds.vatThreshold.value"
            label="Seuil TVA (services)"
          />
          <p
            v-if="thresholds.vatAlert.value === 'danger'"
            class="text-xs text-[#DC2626] font-medium text-center"
          >
            Seuil TVA presque atteint
          </p>
          <p
            v-else-if="thresholds.vatAlert.value === 'warning'"
            class="text-xs text-[#D97706] font-medium text-center"
          >
            Attention au seuil TVA
          </p>
        </div>
      </Card>

      <!-- Micro-enterprise threshold gauge -->
      <Card title="Seuil micro-entreprise">
        <div class="flex flex-col items-center gap-2 py-2">
          <Gauge
            :value="thresholds.microRatio.value"
            :current="caEncaisse.value"
            :threshold="thresholds.microThreshold.value"
            label="Plafond micro-entreprise"
          />
          <p
            v-if="thresholds.microAlert.value === 'danger'"
            class="text-xs text-[#DC2626] font-medium text-center"
          >
            Plafond micro-entreprise proche
          </p>
          <p
            v-else-if="thresholds.microAlert.value === 'warning'"
            class="text-xs text-[#D97706] font-medium text-center"
          >
            Attention au plafond
          </p>
        </div>
      </Card>

      <!-- Cotisations summary -->
      <Card title="Cotisations estimées">
        <div class="space-y-3">
          <div class="flex items-center justify-between text-sm">
            <span class="text-[#6B7280]">Cotisations sociales</span>
            <span class="font-mono font-semibold text-[#111827] tabular-nums">
              {{ formatCurrency(cotisations.cotisations.value) }}
            </span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-[#6B7280]">CFP</span>
            <span class="font-mono font-semibold text-[#111827] tabular-nums">
              {{ formatCurrency(cotisations.cfp.value) }}
            </span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-[#6B7280]">Versement libératoire</span>
            <span class="font-mono font-semibold text-[#111827] tabular-nums">
              {{ formatCurrency(cotisations.vfl.value) }}
            </span>
          </div>
          <div class="border-t border-[#E5E7EB] pt-3 flex items-center justify-between text-sm">
            <span class="font-semibold text-[#374151]">Total estimé</span>
            <span class="font-mono font-bold text-[#DC2626] tabular-nums">
              {{ formatCurrency(cotisations.total.value) }}
            </span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-[#6B7280]">Net estimé</span>
            <span class="font-mono font-semibold text-[#059669] tabular-nums">
              {{ formatCurrency(cotisations.net.value) }}
            </span>
          </div>
          <p class="text-xs text-[#9CA3AF]">
            Taux appliqué : {{ formatPercentage(cotisations.rate.value) }}
            <span
              v-if="showAcreExpiredNote"
              class="text-[#D97706]"
            >
              — ACRE expiré
            </span>
          </p>
        </div>
      </Card>
    </div>

    <!-- Declaration helper -->
    <Card title="Prochaine déclaration Urssaf">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="text-center sm:text-left">
          <p class="text-xs text-[#6B7280] uppercase tracking-wide font-medium">CA de la période</p>
          <p class="mt-1 text-lg font-bold font-mono tabular-nums text-[#111827]">
            {{ formatCurrency(cotisations.caPerPeriod.value) }}
          </p>
        </div>
        <div class="text-center sm:text-left">
          <p class="text-xs text-[#6B7280] uppercase tracking-wide font-medium">Cotisations estimées</p>
          <p class="mt-1 text-lg font-bold font-mono tabular-nums text-[#DC2626]">
            {{ formatCurrency(cotisations.cotisationsPerPeriod.value) }}
          </p>
        </div>
        <div class="text-center sm:text-left">
          <p class="text-xs text-[#6B7280] uppercase tracking-wide font-medium">Prochaine échéance</p>
          <p class="mt-1 text-base font-semibold text-[#7C3AED]">
            {{ cotisations.nextDeadline.value }}
          </p>
          <p class="text-xs text-[#9CA3AF] font-mono tabular-nums">J-{{ cotisations.daysUntilDeadline.value }}</p>
        </div>
      </div>
    </Card>

    <!-- Recent invoices -->
    <Card title="Factures récentes" description="Les 5 dernières factures émises">
      <template v-if="invoicesLoading">
        <div class="space-y-3">
          <div v-for="n in 4" :key="n" class="h-10 bg-[#F3F4F6] rounded animate-pulse" />
        </div>
      </template>

      <template v-else-if="recentInvoices.length === 0">
        <div class="flex flex-col items-center justify-center py-8 gap-2">
          <svg class="h-8 w-8 text-[#D1D5DB]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="text-sm text-[#9CA3AF]">Aucune facture pour le moment</p>
          <RouterLink to="/invoices">
            <button class="text-xs text-[#7C3AED] font-medium hover:underline">Créer une facture</button>
          </RouterLink>
        </div>
      </template>

      <template v-else>
        <div class="overflow-x-auto -mx-6 px-6">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-[#E5E7EB]">
                <th class="pb-2 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wide">N°</th>
                <th class="pb-2 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wide">Date</th>
                <th class="pb-2 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wide">Montant TTC</th>
                <th class="pb-2 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wide">Statut</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="invoice in recentInvoices"
                :key="invoice.id"
                class="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                @click="router.push(`/invoices/${invoice.id}`)"
              >
                <td class="py-3 font-mono text-xs font-semibold text-[#7C3AED]">
                  {{ invoice.number ?? '—' }}
                </td>
                <td class="py-3 text-[#374151]">{{ formatDate(invoice.issue_date) }}</td>
                <td class="py-3 font-mono font-semibold text-[#111827] tabular-nums">
                  {{ formatCurrency(invoice.total) }}
                </td>
                <td class="py-3">
                  <InvoiceStatusBadge :status="invoice.status" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="mt-4 text-right">
          <RouterLink to="/invoices" class="text-xs text-[#7C3AED] font-medium hover:underline">
            Voir toutes les factures
          </RouterLink>
        </div>
      </template>
    </Card>
  </div>
</template>
