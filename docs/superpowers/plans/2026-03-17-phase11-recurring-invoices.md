# Phase 11 — Facturation récurrente Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'utilisateur de définir des modèles de factures récurrentes (mensuel ou trimestriel) qui génèrent automatiquement des brouillons à la date planifiée, avec possibilité de déclenchement manuel.

**Architecture:** Nouvelle table `recurring_schedules` en base (migration SQL + RLS). Nouveau composable `useRecurringInvoices.ts`. Nouvelle Edge Function `process-recurring-invoices` (déclenchable manuellement ou par pg_cron). Nouvelle page `src/pages/recurring/index.vue`. Entrée dans la sidebar entre "Devis" et "Clients".

**Tech Stack:** Vue 3, Supabase (PostgreSQL, RLS, Edge Functions Deno), Vitest.

---

## Chunk 1 : Base de données

### Task 1 : Migration — table `recurring_schedules`

**Files:**
- Create: `supabase/migrations/013_recurring_schedules.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- Migration 013: recurring invoice schedules

CREATE TYPE public.recurring_frequency AS ENUM ('MONTHLY', 'QUARTERLY');

CREATE TABLE public.recurring_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,

  -- Schedule config
  frequency recurring_frequency NOT NULL DEFAULT 'MONTHLY',
  day_of_month INTEGER NOT NULL DEFAULT 1
    CONSTRAINT day_of_month_range CHECK (day_of_month BETWEEN 1 AND 28),
  next_run_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Invoice template
  template_lines JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Each element: { description: string, quantity: number, unit_price: number, amount: number, sort_order: number }
  payment_term_days INTEGER NOT NULL DEFAULT 30,
  payment_method TEXT NOT NULL DEFAULT 'Virement bancaire',
  vat_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_recurring_schedules_user_id ON public.recurring_schedules(user_id);
CREATE INDEX idx_recurring_schedules_next_run ON public.recurring_schedules(next_run_date) WHERE is_active = true;

-- RLS
ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own recurring schedules"
  ON public.recurring_schedules
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_recurring_schedules_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recurring_schedules_updated_at
  BEFORE UPDATE ON public.recurring_schedules
  FOR EACH ROW EXECUTE FUNCTION update_recurring_schedules_updated_at();
```

- [ ] **Step 2 : Appliquer la migration**

```bash
npx supabase db push
```

- [ ] **Step 3 : Régénérer les types TypeScript**

```bash
npx supabase gen types typescript --local > src/lib/types.ts
```

Vérifier que `recurring_schedules` apparaît dans `src/lib/types.ts`.

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/013_recurring_schedules.sql src/lib/types.ts
git commit -m "feat: add recurring_schedules table with RLS"
```

---

## Chunk 2 : Composable et Edge Function

### Task 2 : Créer `useRecurringInvoices.ts`

**Files:**
- Create: `src/composables/useRecurringInvoices.ts`
- Create: `tests/unit/composables/useRecurringInvoices.test.ts`

- [ ] **Step 1 : Écrire les tests unitaires**

Créer `tests/unit/composables/useRecurringInvoices.test.ts` :

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      mockResolvedValue: vi.fn(),
    })),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { invoicesCreated: 1 }, error: null }),
    },
  },
}))

vi.mock('@/composables/useAuditLog', () => ({
  useAuditLog: () => ({ logAction: vi.fn() }),
}))

describe('computeNextRunDate', () => {
  it('computes next monthly run on day 1', () => {
    // Imported from composable
    const { computeNextRunDate } = require('@/composables/useRecurringInvoices')
    // If today is 2026-03-17 and day_of_month is 1, next run is 2026-04-01
    const result = computeNextRunDate('MONTHLY', 1, new Date('2026-03-17'))
    expect(result).toBe('2026-04-01')
  })

  it('if today is before day_of_month, next run is this month', () => {
    const { computeNextRunDate } = require('@/composables/useRecurringInvoices')
    // Today is 2026-03-05, day_of_month is 15 → next run is 2026-03-15
    const result = computeNextRunDate('MONTHLY', 15, new Date('2026-03-05'))
    expect(result).toBe('2026-03-15')
  })

  it('computes next quarterly run', () => {
    const { computeNextRunDate } = require('@/composables/useRecurringInvoices')
    // Today is 2026-03-17, day_of_month is 1, quarterly → next Q start is 2026-04-01
    const result = computeNextRunDate('QUARTERLY', 1, new Date('2026-03-17'))
    expect(result).toBe('2026-04-01')
  })
})
```

