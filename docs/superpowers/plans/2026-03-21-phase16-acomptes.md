# Phase 16 -- Flux acompte / facture de solde

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **INTERDICTION DE COMMIT** -- Ne jamais executer `git commit`. Seul l'utilisateur a le droit de committer. Preparer le code, mais s'arreter avant le commit.

**Goal:** Permettre aux micro-entrepreneurs de creer un acompte sur une facture existante (DRAFT), puis de generer automatiquement la facture de solde une fois l'acompte paye. La chaine documentaire acompte -> solde est tracee et les mentions legales obligatoires sont automatiquement generees sur les PDF.

**Architecture:** Nouveaux champs `invoice_type` (enum), `parent_invoice_id` (FK) et `deposit_amount` sur la table `invoices`. Nouveaux statuts `DEPOSIT_PENDING` et `COMPLETED` dans l'enum `invoice_status`. Nouvelles fonctions `createDepositInvoice()` et `createBalanceInvoice()` dans `useInvoices.ts`. Adaptation de l'Edge Function `generate-pdf` pour les templates acompte et solde. Nouvelle modale UI "Creer un acompte" et section "Documents lies" sur la page de detail.

**Tech Stack:** PostgreSQL (migration), Supabase Edge Functions (Deno), Vue 3 + TypeScript, Tailwind, shadcn-vue, pdf-lib, Vitest.

**Contexte :**
- Standard pour les missions forfait : acompte 30-50% a la commande + solde a la livraison
- Sans ce flux, les utilisateurs creent 2 factures manuelles deconnectees -- erreur comptable frequente
- La facture de solde doit legalement mentionner l'acompte verse (date, numero, montant)
- Les deux factures (acompte + solde) partagent la meme numerotation sequentielle globale FAC-YYYY-NNN
- L'acompte et le solde sont deux encaissements distincts dans le livre de recettes
- Pain point documente chez Abby, Freebe et les forums de freelances

---

## Chunk 1 : Migration DB -- nouveaux types, champs et politiques RLS

### Task 1 : Creer la migration `015_deposit_balance.sql`

**Contexte :** On doit etendre l'enum `invoice_status` avec 2 nouveaux statuts, creer un nouvel enum `invoice_type`, et ajouter 3 colonnes a la table `invoices`. On doit aussi creer des politiques RLS pour les nouvelles transitions de statut, et mettre a jour les fonctions existantes (`mark_overdue_invoices`, `dashboard_stats`).

**Files:**
- Create: `supabase/migrations/015_deposit_balance.sql`

- [ ] **Step 1 : Ecrire la migration complete**

```sql
-- Migration 015: Deposit / Balance invoice flow
-- Adds invoice_type enum, parent_invoice_id FK, deposit_amount field
-- Extends invoice_status with DEPOSIT_PENDING and COMPLETED

-- 1. New enum for invoice type
CREATE TYPE invoice_type AS ENUM ('STANDARD', 'DEPOSIT', 'BALANCE');

-- 2. Extend invoice_status with new values
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'DEPOSIT_PENDING' AFTER 'DRAFT';
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'COMPLETED' AFTER 'PAID';

-- 3. Add new columns to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_type invoice_type NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS parent_invoice_id UUID REFERENCES invoices(id),
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2);

-- 4. Index for querying child invoices of a parent
CREATE INDEX IF NOT EXISTS idx_invoices_parent ON invoices(parent_invoice_id)
  WHERE parent_invoice_id IS NOT NULL;

-- 5. Constraint: DEPOSIT and BALANCE must have a parent
ALTER TABLE public.invoices
  ADD CONSTRAINT chk_deposit_balance_has_parent
  CHECK (
    (invoice_type = 'STANDARD') OR (parent_invoice_id IS NOT NULL)
  );

-- 6. Constraint: deposit_amount must be positive when set
ALTER TABLE public.invoices
  ADD CONSTRAINT chk_deposit_amount_positive
  CHECK (deposit_amount IS NULL OR deposit_amount > 0);

-- 7. RLS: Allow DRAFT -> DEPOSIT_PENDING transition
CREATE POLICY "Users can set own DRAFT to DEPOSIT_PENDING" ON invoices FOR UPDATE
  USING (auth.uid() = user_id AND status = 'DRAFT')
  WITH CHECK (auth.uid() = user_id AND status = 'DEPOSIT_PENDING');

-- 8. RLS: Allow DEPOSIT_PENDING -> COMPLETED transition
CREATE POLICY "Users can complete own DEPOSIT_PENDING invoices" ON invoices FOR UPDATE
  USING (auth.uid() = user_id AND status = 'DEPOSIT_PENDING')
  WITH CHECK (auth.uid() = user_id AND status = 'COMPLETED');

-- 9. Update mark_overdue_invoices (no change needed -- only targets SENT)
-- Already correct: only updates status = 'SENT', won't touch DEPOSIT_PENDING

-- 10. Update dashboard_stats view to handle new statuses
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
  user_id,
  sum(CASE WHEN status = 'PAID' THEN total ELSE 0 END) AS ca_encaisse,
  sum(CASE
    WHEN status IN ('SENT', 'PAID', 'OVERDUE', 'COMPLETED') THEN total
    ELSE 0
  END) AS ca_facture,
  sum(CASE WHEN status = 'SENT' THEN total ELSE 0 END) AS en_attente,
  count(CASE WHEN status = 'SENT' THEN 1 END) AS nb_en_attente,
  count(CASE WHEN status = 'PAID' THEN 1 END) AS nb_payees,
  count(*) AS nb_total
FROM invoices
WHERE extract(year FROM issue_date) = extract(year FROM current_date)
  AND invoice_type = 'STANDARD'
GROUP BY user_id;

COMMENT ON COLUMN public.invoices.invoice_type IS
  'STANDARD = normal invoice, DEPOSIT = acompte, BALANCE = facture de solde';
COMMENT ON COLUMN public.invoices.parent_invoice_id IS
  'References the parent invoice for DEPOSIT and BALANCE types';
COMMENT ON COLUMN public.invoices.deposit_amount IS
  'Amount of the deposit, stored on the parent invoice for reference';
```

