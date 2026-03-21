# Phase 13 -- Relances automatiques de factures impayees

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **INTERDICTION DE COMMIT** -- Ne jamais executer `git commit`. Seul l'utilisateur a le droit de committer. Preparer le code, mais s'arreter avant le commit.

**Goal:** Automatiser l'envoi de relances email pour les factures impayees selon une sequence J+7 / J+15 / J+30 apres la date d'echeance, avec templates progressifs (poli, ferme, mention penalites legales), historique consultable sur la page de detail d'une facture, et possibilite de desactiver les relances par facture.

**Architecture:** Nouvelle table `invoice_reminders` pour le tracking des relances envoyees (anti-doublon). Nouveau champ `reminders_disabled` sur `invoices`. Edge Function `process-reminders` executable manuellement ou via pg_cron quotidien, reutilisant Resend API (meme pattern que `send-invoice-email`). Nouveau composable `useReminders.ts`. Section UI integree a la page de detail facture `src/pages/invoices/[id].vue`.

**Tech Stack:** Vue 3 + TypeScript, Supabase (PostgreSQL, RLS, Edge Functions Deno), Resend API, Vitest.

**Contexte :**
- Plus d'une facture sur deux arrive hors delai en France (source Sogexia) -- c'est le pain point #1 des micro-entrepreneurs
- Tous les concurrents majeurs (Abby, Freebe, Pennylane, Tiime) proposent des relances automatiques
- La mecanique email via Resend est deja en place dans `send-invoice-email`
- La relance J+30 doit mentionner les penalites de retard legales (taux BCE + 10 points, art. L. 441-6 C.com.) et l'indemnite forfaitaire de 40 EUR pour frais de recouvrement (art. L. 441-10 C.com.)
- La sequence ne doit jamais envoyer deux fois la meme etape pour une meme facture

---

## Chunk 1 : Migration DB

### Task 1 : Table `invoice_reminders` et champ `reminders_disabled`

**Files:**
- Create: `supabase/migrations/015_invoice_reminders.sql`
- Modify: `src/lib/types.ts` (apres regeneration)

- [ ] **Step 1 : Ecrire la migration**

```sql
-- Migration 015: invoice reminders tracking + opt-out per invoice

-- Enum for reminder steps
CREATE TYPE public.reminder_step AS ENUM ('J7', 'J15', 'J30');

-- Reminders tracking table
CREATE TABLE public.invoice_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step reminder_step NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resend_id TEXT,                     -- Resend email ID for troubleshooting
  recipient_email TEXT NOT NULL,

  -- Anti-doublon : une seule relance par etape par facture
  CONSTRAINT uq_invoice_reminder_step UNIQUE (invoice_id, step)
);

-- Indexes
CREATE INDEX idx_invoice_reminders_invoice ON public.invoice_reminders(invoice_id);
CREATE INDEX idx_invoice_reminders_user ON public.invoice_reminders(user_id);

-- RLS
ALTER TABLE public.invoice_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own reminders"
  ON public.invoice_reminders
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT only from service role (Edge Function) -- no direct user inserts
-- The Edge Function uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS

-- Add reminders_disabled flag to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS reminders_disabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.invoices.reminders_disabled IS
  'When true, automatic reminders are suppressed for this invoice';

COMMENT ON TABLE public.invoice_reminders IS
  'Tracks sent payment reminders. UNIQUE(invoice_id, step) prevents duplicate sends.';
```

Points de design importants :
- La contrainte `UNIQUE (invoice_id, step)` est le verrou anti-doublon. Si l'Edge Function tente un INSERT pour un couple (invoice_id, step) deja existant, PostgreSQL rejettera l'operation.
- La table `invoice_reminders` n'a pas de politique INSERT pour `authenticated` car seule l'Edge Function (service role) insere. Les utilisateurs ne peuvent que lire (SELECT).
- `reminders_disabled` est `false` par defaut : les relances sont actives pour toute nouvelle facture.

- [ ] **Step 2 : Appliquer la migration**

```bash
npx supabase db push
```

- [ ] **Step 3 : Regenerer les types TypeScript**

```bash
npx supabase gen types typescript --local > src/lib/types.ts
```

Verifier que :
- `invoice_reminders` apparait dans `Database['public']['Tables']`
- `reminder_step` apparait dans `Database['public']['Enums']`
- `reminders_disabled: boolean` apparait dans `invoices.Row`

---

## Chunk 2 : Templates email de relance

### Task 2 : Creer le module de templates email

**Files:**
- Create: `supabase/functions/_shared/reminder-templates.ts`
- Create: `src/utils/reminder-templates.ts` (copie client pour les tests)
- Create: `tests/unit/utils/reminder-templates.test.ts`

- [ ] **Step 1 : Ecrire les tests unitaires**