```bash
pnpm test tests/unit/composables/useRecurringInvoices.test.ts
```

Résultat attendu : erreur `computeNextRunDate is not exported`.

- [ ] **Step 2 : Créer `src/composables/useRecurringInvoices.ts`**

```typescript
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { useAuditLog } from '@/composables/useAuditLog'
import type { Database } from '@/lib/types'

type RecurringSchedule = Database['public']['Tables']['recurring_schedules']['Row']
type RecurringFrequency = Database['public']['Enums']['recurring_frequency']

export interface RecurringScheduleFormData {
  client_id: string
  frequency: RecurringFrequency
  day_of_month: number
  payment_term_days: number
  payment_method: string
  vat_rate: number
  notes?: string
  template_lines: Array<{
    description: string
    quantity: number
    unit_price: number
    amount: number
    sort_order: number
  }>
}

/**
 * Computes the next run date for a recurring schedule.
 * Exported for unit testing.
 */
export function computeNextRunDate(
  frequency: RecurringFrequency,
  dayOfMonth: number,
  from: Date = new Date(),
): string {
  const year = from.getFullYear()
  const month = from.getMonth() // 0-indexed
  const day = from.getDate()

  if (frequency === 'MONTHLY') {
    // If today < day_of_month this month → this month
    if (day < dayOfMonth) {
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`
    }
    // Otherwise next month
    const nextMonth = month + 1
    const nextYear = nextMonth > 11 ? year + 1 : year
    const adjustedMonth = nextMonth > 11 ? 0 : nextMonth
    return `${nextYear}-${String(adjustedMonth + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`
  }

  // QUARTERLY: find the start of the next quarter
  // Quarters: Q1=jan-mar, Q2=apr-jun, Q3=jul-sep, Q4=oct-dec
  const currentQuarter = Math.floor(month / 3)
  const nextQuarterStart = (currentQuarter + 1) * 3 // 0-indexed month of next quarter start
  let nextQYear = year
  let nextQMonth = nextQuarterStart
  if (nextQMonth > 11) {
    nextQMonth = 0
    nextQYear = year + 1
  }
  return `${nextQYear}-${String(nextQMonth + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`
}