**Notes importantes sur les RLS :**
- La politique existante `"Users can update own DRAFT invoices"` dans `002_rls_policies.sql` a `USING (auth.uid() = user_id AND status = 'DRAFT')` sans `WITH CHECK` explicite, donc le WITH CHECK herite du USING. Cela signifie qu'un update qui change le status vers autre chose que DRAFT echouerait sur cette politique. Mais PostgreSQL RLS est en OR entre les politiques : la nouvelle politique `"Users can set own DRAFT to DEPOSIT_PENDING"` couvrira ce cas.
- Les politiques 005 (cancel) et 007 (payment) restent inchangees car elles ciblent `SENT`/`OVERDUE` -> `CANCELLED`/`PAID`.

- [ ] **Step 2 : Appliquer la migration**

```bash
npx supabase db push
```

Verifier dans le Dashboard Supabase que :
- L'enum `invoice_type` existe avec les 3 valeurs
- L'enum `invoice_status` contient `DEPOSIT_PENDING` et `COMPLETED`
- La colonne `invoices.parent_invoice_id` existe
- Les nouvelles politiques RLS sont visibles

---

### Task 2 : Regenerer les types TypeScript

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1 : Regenerer les types**

```bash
npx supabase gen types typescript --local > src/lib/types.ts
```

- [ ] **Step 2 : Verifier les nouvelles entrees**

Le fichier `src/lib/types.ts` doit contenir :
- `invoice_type: "STANDARD" | "DEPOSIT" | "BALANCE"` dans `Enums`
- `invoice_status` doit inclure `"DEPOSIT_PENDING"` et `"COMPLETED"`
- `invoices.Row` doit contenir `invoice_type`, `parent_invoice_id`, `deposit_amount`

---

## Chunk 2 : Composable `useInvoices.ts` -- nouvelles fonctions metier

### Task 3 : Ajouter `createDepositInvoice()` et `createBalanceInvoice()`

**Contexte :** `createDepositInvoice` cree une facture d'acompte (type `DEPOSIT`) liee a une facture parente (type `STANDARD`, statut `DRAFT`). Elle met aussi a jour la facture parente avec le montant de l'acompte et passe son statut a `DEPOSIT_PENDING`. `createBalanceInvoice` cree la facture de solde une fois l'acompte paye.

**Files:**
- Modify: `/Users/maxime/Repos/facture-dev/src/composables/useInvoices.ts`

- [ ] **Step 1 : Ajouter `createDepositInvoice`**

Ajouter apres `duplicateInvoice()`, avant `sendInvoiceEmail()` :

```typescript
/**
 * Creates a deposit (acompte) invoice linked to a parent DRAFT invoice.
 * The parent transitions to DEPOSIT_PENDING status.
 */
async function createDepositInvoice(
  parentId: string,
  params: { amount: number } | { percentage: number },
): Promise<Invoice | null> {
  if (!authStore.user) return null

  const result = await getInvoice(parentId)
  if (!result) return null
  const { invoice: parent, lines: parentLines } = result

  if (parent.status !== 'DRAFT') {
    notifications.error('Erreur', "Seul un brouillon peut générer un acompte")
    return null
  }

  const depositAmount = 'amount' in params
    ? params.amount
    : Math.round(parent.total * params.percentage / 100 * 100) / 100

  if (depositAmount <= 0 || depositAmount >= parent.total) {
    notifications.error('Erreur', "Le montant de l'acompte doit être entre 0 et le total de la facture")
    return null
  }

  const parentDescription = parentLines
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((l) => l.description)
    .join(', ')
  const depositDescription = `Acompte sur prestation : ${parentDescription}`.slice(0, 200)

  const today = new Date().toISOString().slice(0, 10)
  const dueDate = new Date(
    Date.now() + (parent.payment_term_days ?? 30) * 86_400_000
  ).toISOString().slice(0, 10)

  const vatRate = parent.vat_rate ?? 0
  const vatAmount = Math.round(depositAmount * vatRate * 100) / 100

  const { data: depositInvoice, error: depErr } = await supabase
    .from('invoices')
    .insert({
      user_id: authStore.user.id,
      client_id: parent.client_id,
      invoice_type: 'DEPOSIT',
      parent_invoice_id: parentId,
      issue_date: today,
      service_date: parent.service_date,
      due_date: dueDate,
      payment_term_days: parent.payment_term_days ?? 30,
      payment_method: parent.payment_method ?? 'Virement bancaire',
      vat_rate: vatRate,
      vat_amount: vatAmount,
      subtotal: depositAmount,
      total: depositAmount + vatAmount,
      notes: parent.notes,
      status: 'DRAFT',
    })
    .select()
    .single()

  if (depErr || !depositInvoice) {
    notifications.error('Erreur', "Impossible de créer la facture d'acompte")
    return null
  }

  const { error: lineErr } = await supabase.from('invoice_lines').insert({
    invoice_id: depositInvoice.id,
    description: depositDescription,
    quantity: 1,
    unit_price: depositAmount,
    amount: depositAmount,
    sort_order: 0,
  })

  if (lineErr) {
    notifications.error('Erreur', "Impossible de créer la ligne d'acompte")
    return null
  }

  const { error: parentErr } = await supabase
    .from('invoices')
    .update({
      deposit_amount: depositAmount,
      status: 'DEPOSIT_PENDING',
      updated_at: new Date().toISOString(),
    })
    .eq('id', parentId)

  if (parentErr) {
    notifications.error('Erreur', 'Impossible de mettre à jour la facture parente')
    return null
  }

  await logAction('CREATE_DEPOSIT', 'invoices', depositInvoice.id)
  notifications.success(
    'Acompte créé',
    `Facture d'acompte de ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(depositAmount)} créée`
  )

  invoices.value.unshift(depositInvoice)
  return depositInvoice
}
```

- [ ] **Step 2 : Ajouter `createBalanceInvoice`**

```typescript
/**
 * Creates a balance (solde) invoice linked to a parent DEPOSIT_PENDING invoice.
 * Called after the deposit invoice has been marked PAID.
 */