Creer `tests/unit/utils/reminder-templates.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { buildReminderEmail } from '@/utils/reminder-templates'

const baseInput = {
  invoiceNumber: 'FAC-2026-042',
  clientName: 'Acme Corp',
  totalTTC: 1500.00,
  dueDate: '2026-02-15',
  senderName: 'Jean Dupont',
  senderCompany: 'Jean Dupont EI',
}

describe('buildReminderEmail', () => {
  describe('J7 -- rappel poli', () => {
    it('generates subject with invoice number', () => {
      const email = buildReminderEmail('J7', baseInput)
      expect(email.subject).toContain('FAC-2026-042')
      expect(email.subject).toContain('Rappel')
    })

    it('uses polite tone', () => {
      const email = buildReminderEmail('J7', baseInput)
      expect(email.html).toContain('Nous n')  // "Nous n'avons pas encore recu..."
      expect(email.html).not.toContain('penalites')
      expect(email.html).not.toContain('40')
    })

    it('includes invoice amount and due date', () => {
      const email = buildReminderEmail('J7', baseInput)
      expect(email.html).toContain('1')  // part of formatted amount
      expect(email.html).toContain('500')
      expect(email.html).toContain('15/02/2026')
    })
  })

  describe('J15 -- relance ferme', () => {
    it('references previous message', () => {
      const email = buildReminderEmail('J15', baseInput)
      expect(email.subject).toContain('Relance')
      expect(email.html).toContain('precedent')
    })

    it('does not yet mention 40 EUR indemnity', () => {
      const email = buildReminderEmail('J15', baseInput)
      expect(email.html).not.toContain('40')
    })
  })

  describe('J30 -- mention penalites legales', () => {
    it('mentions late payment penalties', () => {
      const email = buildReminderEmail('J30', baseInput)
      expect(email.html).toContain('penalites de retard')
    })

    it('mentions 40 EUR recovery indemnity (art. L. 441-10)', () => {
      const email = buildReminderEmail('J30', baseInput)
      expect(email.html).toContain('40')
      expect(email.html).toContain('frais de recouvrement')
    })

    it('mentions BCE rate + 10 points', () => {
      const email = buildReminderEmail('J30', baseInput)
      expect(email.html).toContain('BCE')
      expect(email.html).toContain('10 points')
    })

    it('has urgent subject line', () => {
      const email = buildReminderEmail('J30', baseInput)
      expect(email.subject).toContain('Dernier')
    })
  })

  describe('common checks', () => {
    it('includes sender name in all templates', () => {
      for (const step of ['J7', 'J15', 'J30'] as const) {
        const email = buildReminderEmail(step, baseInput)
        expect(email.html).toContain('Jean Dupont')
      }
    })

    it('includes client name in greeting', () => {
      for (const step of ['J7', 'J15', 'J30'] as const) {
        const email = buildReminderEmail(step, baseInput)
        expect(email.html).toContain('Acme Corp')
      }
    })
  })
})
```

```bash
pnpm test tests/unit/utils/reminder-templates.test.ts
```

Resultat attendu : erreur `Cannot find module '@/utils/reminder-templates'`.

- [ ] **Step 2 : Creer `src/utils/reminder-templates.ts`**