export function useRecurringInvoices() {
  const authStore = useAuthStore()
  const notifications = useNotificationsStore()
  const { logAction } = useAuditLog()

  const schedules = ref<RecurringSchedule[]>([])
  const loading = ref(false)

  async function fetchSchedules() {
    if (!authStore.user) return
    loading.value = true

    const { data, error } = await supabase
      .from('recurring_schedules')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      notifications.error('Erreur', 'Impossible de charger les modèles récurrents')
    } else {
      schedules.value = data ?? []
    }
    loading.value = false
  }

  async function createSchedule(formData: RecurringScheduleFormData): Promise<RecurringSchedule | null> {
    if (!authStore.user) return null

    const nextRunDate = computeNextRunDate(formData.frequency, formData.day_of_month)

    const { data, error } = await supabase
      .from('recurring_schedules')
      .insert({
        user_id: authStore.user.id,
        client_id: formData.client_id,
        frequency: formData.frequency,
        day_of_month: formData.day_of_month,
        next_run_date: nextRunDate,
        payment_term_days: formData.payment_term_days,
        payment_method: formData.payment_method,
        vat_rate: formData.vat_rate,
        notes: formData.notes || null,
        template_lines: formData.template_lines,
        is_active: true,
      })
      .select()
      .single()

    if (error || !data) {
      notifications.error('Erreur', 'Impossible de créer le modèle récurrent')
      return null
    }

    schedules.value.unshift(data)
    notifications.success('Modèle créé', `Prochaine génération : ${nextRunDate}`)
    await logAction('CREATE_RECURRING', 'recurring_schedules', data.id)
    return data
  }

  async function updateSchedule(
    id: string,
    updates: Partial<RecurringScheduleFormData & { is_active: boolean }>,
  ): Promise<RecurringSchedule | null> {
    const { data, error } = await supabase
      .from('recurring_schedules')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error || !data) {
      notifications.error('Erreur', 'Impossible de mettre à jour le modèle')
      return null
    }

    const idx = schedules.value.findIndex((s) => s.id === id)
    if (idx !== -1) schedules.value[idx] = data
    notifications.success('Modèle mis à jour')
    return data
  }

  async function deleteSchedule(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('recurring_schedules')
      .delete()
      .eq('id', id)

    if (error) {
      notifications.error('Erreur', 'Impossible de supprimer le modèle')
      return false
    }

    schedules.value = schedules.value.filter((s) => s.id !== id)
    notifications.success('Modèle supprimé')
    await logAction('DELETE_RECURRING', 'recurring_schedules', id)
    return true
  }

  async function toggleActive(id: string): Promise<boolean> {
    const schedule = schedules.value.find((s) => s.id === id)
    if (!schedule) return false

    const updated = await updateSchedule(id, { is_active: !schedule.is_active })
    if (updated) {
      notifications.success(updated.is_active ? 'Modèle activé' : 'Modèle désactivé')
    }
    return !!updated
  }

  /**
   * Manually triggers the generation of invoices for all due schedules.
   * Calls the process-recurring-invoices Edge Function.
   */
  async function generateNow(scheduleId?: string): Promise<number> {
    const { data, error } = await supabase.functions.invoke('process-recurring-invoices', {
      body: { scheduleId: scheduleId ?? null },
    })

    if (error || !data) {
      notifications.error('Erreur', 'Impossible de déclencher la génération')
      return 0
    }

    const count = data.invoicesCreated ?? 0
    if (count > 0) {
      notifications.success('Factures générées', `${count} brouillon(s) créé(s)`)
    } else {
      notifications.success('Aucune facture due', 'Aucun modèle à déclencher pour aujourd\'hui')
    }

    // Refresh schedules to get updated next_run_date
    await fetchSchedules()
    return count
  }

  return {
    schedules,
    loading,
    fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    toggleActive,
    generateNow,
  }
}
```

- [ ] **Step 3 : Relancer les tests**

```bash
pnpm test tests/unit/composables/useRecurringInvoices.test.ts
```

- [ ] **Step 4 : Commit**

```bash
git add src/composables/useRecurringInvoices.ts tests/unit/composables/useRecurringInvoices.test.ts
git commit -m "feat: add useRecurringInvoices composable with schedule computation"
```

---

### Task 3 : Créer l'Edge Function `process-recurring-invoices`

**Contexte :** Cette fonction est appelée manuellement via `supabase.functions.invoke`. Elle peut aussi être configurée en pg_cron (voir README). Pour chaque schedule actif dont `next_run_date <= today`, elle crée un brouillon de facture et met à jour `next_run_date`.

**Files:**
- Create: `supabase/functions/process-recurring-invoices/index.ts`

- [ ] **Step 1 : Créer l'Edge Function**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function computeNextRunDate(frequency: string, dayOfMonth: number, from: Date): string {
  const year = from.getFullYear()
  const month = from.getMonth()

  if (frequency === 'MONTHLY') {
    const nextMonth = month + 1
    const nextYear = nextMonth > 11 ? year + 1 : year
    const adjustedMonth = nextMonth > 11 ? 0 : nextMonth
    return `${nextYear}-${String(adjustedMonth + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`
  }

  // QUARTERLY
  const currentQuarter = Math.floor(month / 3)
  const nextQStart = (currentQuarter + 1) * 3
  let nextQYear = year
  let nextQMonth = nextQStart
  if (nextQMonth > 11) { nextQMonth = 0; nextQYear = year + 1 }
  return `${nextQYear}-${String(nextQMonth + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  const { scheduleId } = body;

  const today = new Date().toISOString().slice(0, 10);

  // Fetch due schedules for this user
  let query = supabase
    .from('recurring_schedules')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .lte('next_run_date', today);

  if (scheduleId) {
    query = query.eq('id', scheduleId);
  }

  const { data: schedules, error: schedErr } = await query;
  if (schedErr) return json({ error: schedErr.message }, 500);
  if (!schedules || schedules.length === 0) return json({ invoicesCreated: 0 });

  let invoicesCreated = 0;

  for (const schedule of schedules) {
    const invoiceDate = today;
    const dueDate = new Date(Date.now() + schedule.payment_term_days * 86_400_000)
      .toISOString().slice(0, 10);

    const lines = schedule.template_lines as Array<{
      description: string; quantity: number; unit_price: number; amount: number; sort_order: number;
    }>;

    const subtotal = lines.reduce((sum: number, l: any) => sum + l.amount, 0);
    const vatAmount = subtotal * Number(schedule.vat_rate);
    const total = subtotal + vatAmount;

    // Create invoice
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        user_id: user.id,
        client_id: schedule.client_id,
        issue_date: invoiceDate,
        service_date: invoiceDate,
        due_date: dueDate,
        payment_term_days: schedule.payment_term_days,
        payment_method: schedule.payment_method,
        vat_rate: Number(schedule.vat_rate),
        vat_amount: vatAmount,
        subtotal,
        total,
        notes: schedule.notes || null,
        status: 'DRAFT',
      })
      .select()
      .single();

    if (invErr || !invoice) continue;

    // Insert lines
    if (lines.length > 0) {
      await supabase.from('invoice_lines').insert(
        lines.map((l) => ({ ...l, invoice_id: invoice.id }))
      );
    }

    // Compute next run date
    const nextRun = computeNextRunDate(
      schedule.frequency,
      schedule.day_of_month,
      new Date(today),
    );

    // Update schedule
    await supabase
      .from('recurring_schedules')
      .update({ next_run_date: nextRun, updated_at: new Date().toISOString() })
      .eq('id', schedule.id);

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'CREATE_RECURRING_INVOICE',
      entity: 'invoices',
      entity_id: invoice.id,
      details: { schedule_id: schedule.id, next_run: nextRun },
    });

    invoicesCreated++;
  }

  return json({ invoicesCreated });
});
```

- [ ] **Step 2 : Commit**

```bash
git add supabase/functions/process-recurring-invoices/index.ts
git commit -m "feat: add process-recurring-invoices Edge Function"
```

---

## Chunk 3 : Interface utilisateur

### Task 4 : Créer la page `src/pages/recurring/index.vue`

**Contexte :** Page listant les modèles récurrents avec possibilité de créer, modifier, activer/désactiver, supprimer et déclencher manuellement.

**Files:**
- Create: `src/pages/recurring/index.vue`

- [ ] **Step 1 : Créer la page**

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRecurringInvoices } from '@/composables/useRecurringInvoices'
import { useClients } from '@/composables/useClients'
import { useAuthStore } from '@/stores/auth'
import { formatDate, formatCurrency } from '@/utils/formatters'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
import Modal from '@/components/ui/Modal.vue'
import Input from '@/components/ui/Input.vue'
import Select from '@/components/ui/Select.vue'
import type { Database } from '@/lib/types'

type RecurringSchedule = Database['public']['Tables']['recurring_schedules']['Row']

const authStore = useAuthStore()
const {
  schedules, loading,
  fetchSchedules, createSchedule, updateSchedule, deleteSchedule, toggleActive, generateNow,
} = useRecurringInvoices()
const { clients, fetchClients } = useClients()

onMounted(async () => {
  await Promise.all([fetchSchedules(), fetchClients()])
})

// ── Create/Edit modal ─────────────────────────────────────────────────
const showModal = ref(false)
const editingSchedule = ref<RecurringSchedule | null>(null)
const saving = ref(false)

// Form state
const form = ref({
  client_id: '',
  frequency: 'MONTHLY' as 'MONTHLY' | 'QUARTERLY',
  day_of_month: 1,
  payment_term_days: 30,
  payment_method: 'Virement bancaire',
  vat_rate: authStore.profile?.vat_regime === 'SUBJECT' ? 0.20 : 0,
  notes: '',
  // Lines
  lines: [{ description: '', quantity: 1, unit_price: 0, amount: 0, sort_order: 0 }],
})

function openCreate() {
  editingSchedule.value = null
  form.value = {
    client_id: '',
    frequency: 'MONTHLY',
    day_of_month: 1,
    payment_term_days: 30,
    payment_method: 'Virement bancaire',
    vat_rate: authStore.profile?.vat_regime === 'SUBJECT' ? 0.20 : 0,
    notes: '',
    lines: [{ description: '', quantity: 1, unit_price: 0, amount: 0, sort_order: 0 }],
  }
  showModal.value = true
}

function openEdit(schedule: RecurringSchedule) {
  editingSchedule.value = schedule
  form.value = {
    client_id: schedule.client_id,
    frequency: schedule.frequency,
    day_of_month: schedule.day_of_month,
    payment_term_days: schedule.payment_term_days,
    payment_method: schedule.payment_method,
    vat_rate: Number(schedule.vat_rate),
    notes: schedule.notes ?? '',
    lines: (schedule.template_lines as any[]).length > 0
      ? schedule.template_lines as any[]
      : [{ description: '', quantity: 1, unit_price: 0, amount: 0, sort_order: 0 }],
  }
  showModal.value = true
}

function updateLineAmount(index: number) {
  const line = form.value.lines[index]
  line.amount = Math.round(line.quantity * line.unit_price * 100) / 100
}

function addLine() {
  form.value.lines.push({
    description: '', quantity: 1, unit_price: 0, amount: 0,
    sort_order: form.value.lines.length,
  })
}

function removeLine(index: number) {
  form.value.lines.splice(index, 1)
}

async function handleSave() {
  saving.value = true
  if (editingSchedule.value) {
    await updateSchedule(editingSchedule.value.id, {
      client_id: form.value.client_id,
      frequency: form.value.frequency,
      day_of_month: form.value.day_of_month,
      payment_term_days: form.value.payment_term_days,
      payment_method: form.value.payment_method,
      vat_rate: form.value.vat_rate,
      notes: form.value.notes,
      template_lines: form.value.lines,
    })
  } else {
    await createSchedule({
      client_id: form.value.client_id,
      frequency: form.value.frequency,
      day_of_month: form.value.day_of_month,
      payment_term_days: form.value.payment_term_days,
      payment_method: form.value.payment_method,
      vat_rate: form.value.vat_rate,
      notes: form.value.notes,
      template_lines: form.value.lines,
    })
  }
  saving.value = false
  showModal.value = false
}

// ── Actions ─────────────────────────────────────────────────────────
const generating = ref<string | null>(null)

async function handleGenerateNow(id: string) {
  generating.value = id
  await generateNow(id)
  generating.value = null
}

async function handleDelete(id: string) {
  if (!confirm('Supprimer ce modèle récurrent ?')) return
  await deleteSchedule(id)
}

function clientName(clientId: string): string {
  return clients.value.find((c) => c.id === clientId)?.name ?? '—'
}

function subtotal(schedule: RecurringSchedule): number {
  return (schedule.template_lines as any[]).reduce((sum, l) => sum + l.amount, 0)
}

const frequencyOptions = [
  { value: 'MONTHLY', label: 'Mensuelle' },
  { value: 'QUARTERLY', label: 'Trimestrielle' },
]

const paymentMethods = [
  'Virement bancaire', 'Chèque', 'Espèces', 'Carte bancaire', 'PayPal', 'Autre',
]
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-[22px] font-bold text-[#111827]">Récurrentes</h1>
        <p class="text-sm text-[#6B7280] mt-0.5">
          Modèles de factures générés automatiquement
        </p>
      </div>
      <Button variant="default" size="md" @click="openCreate">
        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
        Nouveau modèle
      </Button>
    </div>

    <!-- Loading -->
    <template v-if="loading">
      <div class="space-y-3">
        <div v-for="i in 3" :key="i" class="h-20 bg-[#F3F4F6] rounded-xl animate-pulse" />
      </div>
    </template>

    <!-- Empty state -->
    <template v-else-if="schedules.length === 0">
      <Card>
        <div class="py-12 text-center">
          <svg class="mx-auto h-12 w-12 text-[#D1D5DB]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <h3 class="mt-3 text-sm font-semibold text-[#111827]">Aucun modèle récurrent</h3>
          <p class="mt-1 text-sm text-[#6B7280]">
            Créez un modèle pour générer automatiquement vos factures mensuelles ou trimestrielles.
          </p>
          <Button variant="default" size="sm" class="mt-4" @click="openCreate">
            Créer un modèle
          </Button>
        </div>
      </Card>
    </template>

    <!-- Schedule list -->
    <template v-else>
      <div class="space-y-3">
        <Card
          v-for="schedule in schedules"
          :key="schedule.id"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-semibold text-[#111827]">{{ clientName(schedule.client_id) }}</span>
                <Badge :variant="schedule.frequency === 'MONTHLY' ? 'default' : 'outline'">
                  {{ schedule.frequency === 'MONTHLY' ? 'Mensuelle' : 'Trimestrielle' }}
                </Badge>
                <Badge :variant="schedule.is_active ? 'success' : 'secondary'">
                  {{ schedule.is_active ? 'Actif' : 'Inactif' }}
                </Badge>
              </div>
              <div class="mt-1 flex items-center gap-4 text-sm text-[#6B7280]">
                <span>
                  Prochaine génération :
                  <span class="font-medium text-[#374151]">{{ formatDate(schedule.next_run_date) }}</span>
                </span>
                <span>
                  Montant HT :
                  <span class="font-mono font-medium text-[#374151]">{{ formatCurrency(subtotal(schedule)) }}</span>
                </span>
                <span>Le {{ schedule.day_of_month }} du mois</span>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                :loading="generating === schedule.id"
                @click="handleGenerateNow(schedule.id)"
              >
                Générer maintenant
              </Button>
              <button
                class="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors"
                title="Activer/Désactiver"
                @click="toggleActive(schedule.id)"
              >
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button
                class="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors"
                title="Modifier"
                @click="openEdit(schedule)"
              >
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
              <button
                class="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                title="Supprimer"
                @click="handleDelete(schedule.id)"
              >
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </Card>
      </div>
    </template>

    <!-- Create/Edit modal -->
    <Modal
      v-model="showModal"
      :title="editingSchedule ? 'Modifier le modèle' : 'Nouveau modèle récurrent'"
      size="lg"
    >
      <div class="space-y-4">
        <!-- Client -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-[#374151]">Client <span class="text-[#DC2626]">*</span></label>
          <select
            v-model="form.client_id"
            class="w-full h-9 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
          >
            <option value="" disabled>Sélectionner un client</option>
            <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>

        <!-- Frequency + Day -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-[#374151]">Fréquence</label>
            <select
              v-model="form.frequency"
              class="w-full h-9 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            >
              <option v-for="opt in frequencyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <Input
            v-model.number="form.day_of_month"
            label="Jour du mois (1-28)"
            type="number"
            min="1"
            max="28"
          />
        </div>

        <!-- Payment -->
        <div class="grid grid-cols-2 gap-4">
          <Input
            v-model.number="form.payment_term_days"
            label="Délai de paiement (jours)"
            type="number"
          />
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-[#374151]">Mode de règlement</label>
            <select
              v-model="form.payment_method"
              class="w-full h-9 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            >
              <option v-for="m in paymentMethods" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
        </div>

        <!-- Lines -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium text-[#374151]">Prestations</label>
            <button
              type="button"
              class="text-xs text-[#7C3AED] hover:underline"
              @click="addLine"
            >
              + Ajouter une ligne
            </button>
          </div>
          <div
            v-for="(line, idx) in form.lines"
            :key="idx"
            class="grid grid-cols-12 gap-2 items-end"
          >
            <div class="col-span-5">
              <Input v-model="line.description" :label="idx === 0 ? 'Description' : ''" placeholder="Ex: Développement web" />
            </div>
            <div class="col-span-2">
              <Input
                v-model.number="line.quantity"
                :label="idx === 0 ? 'Qté' : ''"
                type="number"
                min="0"
                step="0.5"
                @input="updateLineAmount(idx)"
              />
            </div>
            <div class="col-span-3">
              <Input
                v-model.number="line.unit_price"
                :label="idx === 0 ? 'P.U. HT' : ''"
                type="number"
                min="0"
                step="0.01"
                @input="updateLineAmount(idx)"
              />
            </div>
            <div class="col-span-1">
              <p class="text-xs text-[#6B7280] font-mono tabular-nums text-right pt-5">
                {{ formatCurrency(line.amount) }}
              </p>
            </div>
            <div class="col-span-1 flex justify-end">
              <button
                v-if="form.lines.length > 1"
                type="button"
                class="p-1 text-[#9CA3AF] hover:text-[#DC2626] mt-5"
                @click="removeLine(idx)"
              >
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <Input v-model="form.notes" label="Notes (facultatif)" placeholder="Visible sur la facture" />
      </div>

      <template #footer>
        <Button variant="ghost" @click="showModal = false">Annuler</Button>
        <Button
          variant="default"
          :loading="saving"
          :disabled="!form.client_id || form.lines.every(l => !l.description)"
          @click="handleSave"
        >
          {{ editingSchedule ? 'Enregistrer' : 'Créer le modèle' }}
        </Button>
      </template>
    </Modal>
  </div>
</template>
```