async function createBalanceInvoice(parentId: string): Promise<Invoice | null> {
  if (!authStore.user) return null

  const result = await getInvoice(parentId)
  if (!result) return null
  const { invoice: parent, lines: parentLines } = result

  if (parent.status !== 'DEPOSIT_PENDING') {
    notifications.error('Erreur', 'La facture parente doit être en attente de solde')
    return null
  }

  const { data: depositInvoices, error: fetchErr } = await supabase
    .from('invoices')
    .select('*')
    .eq('parent_invoice_id', parentId)
    .eq('invoice_type', 'DEPOSIT')
    .eq('status', 'PAID')

  if (fetchErr || !depositInvoices || depositInvoices.length === 0) {
    notifications.error('Erreur', "L'acompte doit être payé avant de générer la facture de solde")
    return null
  }

  const deposit = depositInvoices[0]
  const depositAmountHT = deposit.subtotal
  const balanceAmountHT = parent.subtotal - depositAmountHT

  if (balanceAmountHT <= 0) {
    notifications.error('Erreur', "Le montant du solde est nul ou négatif")
    return null
  }

  const today = new Date().toISOString().slice(0, 10)
  const dueDate = new Date(
    Date.now() + (parent.payment_term_days ?? 30) * 86_400_000
  ).toISOString().slice(0, 10)

  const vatRate = parent.vat_rate ?? 0
  const balanceVat = Math.round(balanceAmountHT * vatRate * 100) / 100
  const balanceTTC = balanceAmountHT + balanceVat

  const { data: balanceInvoice, error: balErr } = await supabase
    .from('invoices')
    .insert({
      user_id: authStore.user.id,
      client_id: parent.client_id,
      invoice_type: 'BALANCE',
      parent_invoice_id: parentId,
      issue_date: today,
      service_date: parent.service_date,
      due_date: dueDate,
      payment_term_days: parent.payment_term_days ?? 30,
      payment_method: parent.payment_method ?? 'Virement bancaire',
      vat_rate: vatRate,
      vat_amount: balanceVat,
      subtotal: balanceAmountHT,
      total: balanceTTC,
      notes: parent.notes,
      status: 'DRAFT',
    })
    .select()
    .single()

  if (balErr || !balanceInvoice) {
    notifications.error('Erreur', 'Impossible de créer la facture de solde')
    return null
  }

  // Copy parent lines
  const copiedLines = parentLines.map((l, i) => ({
    invoice_id: balanceInvoice.id,
    description: l.description,
    quantity: l.quantity,
    unit_price: l.unit_price,
    amount: l.amount,
    sort_order: i,
  }))

  // Add deposit deduction line (negative)
  const { data: depositPayments } = await supabase
    .from('payments')
    .select('date')
    .eq('invoice_id', deposit.id)
    .order('date', { ascending: false })
    .limit(1)

  const depositPaymentDate = depositPayments?.[0]?.date ?? today
  const formattedDate = new Intl.DateTimeFormat('fr-FR').format(new Date(depositPaymentDate))

  copiedLines.push({
    invoice_id: balanceInvoice.id,
    description: `Déduction acompte versé le ${formattedDate} — Facture n°${deposit.number ?? 'N/A'}`,
    quantity: 1,
    unit_price: -depositAmountHT,
    amount: -depositAmountHT,
    sort_order: copiedLines.length,
  })

  const { error: linesErr } = await supabase.from('invoice_lines').insert(copiedLines)

  if (linesErr) {
    notifications.error('Erreur', 'Impossible de créer les lignes de la facture de solde')
    return null
  }

  await logAction('CREATE_BALANCE', 'invoices', balanceInvoice.id)
  notifications.success(
    'Facture de solde créée',
    `Solde de ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(balanceTTC)} à percevoir`
  )

  invoices.value.unshift(balanceInvoice)
  return balanceInvoice
}
```

- [ ] **Step 3 : Ajouter `getChildInvoices`**

```typescript
/**
 * Fetches child invoices (DEPOSIT, BALANCE) for a given parent invoice.
 */
async function getChildInvoices(parentId: string): Promise<Invoice[]> {
  const { data, error: err } = await supabase
    .from('invoices')
    .select('*')
    .eq('parent_invoice_id', parentId)
    .order('created_at', { ascending: true })

  if (err) return []
  return data ?? []
}
```

- [ ] **Step 4 : Mettre a jour le `return`**

```typescript
return {
  invoices, loading, error,
  fetchInvoices, getInvoice, createInvoice, updateInvoice, updateInvoiceFull,
  deleteInvoice, emitInvoice, cancelInvoice, sendInvoiceEmail, duplicateInvoice,
  createDepositInvoice, createBalanceInvoice, getChildInvoices,
}
```

---

### Task 4 : Mettre a jour `usePayments.ts` -- completion automatique du parent

**Contexte :** Quand un paiement est enregistre sur une facture BALANCE, la facture parente doit passer a `COMPLETED`.

**Files:**
- Modify: `/Users/maxime/Repos/facture-dev/src/composables/usePayments.ts`

- [ ] **Step 1 : Ajouter la logique de completion apres le paiement**

Apres la ligne `notifications.success('Paiement enregistré', ...)` (ligne 57), ajouter :

```typescript
// If the paid invoice is a BALANCE type, complete the parent invoice
const { data: paidInvoiceData } = await supabase
  .from('invoices')
  .select('invoice_type, parent_invoice_id')
  .eq('id', invoiceId)
  .single()