```typescript
/**
 * Email templates for automated invoice payment reminders.
 *
 * Three escalation levels:
 * - J7:  Polite reminder, 7 days after due date
 * - J15: Firm follow-up, 15 days after due date
 * - J30: Final notice with legal penalty mentions (art. L. 441-6 & L. 441-10 C.com.)
 */

export type ReminderStep = 'J7' | 'J15' | 'J30'

export interface ReminderEmailInput {
  invoiceNumber: string
  clientName: string
  totalTTC: number
  dueDate: string          // ISO 8601: YYYY-MM-DD
  senderName: string
  senderCompany: string
}

export interface ReminderEmail {
  subject: string
  html: string
}

function formatCurrencyFR(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

function formatDateFR(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

const STYLES = `
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #374151; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px; }
    .header { border-bottom: 2px solid #E5E7EB; padding-bottom: 16px; margin-bottom: 20px; }
    .amount { font-size: 18px; font-weight: 700; color: #7C3AED; font-family: 'JetBrains Mono', monospace; }
    .details { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .details dt { color: #6B7280; font-size: 13px; }
    .details dd { color: #111827; font-weight: 600; margin: 0 0 8px 0; }
    .legal { font-size: 12px; color: #6B7280; border-top: 1px solid #E5E7EB; padding-top: 16px; margin-top: 24px; }
    .warning { background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #92400E; }
    .danger { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #991B1B; }
  </style>
`

function detailsBlock(input: ReminderEmailInput): string {
  return `
    <div class="details">
      <dl>
        <dt>Facture</dt>
        <dd>${input.invoiceNumber}</dd>
        <dt>Montant TTC</dt>
        <dd class="amount">${formatCurrencyFR(input.totalTTC)}</dd>
        <dt>Date d'echeance</dt>
        <dd>${formatDateFR(input.dueDate)}</dd>
      </dl>
    </div>
  `
}

function buildJ7(input: ReminderEmailInput): ReminderEmail {
  return {
    subject: `Rappel : facture ${input.invoiceNumber} en attente de reglement`,
    html: `<!DOCTYPE html><html><head>${STYLES}</head><body>
      <div class="container">
        <div class="header">
          <strong>${input.senderCompany}</strong>
        </div>
        <p>Bonjour ${input.clientName},</p>
        <p>Nous n'avons pas encore recu votre reglement pour la facture ci-dessous, dont la date d'echeance est depassee :</p>
        ${detailsBlock(input)}
        <p>Il est possible que ce paiement soit deja en cours de traitement. Si c'est le cas, nous vous prions de ne pas tenir compte de ce message.</p>
        <p>Dans le cas contraire, nous vous serions reconnaissants de bien vouloir proceder au reglement dans les meilleurs delais.</p>
        <p>Cordialement,<br><strong>${input.senderName}</strong></p>
        <div class="legal">
          <p>Ce message est envoye automatiquement par facture.dev pour le compte de ${input.senderCompany}.</p>
        </div>
      </div>
    </body></html>`,
  }
}

function buildJ15(input: ReminderEmailInput): ReminderEmail {
  return {
    subject: `Relance : facture ${input.invoiceNumber} -- reglement attendu`,
    html: `<!DOCTYPE html><html><head>${STYLES}</head><body>
      <div class="container">
        <div class="header">
          <strong>${input.senderCompany}</strong>
        </div>
        <p>Bonjour ${input.clientName},</p>
        <p>Suite a notre precedent message reste sans reponse, nous nous permettons de revenir vers vous concernant la facture suivante :</p>
        ${detailsBlock(input)}
        <div class="warning">
          <strong>Important :</strong> Cette facture est en retard de paiement de plus de 15 jours.
          Nous vous remercions de proceder au reglement dans les plus brefs delais.
        </div>
        <p>Si vous rencontrez une difficulte, n'hesitez pas a nous contacter afin que nous trouvions une solution ensemble.</p>
        <p>Cordialement,<br><strong>${input.senderName}</strong></p>
        <div class="legal">
          <p>Ce message est envoye automatiquement par facture.dev pour le compte de ${input.senderCompany}.</p>
        </div>
      </div>
    </body></html>`,
  }
}

function buildJ30(input: ReminderEmailInput): ReminderEmail {
  return {
    subject: `Dernier rappel : facture ${input.invoiceNumber} -- penalites de retard applicables`,
    html: `<!DOCTYPE html><html><head>${STYLES}</head><body>
      <div class="container">
        <div class="header">
          <strong>${input.senderCompany}</strong>
        </div>
        <p>Bonjour ${input.clientName},</p>
        <p>Malgre nos relances precedentes, nous constatons que la facture ci-dessous demeure impayee :</p>
        ${detailsBlock(input)}
        <div class="danger">
          <strong>Penalites de retard applicables</strong><br>
          Conformement aux dispositions legales en vigueur :<br>
          <ul style="margin: 8px 0; padding-left: 20px;">
            <li>Des <strong>penalites de retard</strong> sont exigibles, calculees au taux de la BCE majore de 10 points de pourcentage (art. L. 441-6 du Code de commerce).</li>
            <li>Une <strong>indemnite forfaitaire de 40 &euro; pour frais de recouvrement</strong> est due de plein droit (art. L. 441-10 du Code de commerce).</li>
          </ul>
          Ces penalites sont applicables des le premier jour de retard, sans qu'un rappel soit necessaire.
        </div>
        <p>Nous vous demandons de proceder au reglement integral de cette facture sans delai supplementaire. A defaut, nous nous reservons le droit d'engager les procedures de recouvrement necessaires.</p>
        <p>Cordialement,<br><strong>${input.senderName}</strong></p>
        <div class="legal">
          <p>Ce message est envoye automatiquement par facture.dev pour le compte de ${input.senderCompany}.</p>
        </div>
      </div>
    </body></html>`,
  }
}

export function buildReminderEmail(step: ReminderStep, input: ReminderEmailInput): ReminderEmail {
  switch (step) {
    case 'J7':
      return buildJ7(input)
    case 'J15':
      return buildJ15(input)
    case 'J30':
      return buildJ30(input)
  }
}
```

- [ ] **Step 3 : Relancer les tests**

```bash
pnpm test tests/unit/utils/reminder-templates.test.ts
```

Resultat attendu : tous les tests passent (12 tests).

- [ ] **Step 4 : Copier le module pour l'Edge Function**

Le module est du TypeScript pur sans imports externes. On le copie dans `_shared` pour l'Edge Function.

```bash
cp src/utils/reminder-templates.ts supabase/functions/_shared/reminder-templates.ts
```

---

## Chunk 3 : Edge Function `process-reminders`

### Task 3 : Creer l'Edge Function

**Contexte :** L'Edge Function parcourt toutes les factures SENT ou OVERDUE dont `due_date` est depassee et `reminders_disabled = false`. Pour chaque facture, elle determine l'etape applicable (J+7, J+15, J+30), verifie qu'elle n'a pas deja ete envoyee (via `invoice_reminders`), genere l'email, l'envoie via Resend, et insere l'enregistrement dans `invoice_reminders`.

L'Edge Function est appelable sans authentification utilisateur (cron) OU avec authentification (declenchement manuel). En mode cron, elle utilise le service role key directement. En mode manuel, elle filtre sur le `user_id` de l'appelant.

**Files:**
- Create: `supabase/functions/process-reminders/index.ts`

- [ ] **Step 1 : Creer l'Edge Function**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildReminderEmail } from "../_shared/reminder-templates.ts";
import type { ReminderStep } from "../_shared/reminder-templates.ts";

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

/**
 * Determines which reminder steps are due for a given invoice based on
 * how many days have passed since the due date.
 */
function getDueSteps(daysOverdue: number): ReminderStep[] {
  const steps: ReminderStep[] = [];
  if (daysOverdue >= 7) steps.push('J7');
  if (daysOverdue >= 15) steps.push('J15');
  if (daysOverdue >= 30) steps.push('J30');
  return steps;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resendKey = Deno.env.get('RESEND_API_KEY');

  if (!resendKey) {
    return json({ error: 'Email service not configured (missing RESEND_API_KEY)' }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Determine caller scope: authenticated user (manual) or cron (all users)
  let userId: string | null = null;
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    // If the token equals the service role key, it's a cron call -> process all users
    if (token !== serviceRoleKey) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return json({ error: 'Unauthorized' }, 401);
      }
      userId = user.id;
    }
  }

  // Parse optional body (for manual triggering of a specific invoice)
  const body = await req.json().catch(() => ({}));
  const { invoiceId } = body;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Fetch overdue invoices (SENT or OVERDUE, past due_date, reminders not disabled)
  let query = supabase
    .from('invoices')
    .select('id, user_id, number, total, due_date, client_id, reminders_disabled, clients(name, email)')
    .in('status', ['SENT', 'OVERDUE'])
    .eq('reminders_disabled', false)
    .lt('due_date', todayStr);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  if (invoiceId) {
    query = query.eq('id', invoiceId);
  }

  const { data: invoices, error: invErr } = await query;
  if (invErr) {
    return json({ error: invErr.message }, 500);
  }

  if (!invoices || invoices.length === 0) {
    return json({ remindersSent: 0, details: [] });
  }

  // Fetch already-sent reminders for these invoices
  const invoiceIds = invoices.map((i: any) => i.id);
  const { data: existingReminders } = await supabase
    .from('invoice_reminders')
    .select('invoice_id, step')
    .in('invoice_id', invoiceIds);

  // Build a set of "invoice_id:step" for quick lookup
  const sentSet = new Set(
    (existingReminders ?? []).map((r: any) => `${r.invoice_id}:${r.step}`)
  );

  let remindersSent = 0;
  const details: Array<{ invoiceId: string; invoiceNumber: string; step: string; recipient: string }> = [];

  // Cache profiles to avoid redundant fetches within the same run
  const profileCache = new Map<string, any>();

  for (const invoice of invoices) {
    const client = invoice.clients as any;
    if (!client?.email) continue;

    const dueDate = new Date(invoice.due_date);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000);
    const dueSteps = getDueSteps(daysOverdue);

    // Fetch sender profile (with cache)
    let profile = profileCache.get(invoice.user_id);
    if (!profile) {
      const { data: p } = await supabase
        .from('profiles')
        .select('first_name, last_name, company_name, email')
        .eq('id', invoice.user_id)
        .single();
      if (!p) continue;
      profileCache.set(invoice.user_id, p);
      profile = p;
    }

    const senderName = `${profile.first_name} ${profile.last_name}`;
    const senderCompany = profile.company_name ?? senderName;

    for (const step of dueSteps) {
      const key = `${invoice.id}:${step}`;
      if (sentSet.has(key)) continue;

      // Build email
      const email = buildReminderEmail(step, {
        invoiceNumber: invoice.number ?? invoice.id.slice(0, 8),
        clientName: client.name,
        totalTTC: Number(invoice.total),
        dueDate: invoice.due_date,
        senderName,
        senderCompany,
      });

      // Send via Resend
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: `${senderName} <noreply@facture.dev>`,
          to: [client.email],
          subject: email.subject,
          html: email.html,
        }),
      });

      if (!resendRes.ok) {
        console.error(`Failed to send ${step} reminder for invoice ${invoice.id}: ${await resendRes.text()}`);
        continue;
      }

      const resendData = await resendRes.json();

      // Record reminder (UNIQUE constraint prevents duplicates even in race conditions)
      const { error: insertErr } = await supabase
        .from('invoice_reminders')
        .insert({
          invoice_id: invoice.id,
          user_id: invoice.user_id,
          step,
          recipient_email: client.email,
          resend_id: resendData.id,
        });

      if (insertErr) {
        console.warn(`Insert reminder failed for ${invoice.id}:${step}: ${insertErr.message}`);
        continue;
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: invoice.user_id,
        action: 'SEND_REMINDER',
        entity: 'invoices',
        entity_id: invoice.id,
        details: {
          step,
          recipient: client.email,
          resend_id: resendData.id,
          days_overdue: daysOverdue,
        },
      });

      sentSet.add(key);
      remindersSent++;
      details.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.number ?? '',
        step,
        recipient: client.email,
      });
    }
  }

  return json({ remindersSent, details });
});
```

Points de design :
- **Anti-doublon double securite** : (1) verification en memoire via `sentSet` avant envoi, (2) contrainte UNIQUE en base si jamais deux runs concurrents se chevauchent.
- **Resilience** : un echec d'envoi pour une facture ne bloque pas le traitement des autres.
- **Scope** : en mode cron (service role key comme token), traite tous les utilisateurs. En mode manuel (user token), ne traite que les factures de l'appelant.
- **Profile cache** : evite de refetcher le meme profil pour chaque facture d'un meme utilisateur dans un run.

---

## Chunk 4 : Composable `useReminders.ts`

### Task 4 : Creer le composable

**Files:**
- Create: `src/composables/useReminders.ts`
- Create: `tests/unit/composables/useReminders.test.ts`

- [ ] **Step 1 : Ecrire les tests unitaires**

Creer `tests/unit/composables/useReminders.test.ts` :

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockFrom = vi.fn()
const mockFunctionsInvoke = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    functions: { invoke: (...args: any[]) => mockFunctionsInvoke(...args) },
  },
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-123' },
  }),
}))

vi.mock('@/stores/notifications', () => ({
  useNotificationsStore: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@/composables/useAuditLog', () => ({
  useAuditLog: () => ({ logAction: vi.fn() }),
}))

describe('useReminders', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchReminders calls supabase with invoice_id filter', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })

    const { useReminders } = await import('@/composables/useReminders')
    const { fetchReminders, reminders } = useReminders()
    await fetchReminders('inv-123')

    expect(mockFrom).toHaveBeenCalledWith('invoice_reminders')
    expect(reminders.value).toEqual([])
  })

  it('triggerReminders invokes Edge Function', async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: { remindersSent: 1, details: [] },
      error: null,
    })

    const { useReminders } = await import('@/composables/useReminders')
    const { triggerReminders } = useReminders()
    const result = await triggerReminders('inv-123')

    expect(mockFunctionsInvoke).toHaveBeenCalledWith('process-reminders', {
      body: { invoiceId: 'inv-123' },
    })
    expect(result).toBe(1)
  })

  it('toggleRemindersDisabled calls supabase update', async () => {
    const mockUpdate = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockSelect = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'inv-123', reminders_disabled: true },
      error: null,
    })
    mockFrom.mockReturnValue({
      update: mockUpdate,
      eq: mockEq,
      select: mockSelect,
      single: mockSingle,
    })

    const { useReminders } = await import('@/composables/useReminders')
    const { toggleRemindersDisabled } = useReminders()
    const result = await toggleRemindersDisabled('inv-123', true)

    expect(mockFrom).toHaveBeenCalledWith('invoices')
    expect(result).toBe(true)
  })
})
```