- [ ] **Step 2 : Commit**

```bash
git add src/pages/recurring/index.vue
git commit -m "feat: add recurring invoices page"
```

---

### Task 5 : Ajouter l'entrée "Récurrentes" dans la sidebar

**Files:**
- Modify: `src/components/layout/AppSidebar.vue`

- [ ] **Step 1 : Ajouter l'item dans `navItems`**

Dans `src/components/layout/AppSidebar.vue`, modifier le tableau `navItems` — ajouter après `quotes` :

```typescript
{ label: 'Récurrentes', path: '/recurring', icon: 'recurring' },
```

- [ ] **Step 2 : Ajouter l'icône "recurring" dans le template**

Dans le bloc de v-if/v-else-if des icônes, ajouter après le bloc `quotes` :

```vue
<!-- Recurring icon -->
<svg
  v-else-if="item.icon === 'recurring'"
  class="w-4 h-4 shrink-0"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d="M17 1l4 4-4 4" />
  <path d="M3 11V9a4 4 0 014-4h14" />
  <path d="M7 23l-4-4 4-4" />
  <path d="M21 13v2a4 4 0 01-4 4H3" />
</svg>
```

- [ ] **Step 3 : Ajouter la route dans `src/router/index.ts`**

Lire `src/router/index.ts` et ajouter la route :

```typescript
{
  path: '/recurring',
  component: () => import('@/pages/recurring/index.vue'),
  meta: { requiresAuth: true },
},
```

- [ ] **Step 4 : Lancer les tests**

```bash
pnpm test
```

- [ ] **Step 5 : Commit**

```bash
git add src/components/layout/AppSidebar.vue src/router/index.ts
git commit -m "feat: add recurring invoices to sidebar navigation"
```

---

## Critères de succès

- [ ] `recurring_schedules` table existe avec RLS (seul l'utilisateur peut CRUD ses propres schedules)
- [ ] `computeNextRunDate` passe ses tests unitaires (mensuel / trimestriel / avant-le-jour-du-mois)
- [ ] Création d'un modèle → `next_run_date` correctement calculée
- [ ] "Générer maintenant" → crée un brouillon de facture avec les bonnes lignes
- [ ] Après génération → `next_run_date` est avancée au prochain cycle
- [ ] Activer/désactiver un modèle fonctionne
- [ ] Page `/recurring` accessible depuis la sidebar
- [ ] `pnpm test` → tous les tests passent