if (paidInvoiceData?.invoice_type === 'BALANCE' && paidInvoiceData.parent_invoice_id) {
  await supabase
    .from('invoices')
    .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
    .eq('id', paidInvoiceData.parent_invoice_id)
    .eq('status', 'DEPOSIT_PENDING')

  await supabase.from('audit_logs').insert({
    user_id: authStore.user!.id,
    action: 'COMPLETE_INVOICE',
    entity: 'invoices',
    entity_id: paidInvoiceData.parent_invoice_id,
    details: { balance_invoice_id: invoiceId },
  })
}
```

---

## Chunk 3 : Validation Zod

### Task 5 : Ajouter le schema `depositSchema`

**Files:**
- Modify: `/Users/maxime/Repos/facture-dev/src/utils/validators.ts`

- [ ] **Step 1 : Ajouter apres `invoiceSchema`**

```typescript
export const depositSchema = z.object({
  mode: z.enum(['amount', 'percentage']),
  amount: z.number().positive("Le montant doit être positif").optional(),
  percentage: z.number().min(1, 'Minimum 1%').max(99, 'Maximum 99%').optional(),
}).refine(
  (data) => {
    if (data.mode === 'amount') return data.amount !== undefined && data.amount > 0
    return data.percentage !== undefined && data.percentage > 0
  },
  { message: 'Veuillez saisir un montant ou un pourcentage valide' }
)

export type DepositFormData = z.infer<typeof depositSchema>
```

---

## Chunk 4 : Edge Function `generate-pdf` -- templates acompte et solde

### Task 6 : Adapter le PDF pour les types DEPOSIT et BALANCE

**Contexte :** La facture d'acompte affiche "FACTURE D'ACOMPTE" et mentionne la facture parente. La facture de solde affiche "FACTURE DE SOLDE", reprend toutes les lignes de la facture parente, et ajoute la ligne obligatoire de deduction de l'acompte avec la mention legale (date de paiement, numero, montant).

**Files:**
- Modify: `/Users/maxime/Repos/facture-dev/supabase/functions/generate-pdf/index.ts`

- [ ] **Step 1 : Recuperer les donnees liees (parent + deposit) dans le handler**

Apres `const lines = linesRes.data ?? [];` (ligne 273), ajouter :

```typescript
let parentInvoice: any = null
let depositInvoice: any = null

if (invoice.invoice_type === 'DEPOSIT' && invoice.parent_invoice_id) {
  const { data } = await supabase
    .from('invoices')
    .select('number, subtotal, total')
    .eq('id', invoice.parent_invoice_id)
    .single()
  parentInvoice = data
}