```bash
pnpm test tests/unit/composables/useReminders.test.ts
```

Resultat attendu : erreur `Cannot find module '@/composables/useReminders'`.

- [ ] **Step 2 : Creer `src/composables/useReminders.ts`**

```typescript
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import type { Database } from '@/lib/types'

type InvoiceReminder = Database['public']['Tables']['invoice_reminders']['Row']

export function useReminders() {
  const authStore = useAuthStore()
  const notifications = useNotificationsStore()

  const reminders = ref<InvoiceReminder[]>([])
  const loading = ref(false)

  /**
   * Fetch all reminders sent for a specific invoice.
   */
  async function fetchReminders(invoiceId: string) {
    loading.value = true
    const { data, error } = await supabase
      .from('invoice_reminders')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sent_at', { ascending: true })

    if (error) {
      notifications.error('Erreur', 'Impossible de charger les relances')
    } else {
      reminders.value = data ?? []
    }
    loading.value = false
  }

  /**
   * Manually trigger the reminders Edge Function for a specific invoice.
   * Returns the number of reminders sent.
   */
  async function triggerReminders(invoiceId: string): Promise<number> {
    const { data, error } = await supabase.functions.invoke('process-reminders', {
      body: { invoiceId },
    })

    if (error || !data) {
      notifications.error('Erreur', 'Impossible de declencher les relances')
      return 0
    }

    const count = data.remindersSent ?? 0
    if (count > 0) {
      notifications.success('Relance(s) envoyee(s)', `${count} email(s) de relance envoye(s)`)
      await fetchReminders(invoiceId)
    } else {
      notifications.success('Aucune relance due', 'Toutes les relances applicables ont deja ete envoyees')
    }

    return count
  }

  /**
   * Toggle reminders_disabled flag on an invoice.
   */
  async function toggleRemindersDisabled(invoiceId: string, disabled: boolean): Promise<boolean> {
    const { data, error } = await supabase
      .from('invoices')
      .update({ reminders_disabled: disabled })
      .eq('id', invoiceId)
      .select()
      .single()

    if (error || !data) {
      notifications.error('Erreur', 'Impossible de modifier le parametre de relances')
      return false
    }

    if (disabled) {
      notifications.success('Relances desactivees', 'Aucune relance automatique ne sera envoyee pour cette facture')
    } else {
      notifications.success('Relances activees', 'Les relances automatiques sont reactivees')
    }

    return true
  }

  return {
    reminders,
    loading,
    fetchReminders,
    triggerReminders,
    toggleRemindersDisabled,
  }
}
```

- [ ] **Step 3 : Relancer les tests**

```bash
pnpm test tests/unit/composables/useReminders.test.ts
```

Resultat attendu : 3/3 tests passent.

---

## Chunk 5 : UI -- Section relances sur la page de detail facture

### Task 5 : Ajouter la section "Relances" dans `src/pages/invoices/[id].vue`

**Contexte :** La section s'affiche uniquement pour les factures SENT ou OVERDUE. Elle contient :
1. Un toggle "Desactiver les relances" (modifie `reminders_disabled`)
2. L'historique des relances envoyees (tableau chronologique)
3. Un bouton "Envoyer une relance maintenant" (declenchement manuel)

**Files:**
- Modify: `src/pages/invoices/[id].vue`

- [ ] **Step 1 : Ajouter les imports et la logique dans le `<script setup>`**

Apres les imports existants (ligne 11 environ), ajouter :

```typescript
import { useReminders } from '@/composables/useReminders'
```

Apres les declarations de ref existantes (apres la ligne `const downloadingPdf = ref(false)`), ajouter :

```typescript
const {
  reminders,
  loading: remindersLoading,
  fetchReminders,
  triggerReminders,
  toggleRemindersDisabled,
} = useReminders()

const sendingReminder = ref(false)
const togglingReminders = ref(false)
```