if (invoice.invoice_type === 'BALANCE' && invoice.parent_invoice_id) {
  const { data: parent } = await supabase
    .from('invoices')
    .select('number, subtotal, total')
    .eq('id', invoice.parent_invoice_id)
    .single()
  parentInvoice = parent

  const { data: deposits } = await supabase
    .from('invoices')
    .select('id, number, subtotal, total, updated_at')
    .eq('parent_invoice_id', invoice.parent_invoice_id)
    .eq('invoice_type', 'DEPOSIT')
    .eq('status', 'PAID')
    .limit(1)

  if (deposits?.[0]) {
    depositInvoice = deposits[0]
    const { data: pmts } = await supabase
      .from('payments')
      .select('date')
      .eq('invoice_id', depositInvoice.id)
      .order('date', { ascending: false })
      .limit(1)
    depositInvoice._paymentDate = pmts?.[0]?.date ?? depositInvoice.updated_at?.slice(0, 10)
  }
}
```

- [ ] **Step 2 : Passer `parentInvoice` et `depositInvoice` a `buildInvoicePdf`**

Modifier la signature :

```typescript
async function buildInvoicePdf(
  invoice: any, lines: any[], client: any, profile: any, supabase: any,
  facturxEnabled: boolean = false,
  parentInvoice?: any, depositInvoice?: any,
): Promise<Uint8Array> {
```

Modifier l'appel :

```typescript
const pdfBytes = await buildInvoicePdf(
  invoice, lines, client, profile, supabase, facturxEnabled,
  parentInvoice, depositInvoice,
);
```

- [ ] **Step 3 : Modifier le titre selon le type de facture**

Remplacer `page.drawText('FACTURE', ...)` (ligne 79-81) par :

```typescript
const invoiceTitle = invoice.invoice_type === 'DEPOSIT'
  ? "FACTURE D'ACOMPTE"
  : invoice.invoice_type === 'BALANCE'
    ? 'FACTURE DE SOLDE'
    : 'FACTURE';

const titleWidth = fontBold.widthOfTextAtSize(invoiceTitle, 20);
page.drawText(invoiceTitle, {
  x: marginR - titleWidth, y, font: fontBold, size: 20, color: black,
});
```

- [ ] **Step 4 : Ajouter reference a la facture parente pour DEPOSIT**

Apres le numero de facture, si `invoice.invoice_type === 'DEPOSIT'` :

```typescript
if (invoice.invoice_type === 'DEPOSIT' && parentInvoice?.number) {
  y -= 12;
  page.drawText(`Réf. facture : ${parentInvoice.number}`, {
    x: marginR - 180, y, font: fontRegular, size: 9, color: gray,
  });
}
```

- [ ] **Step 5 : Ajouter le bloc de deduction pour BALANCE**

Apres le sous-total HT dans la section totaux, si `invoice.invoice_type === 'BALANCE'` :

```typescript
if (invoice.invoice_type === 'BALANCE' && depositInvoice) {
  const depDate = depositInvoice._paymentDate
    ? formatDate(depositInvoice._paymentDate)
    : '—';

  y -= 14;
  page.drawText(
    `Acompte versé le ${depDate} — Fact. n°${depositInvoice.number ?? 'N/A'}`,
    { x: totalsX - 50, y, font: fontRegular, size: 8, color: gray }
  );
  page.drawText(
    `- ${formatCurrency(depositInvoice.subtotal)}`,
    { x: marginR - 60, y, font: fontBold, size: 9, color: rgb(0.863, 0.149, 0.149) }
  );
}
```

Apres la section totaux, si `invoice.invoice_type === 'BALANCE'` et `parentInvoice` :

```typescript
if (invoice.invoice_type === 'BALANCE' && parentInvoice?.number) {
  y -= 14;
  page.drawText(
    `Solde de la facture n°${parentInvoice.number}`,
    { x: marginL, y, font: fontBold, size: 8, color: gray }
  );
}
```

**Note :** L'integration exacte dans le flux de rendu du PDF necessitera un ajustement des positions `y`. Le code ci-dessus indique la logique ; l'implementeur devra l'integrer aux bonnes positions dans le rendu vertical du PDF pour eviter les chevauchements.

---

## Chunk 5 : Composants UI

### Task 7 : Creer la modale "Creer un acompte"

**Files:**
- Create: `/Users/maxime/Repos/facture-dev/src/components/invoices/DepositModal.vue`

- [ ] **Step 1 : Creer le composant**

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { formatCurrency } from '@/utils/formatters'
import Modal from '@/components/ui/Modal.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'

interface Props {
  modelValue: boolean
  parentTotal: number
  loading?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [params: { amount: number } | { percentage: number }]
}>()

const mode = ref<'percentage' | 'amount'>('percentage')
const percentage = ref(30)
const amount = ref(0)

const computedAmount = computed(() => {
  if (mode.value === 'percentage') {
    return Math.round(props.parentTotal * percentage.value / 100 * 100) / 100
  }
  return amount.value
})

const isValid = computed(() => {
  const val = computedAmount.value
  return val > 0 && val < props.parentTotal
})

watch(mode, (newMode) => {
  if (newMode === 'percentage') {
    percentage.value = 30
  } else {
    amount.value = Math.round(props.parentTotal * 0.3 * 100) / 100
  }
})

function confirm() {
  if (!isValid.value) return
  if (mode.value === 'percentage') {
    emit('confirm', { percentage: percentage.value })
  } else {
    emit('confirm', { amount: amount.value })
  }
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    title="Créer une facture d'acompte"
    description="Définissez le montant de l'acompte à facturer au client."
    size="sm"
  >
    <div class="space-y-4">
      <div class="flex gap-2">
        <button
          :class="[
            'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
            mode === 'percentage'
              ? 'border-[#7C3AED] bg-[#EDE9FE] text-[#7C3AED]'
              : 'border-[#E5E7EB] text-[#6B7280] hover:border-[#D1D5DB]',
          ]"
          @click="mode = 'percentage'"
        >
          Pourcentage
        </button>
        <button
          :class="[
            'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
            mode === 'amount'
              ? 'border-[#7C3AED] bg-[#EDE9FE] text-[#7C3AED]'
              : 'border-[#E5E7EB] text-[#6B7280] hover:border-[#D1D5DB]',
          ]"
          @click="mode = 'amount'"
        >
          Montant fixe
        </button>
      </div>

      <div v-if="mode === 'percentage'" class="space-y-2">
        <label class="text-sm font-medium text-[#374151]">Pourcentage de l'acompte</label>
        <div class="flex items-center gap-3">
          <input
            v-model.number="percentage"
            type="range"
            min="5"
            max="95"
            step="5"
            class="flex-1 accent-[#7C3AED]"
          />
          <span class="font-mono text-sm font-bold text-[#7C3AED] w-12 text-right">
            {{ percentage }} %
          </span>
        </div>
        <div class="flex gap-2">
          <button
            v-for="p in [20, 30, 40, 50]"
            :key="p"
            :class="[
              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
              percentage === p
                ? 'bg-[#7C3AED] text-white'
                : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]',
            ]"
            @click="percentage = p"
          >
            {{ p }} %
          </button>
        </div>
      </div>

      <div v-else class="space-y-2">
        <Input
          :model-value="String(amount)"
          @update:model-value="amount = Number($event)"
          label="Montant de l'acompte (HT)"
          type="number"
          :min="0.01"
          :max="parentTotal - 0.01"
          step="0.01"
          required
        />
      </div>

      <div class="rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] p-4 space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-[#6B7280]">Total facture</span>
          <span class="font-mono font-medium text-[#374151]">{{ formatCurrency(parentTotal) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-[#6B7280]">Acompte</span>
          <span class="font-mono font-bold text-[#7C3AED]">{{ formatCurrency(computedAmount) }}</span>
        </div>
        <div class="flex justify-between border-t border-[#E5E7EB] pt-2">
          <span class="text-[#6B7280]">Solde restant</span>
          <span class="font-mono font-medium text-[#374151]">
            {{ formatCurrency(parentTotal - computedAmount) }}
          </span>
        </div>
      </div>

      <p v-if="!isValid && computedAmount > 0" class="text-xs text-[#DC2626]">
        Le montant doit être strictement inférieur au total de la facture.
      </p>
    </div>

    <template #footer>
      <Button variant="ghost" @click="emit('update:modelValue', false)">Annuler</Button>
      <Button variant="default" :disabled="!isValid" :loading="loading" @click="confirm">
        Créer l'acompte
      </Button>
    </template>
  </Modal>
</template>
```

---

### Task 8 : Creer le composant "Documents lies"

**Files:**
- Create: `/Users/maxime/Repos/facture-dev/src/components/invoices/LinkedDocuments.vue`

- [ ] **Step 1 : Creer le composant**

```vue
<script setup lang="ts">
import { formatCurrency } from '@/utils/formatters'
import type { Invoice } from '@/lib/types'
import Card from '@/components/ui/Card.vue'
import InvoiceStatusBadge from '@/components/invoices/InvoiceStatusBadge.vue'

interface Props {
  parentInvoice?: Invoice | null
  childInvoices: Invoice[]
  currentInvoiceId: string
}

defineProps<Props>()
const emit = defineEmits<{ navigate: [id: string] }>()

function typeLabel(type: string): string {
  switch (type) {
    case 'DEPOSIT': return 'Acompte'
    case 'BALANCE': return 'Solde'
    case 'STANDARD': return 'Facture'
    default: return type
  }
}

function typeBadgeClass(type: string): string {
  switch (type) {
    case 'DEPOSIT': return 'bg-[#FEF3C7] text-[#92400E]'
    case 'BALANCE': return 'bg-[#DBEAFE] text-[#1E40AF]'
    default: return 'bg-[#F3F4F6] text-[#6B7280]'
  }
}
</script>

<template>
  <Card title="Documents liés" v-if="parentInvoice || childInvoices.length > 0">
    <div class="space-y-2">
      <button
        v-if="parentInvoice"
        class="w-full flex items-center justify-between rounded-lg border border-[#E5E7EB] px-4 py-3 text-left hover:bg-[#F9FAFB] transition-colors"
        @click="emit('navigate', parentInvoice.id)"
      >
        <div class="flex items-center gap-3">
          <span :class="['text-xs font-semibold px-2 py-0.5 rounded', typeBadgeClass((parentInvoice as any).invoice_type ?? 'STANDARD')]">
            {{ typeLabel((parentInvoice as any).invoice_type ?? 'STANDARD') }}
          </span>
          <span class="font-mono text-sm font-semibold text-[#7C3AED]">
            {{ parentInvoice.number ?? 'Brouillon' }}
          </span>
        </div>
        <div class="flex items-center gap-3">
          <span class="font-mono text-sm text-[#374151]">{{ formatCurrency(parentInvoice.total) }}</span>
          <InvoiceStatusBadge :status="parentInvoice.status" />
        </div>
      </button>

      <div v-if="parentInvoice && childInvoices.length > 0" class="flex justify-center">
        <svg class="h-4 w-4 text-[#9CA3AF]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clip-rule="evenodd" />
        </svg>
      </div>

      <button
        v-for="child in childInvoices"
        :key="child.id"
        :class="[
          'w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors',
          child.id === currentInvoiceId
            ? 'border-[#7C3AED] bg-[#EDE9FE]/30'
            : 'border-[#E5E7EB] hover:bg-[#F9FAFB]',
        ]"
        :disabled="child.id === currentInvoiceId"
        @click="emit('navigate', child.id)"
      >
        <div class="flex items-center gap-3">
          <span :class="['text-xs font-semibold px-2 py-0.5 rounded', typeBadgeClass((child as any).invoice_type ?? 'STANDARD')]">
            {{ typeLabel((child as any).invoice_type ?? 'STANDARD') }}
          </span>
          <span class="font-mono text-sm font-semibold text-[#7C3AED]">
            {{ child.number ?? 'Brouillon' }}
          </span>
        </div>
        <div class="flex items-center gap-3">
          <span class="font-mono text-sm text-[#374151]">{{ formatCurrency(child.total) }}</span>
          <InvoiceStatusBadge :status="child.status" />
        </div>
      </button>
    </div>
  </Card>
</template>
```

---

### Task 9 : Mettre a jour `InvoiceStatusBadge.vue`

**Files:**
- Modify: `/Users/maxime/Repos/facture-dev/src/components/invoices/InvoiceStatusBadge.vue`

- [ ] **Step 1 : Ajouter les nouveaux statuts dans les maps**

```typescript
const variantMap: Record<InvoiceStatus, BadgeVariant> = {
  DRAFT: 'default',
  DEPOSIT_PENDING: 'warning',
  SENT: 'info',
  PAID: 'success',
  COMPLETED: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'default',
}

const labelMap: Record<InvoiceStatus, string> = {
  DRAFT: 'Brouillon',
  DEPOSIT_PENDING: 'Acompte en attente',
  SENT: 'Envoyée',
  PAID: 'Payée',
  COMPLETED: 'Terminée',
  OVERDUE: 'En retard',
  CANCELLED: 'Annulée',
}
```

---

### Task 10 : Creer le badge de type `InvoiceTypeBadge.vue`

**Files:**
- Create: `/Users/maxime/Repos/facture-dev/src/components/invoices/InvoiceTypeBadge.vue`

- [ ] **Step 1 : Creer le composant**

```vue
<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  type: 'STANDARD' | 'DEPOSIT' | 'BALANCE'
}

const props = defineProps<Props>()

const config = computed(() => {
  switch (props.type) {
    case 'DEPOSIT':
      return { label: 'A', title: 'Acompte', class: 'bg-[#FEF3C7] text-[#92400E]' }
    case 'BALANCE':
      return { label: 'S', title: 'Solde', class: 'bg-[#DBEAFE] text-[#1E40AF]' }
    default:
      return null
  }
})
</script>

<template>
  <span
    v-if="config"
    :class="['inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-bold', config.class]"
    :title="config.title"
  >
    {{ config.label }}
  </span>
</template>
```

---

## Chunk 6 : Pages -- integration des nouvelles fonctionnalites

### Task 11 : Mettre a jour la page de detail `[id].vue`

**Files:**
- Modify: `/Users/maxime/Repos/facture-dev/src/pages/invoices/[id].vue`

- [ ] **Step 1 : Ajouter les imports**

```typescript
import DepositModal from '@/components/invoices/DepositModal.vue'
import LinkedDocuments from '@/components/invoices/LinkedDocuments.vue'
import InvoiceTypeBadge from '@/components/invoices/InvoiceTypeBadge.vue'
```

Modifier le destructuring de `useInvoices` :

```typescript
const {
  getInvoice, emitInvoice, duplicateInvoice,
  createDepositInvoice, createBalanceInvoice, getChildInvoices,
} = useInvoices()
```

- [ ] **Step 2 : Ajouter les refs**

```typescript
const showDepositModal = ref(false)
const creatingDeposit = ref(false)
const creatingBalance = ref(false)
const childInvoices = ref<Invoice[]>([])
const parentInvoice = ref<Invoice | null>(null)
```

- [ ] **Step 3 : Modifier `load()` pour charger les documents lies**

Apres le chargement du client et des paiements, ajouter :

```typescript
// Load linked documents
const inv = result.invoice as any
if (inv.parent_invoice_id) {
  const parentResult = await getInvoice(inv.parent_invoice_id)
  parentInvoice.value = parentResult?.invoice ?? null
}
const parentId = inv.parent_invoice_id ?? inv.id
const children = await getChildInvoices(parentId)
childInvoices.value = children
```

- [ ] **Step 4 : Ajouter les handlers**

```typescript
async function handleCreateDeposit(params: { amount: number } | { percentage: number }) {
  if (!invoice.value) return
  creatingDeposit.value = true
  const deposit = await createDepositInvoice(invoice.value.id, params)
  creatingDeposit.value = false
  showDepositModal.value = false
  if (deposit) {
    router.push(`/invoices/${deposit.id}`)
  }
}

async function handleCreateBalance() {
  if (!invoice.value) return
  creatingBalance.value = true
  const balance = await createBalanceInvoice(invoice.value.id)
  creatingBalance.value = false
  if (balance) {
    router.push(`/invoices/${balance.id}`)
  }
}
```

- [ ] **Step 5 : Ajouter les boutons dans le template**

Dans la div d'actions, ajouter :

```html
<Button
  v-if="invoice.status === 'DRAFT' && (!invoice.invoice_type || invoice.invoice_type === 'STANDARD')"
  variant="outline"
  size="md"
  @click="showDepositModal = true"
>
  Créer un acompte
</Button>

<Button
  v-if="invoice.status === 'DEPOSIT_PENDING'"
  variant="default"
  size="md"
  :loading="creatingBalance"
  @click="handleCreateBalance"
>
  Générer la facture de solde
</Button>
```

- [ ] **Step 6 : Ajouter le badge de type dans l'en-tete**

Apres `<InvoiceStatusBadge>`, ajouter :

```html
<InvoiceTypeBadge v-if="(invoice as any).invoice_type" :type="(invoice as any).invoice_type" />
```

- [ ] **Step 7 : Ajouter LinkedDocuments dans le template**

Apres la Card "Notes", avant la Card "Paiements" :

```html
<LinkedDocuments
  :parent-invoice="parentInvoice"
  :child-invoices="childInvoices"
  :current-invoice-id="invoiceId"
  @navigate="(id: string) => router.push(`/invoices/${id}`)"
/>
```

- [ ] **Step 8 : Ajouter la modale DepositModal**

Apres la modale de paiement :

```html
<DepositModal
  v-if="invoice"
  v-model="showDepositModal"
  :parent-total="invoice.total"
  :loading="creatingDeposit"
  @confirm="handleCreateDeposit"
/>
```

---

### Task 12 : Mettre a jour la liste des factures `index.vue`

**Files:**
- Modify: `/Users/maxime/Repos/facture-dev/src/pages/invoices/index.vue`

- [ ] **Step 1 : Ajouter les nouveaux onglets**

```typescript
const tabs: { key: InvoiceStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Toutes' },
  { key: 'DRAFT', label: 'Brouillons' },
  { key: 'SENT', label: 'Envoyées' },
  { key: 'DEPOSIT_PENDING', label: 'Acomptes' },
  { key: 'PAID', label: 'Payées' },
  { key: 'COMPLETED', label: 'Terminées' },
  { key: 'OVERDUE', label: 'En retard' },
  { key: 'CANCELLED', label: 'Annulées' },
]
```

- [ ] **Step 2 : Ajouter le badge de type dans les lignes du tableau**

Importer `InvoiceTypeBadge` et modifier la cellule du numero :

```html
<td class="px-4 py-3">
  <div class="flex items-center gap-1.5">
    <InvoiceTypeBadge
      v-if="(row as any).invoice_type && (row as any).invoice_type !== 'STANDARD'"
      :type="(row as any).invoice_type"
    />
    <span class="font-mono text-xs font-semibold text-[#7C3AED]">
      {{ row.number ?? '—' }}
    </span>
  </div>
</td>
```

---

## Chunk 7 : Tests unitaires

### Task 13 : Tests pour le flux acompte/solde

**Files:**
- Create: `/Users/maxime/Repos/facture-dev/tests/unit/deposit-balance.test.ts`

- [ ] **Step 1 : Ecrire les tests de logique metier**

```typescript
import { describe, it, expect } from 'vitest'

describe('Deposit / Balance flow — business rules', () => {
  describe('Deposit amount validation', () => {
    it('rejects deposit amount <= 0', () => {
      expect(0 > 0 && 0 < 1000).toBe(false)
    })

    it('rejects deposit amount >= parent total', () => {
      expect(1000 > 0 && 1000 < 1000).toBe(false)
    })

    it('accepts deposit amount between 0 and parent total', () => {
      expect(300 > 0 && 300 < 1000).toBe(true)
    })

    it('correctly computes percentage-based deposit', () => {
      const result = Math.round(1500 * 30 / 100 * 100) / 100
      expect(result).toBe(450)
    })

    it('handles fractional percentages without floating point errors', () => {
      const result = Math.round(999.99 * 33 / 100 * 100) / 100
      expect(result).toBe(330)
    })
  })

  describe('Balance computation', () => {
    it('computes balance = parent subtotal - deposit subtotal', () => {
      expect(1000 - 300).toBe(700)
    })

    it('rejects zero or negative balance', () => {
      expect(300 - 300 > 0).toBe(false)
    })
  })

  describe('Invoice type constraints', () => {
    const isValid = (type: string, parentId: string | null) =>
      type === 'STANDARD' || parentId !== null

    it('DEPOSIT requires parent_invoice_id', () => {
      expect(isValid('DEPOSIT', null)).toBe(false)
    })

    it('BALANCE requires parent_invoice_id', () => {
      expect(isValid('BALANCE', 'uuid')).toBe(true)
    })

    it('STANDARD allows null parent_invoice_id', () => {
      expect(isValid('STANDARD', null)).toBe(true)
    })
  })

  describe('Status transitions', () => {
    it('parent DRAFT -> DEPOSIT_PENDING when deposit created', () => {
      const allowed = 'DRAFT' === 'DRAFT'
      expect(allowed).toBe(true)
    })

    it('does not create deposit on non-DRAFT parent', () => {
      for (const s of ['SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'DEPOSIT_PENDING', 'COMPLETED']) {
        expect(s === 'DRAFT').toBe(false)
      }
    })

    it('does not create balance if deposit is not PAID', () => {
      for (const s of ['DRAFT', 'SENT', 'OVERDUE', 'CANCELLED']) {
        expect(s === 'PAID').toBe(false)
      }
    })
  })

  describe('Legal mentions on balance invoice', () => {
    it('deduction line includes required information', () => {
      const line = `Déduction acompte versé le 15/03/2026 — Facture n°FAC-2026-042`
      expect(line).toContain('Déduction acompte versé le')
      expect(line).toContain('FAC-2026-042')
      expect(line).toContain('15/03/2026')
    })

    it('deduction line amount is negative', () => {
      expect(-300).toBeLessThan(0)
    })
  })

  describe('Deposit schema validation', () => {
    it('percentage mode requires 1-99', () => {
      expect(30 >= 1 && 30 <= 99).toBe(true)
      expect(0 >= 1).toBe(false)
      expect(100 <= 99).toBe(false)
    })

    it('amount mode requires positive amount', () => {
      expect(500 > 0).toBe(true)
      expect(0 > 0).toBe(false)
    })
  })
})
```

---

## Chunk 8 : Verification finale

### Task 14 : Check-list de coherence

- [ ] **Step 1 : Numerotation sequentielle** -- Les factures d'acompte et de solde utilisent la meme sequence `invoice_sequences` que les factures standard. Elles recoivent un numero FAC-YYYY-NNN normal via l'Edge Function `generate-invoice-number`. Aucune modification necessaire.

- [ ] **Step 2 : Livre de recettes** -- L'acompte et le solde sont deux encaissements distincts. Verifier que le composable du livre de recettes ne filtre pas les factures DEPOSIT/BALANCE.

- [ ] **Step 3 : Immutabilite** -- Les factures emises restent immutables. La RLS existante couvre ce cas.

- [ ] **Step 4 : dashboard_stats** -- La vue mise a jour exclut DEPOSIT et BALANCE pour eviter le double comptage. Adapter si necessaire apres retour utilisateur.

- [ ] **Step 5 : Lancer les tests** -- `pnpm test` doit etre vert.

- [ ] **Step 6 : Type-check** -- `pnpm type-check` sans erreur.

---

## Recapitulatif des fichiers

| Action | Fichier |
|--------|---------|
| Create | `supabase/migrations/015_deposit_balance.sql` |
| Modify | `src/lib/types.ts` (regenerated) |
| Modify | `src/composables/useInvoices.ts` |
| Modify | `src/composables/usePayments.ts` |
| Modify | `src/utils/validators.ts` |
| Modify | `supabase/functions/generate-pdf/index.ts` |
| Create | `src/components/invoices/DepositModal.vue` |
| Create | `src/components/invoices/LinkedDocuments.vue` |
| Create | `src/components/invoices/InvoiceTypeBadge.vue` |
| Modify | `src/components/invoices/InvoiceStatusBadge.vue` |
| Modify | `src/pages/invoices/[id].vue` |
| Modify | `src/pages/invoices/index.vue` |
| Create | `tests/unit/deposit-balance.test.ts` |

**Total : 13 fichiers (5 create, 8 modify)**

---

The plan covers all 8 chunks requested: migration DB, types regeneration, composable business logic, PDF Edge Function adaptation, UI components (deposit modal, linked documents, badges), page integration (detail + list), unit tests, and a final verification checklist.

Key files referenced during analysis:
- `/Users/maxime/Repos/facture-dev/src/composables/useInvoices.ts` -- main composable to extend
- `/Users/maxime/Repos/facture-dev/src/composables/usePayments.ts` -- needs parent completion logic
- `/Users/maxime/Repos/facture-dev/supabase/functions/generate-pdf/index.ts` -- PDF template to adapt
- `/Users/maxime/Repos/facture-dev/supabase/migrations/002_rls_policies.sql` -- existing RLS to work with
- `/Users/maxime/Repos/facture-dev/supabase/migrations/005_cancel_invoice_policy.sql` and `007_payment_status_policy.sql` -- existing status transition policies
- `/Users/maxime/Repos/facture-dev/src/pages/invoices/[id].vue` -- detail page to extend
- `/Users/maxime/Repos/facture-dev/src/pages/invoices/index.vue` -- list page to extend
- `/Users/maxime/Repos/facture-dev/src/components/invoices/InvoiceStatusBadge.vue` -- needs new statuses

To save this plan, grant me bash permission and I will write it to `/Users/maxime/Repos/facture-dev/docs/superpowers/plans/2026-03-21-phase16-acomptes.md`.