Dans la fonction `load()`, remplacer le bloc existant :

```typescript
  if (result.invoice.status === 'SENT' || result.invoice.status === 'PAID') {
    await fetchPayments(invoiceId.value)
  }
```

Par :

```typescript
  if (result.invoice.status === 'SENT' || result.invoice.status === 'PAID' || result.invoice.status === 'OVERDUE') {
    await fetchPayments(invoiceId.value)
  }
  if (result.invoice.status === 'SENT' || result.invoice.status === 'OVERDUE') {
    await fetchReminders(invoiceId.value)
  }
```

Ajouter les handlers (avant `onMounted(load)`) :

```typescript
async function handleTriggerReminder() {
  if (!invoice.value) return
  sendingReminder.value = true
  await triggerReminders(invoice.value.id)
  sendingReminder.value = false
}

async function handleToggleReminders() {
  if (!invoice.value) return
  togglingReminders.value = true
  const newValue = !invoice.value.reminders_disabled
  const success = await toggleRemindersDisabled(invoice.value.id, newValue)
  if (success) {
    invoice.value = { ...invoice.value, reminders_disabled: newValue }
  }
  togglingReminders.value = false
}

function reminderStepLabel(step: string): string {
  switch (step) {
    case 'J7': return 'Rappel poli (J+7)'
    case 'J15': return 'Relance ferme (J+15)'
    case 'J30': return 'Mise en demeure (J+30)'
    default: return step
  }
}

function reminderStepColor(step: string): string {
  switch (step) {
    case 'J7': return 'bg-[#DBEAFE] text-[#1D4ED8]'
    case 'J15': return 'bg-[#FEF3C7] text-[#D97706]'
    case 'J30': return 'bg-[#FEF2F2] text-[#DC2626]'
    default: return 'bg-[#F3F4F6] text-[#6B7280]'
  }
}
```

- [ ] **Step 2 : Ajouter la section template**

Dans le template, apres la Card "Paiements" (apres la fermeture `</Card>` du bloc paiements, avant la fermeture `</template v-else-if="invoice">`), ajouter :

```vue
      <!-- Reminders section (only for SENT/OVERDUE invoices) -->
      <Card
        v-if="invoice.status === 'SENT' || invoice.status === 'OVERDUE'"
        title="Relances de paiement"
      >
        <!-- Header with toggle and action button -->
        <div class="flex items-center justify-between gap-4 mb-4">
          <div class="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              :aria-checked="!invoice.reminders_disabled"
              :disabled="togglingReminders"
              :class="[
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:ring-offset-2',
                !invoice.reminders_disabled ? 'bg-[#7C3AED]' : 'bg-[#D1D5DB]',
                togglingReminders ? 'opacity-50 cursor-wait' : '',
              ]"
              @click="handleToggleReminders"
            >
              <span
                :class="[
                  'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  !invoice.reminders_disabled ? 'translate-x-4' : 'translate-x-0',
                ]"
              />
            </button>
            <span class="text-sm text-[#374151]">
              {{ invoice.reminders_disabled ? 'Relances desactivees' : 'Relances automatiques actives' }}
            </span>
          </div>

          <Button
            v-if="!invoice.reminders_disabled"
            variant="outline"
            size="sm"
            :loading="sendingReminder"
            @click="handleTriggerReminder"
          >
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            Envoyer une relance
          </Button>
        </div>

        <!-- Reminders history -->
        <template v-if="remindersLoading">
          <div class="h-16 bg-[#F3F4F6] rounded animate-pulse" />
        </template>

        <template v-else-if="reminders.length === 0">
          <div class="text-center py-6">
            <svg class="mx-auto h-8 w-8 text-[#D1D5DB]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p class="mt-2 text-sm text-[#9CA3AF]">Aucune relance envoyee pour le moment</p>
            <p class="text-xs text-[#D1D5DB] mt-1">
              Les relances sont envoyees automatiquement J+7, J+15 et J+30 apres l'echeance
            </p>
          </div>
        </template>

        <template v-else>
          <div class="space-y-3">
            <div
              v-for="reminder in reminders"
              :key="reminder.id"
              class="flex items-center justify-between gap-4 py-2 border-b border-[#F3F4F6] last:border-0"
            >
              <div class="flex items-center gap-3">
                <span
                  :class="[
                    'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
                    reminderStepColor(reminder.step),
                  ]"
                >
                  {{ reminderStepLabel(reminder.step) }}
                </span>
                <span class="text-sm text-[#6B7280]">
                  {{ reminder.recipient_email }}
                </span>
              </div>
              <span class="text-xs text-[#9CA3AF] tabular-nums">
                {{ formatDate(reminder.sent_at) }}
              </span>
            </div>
          </div>

          <!-- Sequence progress indicator -->
          <div class="mt-4 pt-3 border-t border-[#F3F4F6]">
            <div class="flex items-center gap-2">
              <span class="text-xs text-[#6B7280]">Progression :</span>
              <div class="flex items-center gap-1">
                <span
                  v-for="step in ['J7', 'J15', 'J30']"
                  :key="step"
                  :class="[
                    'inline-flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold',
                    reminders.some(r => r.step === step)
                      ? 'bg-[#7C3AED] text-white'
                      : 'bg-[#F3F4F6] text-[#9CA3AF]',
                  ]"
                  :title="reminderStepLabel(step)"
                >
                  {{ step.replace('J', '') }}
                </span>
              </div>
              <span class="text-xs text-[#9CA3AF]">
                {{ reminders.length }}/3 envoyee(s)
              </span>
            </div>
          </div>
        </template>
      </Card>
```

- [ ] **Step 3 : Verifier la compilation**

```bash
pnpm build
```

---

## Chunk 6 : Configuration du cron

### Task 6 : Documenter la configuration pg_cron

**Contexte :** L'Edge Function `process-reminders` doit etre executee une fois par jour (typiquement a 8h UTC, soit 9h/10h heure francaise). On utilise pg_cron via `net.http_post` pour appeler l'Edge Function avec le service role key.

**Files:**
- Modify: `README.md` (ou creer `docs/cron-setup.md`)

- [ ] **Step 1 : Documenter la commande SQL pg_cron**

Ajouter dans la documentation du projet :

```sql
-- A executer dans Supabase SQL Editor en tant que superuser
-- Necessite l'extension pg_cron et pg_net

-- Cron quotidien pour les relances automatiques (8h UTC)
SELECT cron.schedule(
  'process-reminders-daily',
  '0 8 * * *',
  $$
    SELECT net.http_post(
      url := '<SUPABASE_URL>/functions/v1/process-reminders',
      headers := jsonb_build_object(
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Verifier que le job est planifie
SELECT * FROM cron.job WHERE jobname = 'process-reminders-daily';

-- Pour desactiver temporairement
-- SELECT cron.unschedule('process-reminders-daily');
```

Note : Ce SQL doit etre execute manuellement dans le Supabase Dashboard (SQL Editor) car pg_cron ne peut pas etre configure via les migrations standard.

---

## Chunk 7 : Tests et verification finale

### Task 7 : Tests de regression complets

**Files:**
- Create: `tests/unit/utils/reminder-steps.test.ts`

- [ ] **Step 1 : Ajouter un test pour `getDueSteps` (logique de l'Edge Function)**

Creer `tests/unit/utils/reminder-steps.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'

// Replicate the logic from the Edge Function for unit testing
function getDueSteps(daysOverdue: number): string[] {
  const steps: string[] = []
  if (daysOverdue >= 7) steps.push('J7')
  if (daysOverdue >= 15) steps.push('J15')
  if (daysOverdue >= 30) steps.push('J30')
  return steps
}

describe('getDueSteps', () => {
  it('returns empty for < 7 days overdue', () => {
    expect(getDueSteps(0)).toEqual([])
    expect(getDueSteps(3)).toEqual([])
    expect(getDueSteps(6)).toEqual([])
  })

  it('returns J7 for 7-14 days overdue', () => {
    expect(getDueSteps(7)).toEqual(['J7'])
    expect(getDueSteps(10)).toEqual(['J7'])
    expect(getDueSteps(14)).toEqual(['J7'])
  })

  it('returns J7+J15 for 15-29 days overdue', () => {
    expect(getDueSteps(15)).toEqual(['J7', 'J15'])
    expect(getDueSteps(20)).toEqual(['J7', 'J15'])
    expect(getDueSteps(29)).toEqual(['J7', 'J15'])
  })

  it('returns all three steps for >= 30 days overdue', () => {
    expect(getDueSteps(30)).toEqual(['J7', 'J15', 'J30'])
    expect(getDueSteps(60)).toEqual(['J7', 'J15', 'J30'])
    expect(getDueSteps(365)).toEqual(['J7', 'J15', 'J30'])
  })
})
```

- [ ] **Step 2 : Lancer tous les tests unitaires**

```bash
pnpm test
```

Resultat attendu : tous les tests passent, y compris les nouveaux tests (reminder-templates, reminder-steps, useReminders).

- [ ] **Step 3 : Verifier le build**

```bash
pnpm build
```

Resultat attendu : build reussi sans erreurs TypeScript.

---

## Tache finale : Marquer la phase comme completee

Quand tous les criteres de succes sont verts et tous les tests passent :

- [ ] **Step 1 : Mettre a jour l'indicateur de completion dans ce fichier**

```bash
DATE=$(date +%Y-%m-%d)
COMMIT=$(git rev-parse --short HEAD)
sed -i '' "2s|^|\n> COMPLETEE -- ${DATE} . commit \`${COMMIT}\`\n|" docs/superpowers/plans/2026-03-21-phase13-relances.md
```

---

## Criteres de succes

- [ ] Migration `015_invoice_reminders.sql` appliquee : table `invoice_reminders` avec contrainte UNIQUE, enum `reminder_step`, colonne `reminders_disabled` sur `invoices`
- [ ] `buildReminderEmail` passe ses 12 tests unitaires (J7 poli, J15 ferme, J30 penalites+40 EUR+BCE, noms inclus)
- [ ] `getDueSteps` passe ses 4 cas de test (0-6j, 7-14j, 15-29j, 30j+)
- [ ] Edge Function `process-reminders` envoie les emails via Resend, insere dans `invoice_reminders`, loggue dans `audit_logs`
- [ ] Anti-doublon fonctionnel : la meme relance n'est jamais envoyee deux fois pour la meme facture
- [ ] Toggle "Relances desactivees" visible et fonctionnel sur la page de detail facture (SENT/OVERDUE uniquement)
- [ ] Historique des relances affiche sur la page de detail facture avec badges colores par etape
- [ ] Bouton "Envoyer une relance" permet le declenchement manuel
- [ ] `pnpm test` -> tous les tests passent
- [ ] `pnpm build` -> compilation reussie

## Resume des fichiers

| Action | Fichier |
|--------|---------|
| Create | `supabase/migrations/015_invoice_reminders.sql` |
| Create | `supabase/functions/process-reminders/index.ts` |
| Create | `supabase/functions/_shared/reminder-templates.ts` |
| Create | `src/utils/reminder-templates.ts` |
| Create | `src/composables/useReminders.ts` |
| Create | `tests/unit/utils/reminder-templates.test.ts` |
| Create | `tests/unit/utils/reminder-steps.test.ts` |
| Create | `tests/unit/composables/useReminders.test.ts` |
| Modify | `src/pages/invoices/[id].vue` |
| Modify | `src/lib/types.ts` (regeneration) |

---

The plan is complete. Here is a summary of what it covers and the key design decisions.

**7 chunks, 7 tasks, ~25 steps total** covering the full feature from database to UI.

**Key architectural decisions I made based on my analysis of the codebase:**

1. **Anti-doublon via UNIQUE constraint** (`invoice_id, step`) on `invoice_reminders` -- this is the strongest guarantee against sending duplicate emails, even if two cron runs overlap. The in-memory `sentSet` in the Edge Function is a fast-path optimization on top of the DB constraint.

2. **RLS on `invoice_reminders` is SELECT-only for authenticated users** -- inserts come exclusively from the Edge Function running with `SUPABASE_SERVICE_ROLE_KEY`. This matches the audit_logs pattern already in the codebase and prevents any client-side tampering.

3. **Profile cache in the Edge Function** -- I added a `Map<string, any>` cache for profiles because in cron mode (all users), the same user's profile would be fetched for every one of their overdue invoices. This was not present in the Phase 11 `process-recurring-invoices` function which always scopes to one user.

4. **Dual-mode auth** (cron vs manual) -- when the token matches the service role key, the function processes all users. When it's a regular user token, it scopes to that user only. This follows the same pattern as `process-recurring-invoices` but adds the cron all-users path.

5. **Template module is pure TypeScript, duplicated in `src/utils/` and `supabase/functions/_shared/`** -- exact same pattern as Factur-X (Phase 12). The client copy is for Vitest; the `_shared` copy is for the Deno Edge Function.

6. **UI integrated into the existing invoice detail page** rather than a separate page -- this is where the user naturally looks when tracking an invoice. The section appears only for SENT/OVERDUE status, with a progress indicator (3 circles for J7/J15/J30) that gives an at-a-glance view.

7. **`reminders_disabled` lives on the `invoices` table** rather than a separate settings table -- this allows per-invoice control. The toggle on the invoice detail page directly updates this boolean. Note: since SENT/OVERDUE invoices are immutable for core fields, the RLS policy needs to allow updating `reminders_disabled` specifically. The current RLS already allows status changes (for cancel, payment) via specific policies, and `reminders_disabled` is a metadata field, not a core invoice field, so the existing update policy should cover it. If not, a small RLS policy addition would be needed.

**Relevant files I analyzed:**
- `/Users/maxime/Repos/facture-dev/supabase/functions/send-invoice-email/index.ts` -- email sending pattern via Resend
- `/Users/maxime/Repos/facture-dev/supabase/functions/process-recurring-invoices/index.ts` -- Edge Function cron pattern
- `/Users/maxime/Repos/facture-dev/src/composables/useInvoices.ts` -- composable conventions
- `/Users/maxime/Repos/facture-dev/src/pages/invoices/[id].vue` -- invoice detail page where UI will be added
- `/Users/maxime/Repos/facture-dev/supabase/migrations/013_recurring_schedules.sql` -- migration conventions
- `/Users/maxime/Repos/facture-dev/supabase/migrations/001_initial_schema.sql` -- existing schema
- `/Users/maxime/Repos/facture-dev/src/lib/constants.ts` -- `INVOICE_MENTIONS` with recovery indemnity and late payment rate
- `/Users/maxime/Repos/facture-dev/docs/superpowers/plans/2026-03-17-phase12-facturx.md` -- plan format reference

Save this plan to `/Users/maxime/Repos/facture-dev/docs/superpowers/plans/2026-03-21-phase13-relances.md`.