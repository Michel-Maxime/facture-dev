# facture.dev — PRD Complet
# Stack : Vue.js 3 + Supabase + TypeScript
# Plugins : ralph-loop, frontend-design, context7, supabase MCP

---

## 0. Setup — Plugins, MCPs et outils

### Plugins Claude Code à installer

```bash
# Boucle de dev itérative autonome
/plugin install ralph-loop@claude-plugins-official

# Design frontend de qualité (anti-AI slop)
/plugin install frontend-design@claude-plugins-official

# Docs live des librairies (Vue 3, Supabase, Tailwind, etc.)
claude mcp add context7 -- npx -y @upstash/context7-mcp@latest
```

### MCP Supabase à connecter

Connecter le MCP Supabase depuis claude.ai > Settings > Connected Apps > Supabase.
Cela donne accès à Claude Code pour :
- Créer et gérer les projets Supabase
- Exécuter du SQL directement sur la base
- Gérer les tables, policies RLS, edge functions
- Configurer l'auth

### Outils de dev à installer localement

```bash
# Node.js 20+
node --version

# Package manager
npm install -g pnpm

# Supabase CLI
npx supabase init
npx supabase start  # DB locale pour le dev

# Vue.js
pnpm create vue@latest facture-dev -- --typescript --vue-router --pinia
```

---

## 1. Contexte projet

"facture.dev" est une application web de facturation pour micro-entrepreneurs français (BNC).
Self-hosted via Supabase (self-hosted ou cloud), open source.
L'utilisateur typique est un dev freelance qui facture 3-15 clients/mois en B2B.

---

## 2. Stack technique

### Frontend
- **Vue 3** (Composition API + `<script setup>`) + **TypeScript**
- **Vue Router 4** (file-based routing via unplugin-vue-router)
- **Pinia** (state management)
- **Tailwind CSS 4** + **shadcn-vue** (composants UI)
- **VueUse** (composables utilitaires)
- **Vite** (bundler)
- **@vue-pdf/renderer** ou **jsPDF** (génération PDF côté client)

### Backend (Supabase)
- **Supabase Auth** (email/password, magic link)
- **Supabase Database** (PostgreSQL avec Row Level Security)
- **Supabase Edge Functions** (Deno/TypeScript, pour la logique métier complexe : numérotation séquentielle, génération PDF côté serveur, envoi d'emails)
- **Supabase Storage** (logos, PDFs générés)
- **Supabase Realtime** (optionnel, pour notifications)

### Pourquoi Supabase suffit
- Auth intégré (pas besoin de JWT custom)
- PostgreSQL complet avec RLS (sécurité row-level)
- Edge Functions pour la logique serveur critique (numérotation atomique)
- Storage pour les fichiers
- API auto-générée (PostgREST) — pas besoin d'écrire un backend REST
- MCP disponible → Claude Code peut créer les tables/policies directement

### Ce qui DOIT rester côté Edge Function (pas côté client)
- Attribution du numéro de facture (transaction atomique)
- Génération du PDF final (immuabilité)
- Envoi d'email
- Validation des règles d'immuabilité

---

## 3. Architecture de fichiers — Best practices Vue.js

```
facture-dev/
├── .claude/
│   └── settings.json          # Config Claude Code
├── supabase/
│   ├── migrations/            # Migrations SQL versionnées
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   └── 003_functions.sql
│   ├── functions/             # Edge Functions (Deno)
│   │   ├── generate-invoice-number/
│   │   │   └── index.ts
│   │   ├── generate-pdf/
│   │   │   └── index.ts
│   │   └── send-invoice-email/
│   │       └── index.ts
│   ├── seed.sql               # Données de test
│   └── config.toml
├── src/
│   ├── assets/
│   │   └── styles/
│   │       └── main.css       # Tailwind directives + CSS custom
│   ├── components/
│   │   ├── ui/                # Composants atomiques (shadcn-vue)
│   │   │   ├── Button.vue
│   │   │   ├── Badge.vue
│   │   │   ├── Input.vue
│   │   │   ├── Select.vue
│   │   │   ├── Card.vue
│   │   │   ├── Modal.vue
│   │   │   ├── DataTable.vue
│   │   │   └── Gauge.vue      # Jauge de progression custom
│   │   ├── layout/
│   │   │   ├── AppSidebar.vue
│   │   │   ├── AppHeader.vue
│   │   │   └── AppLayout.vue  # Layout principal (sidebar + main)
│   │   ├── invoices/
│   │   │   ├── InvoiceTable.vue
│   │   │   ├── InvoiceForm.vue
│   │   │   ├── InvoiceLineItem.vue
│   │   │   ├── InvoiceStatusBadge.vue
│   │   │   └── InvoicePdfPreview.vue
│   │   ├── quotes/
│   │   │   ├── QuoteTable.vue
│   │   │   └── QuoteForm.vue
│   │   ├── clients/
│   │   │   ├── ClientCard.vue
│   │   │   ├── ClientForm.vue
│   │   │   └── ClientGrid.vue
│   │   ├── dashboard/
│   │   │   ├── MetricCard.vue
│   │   │   ├── ThresholdGauges.vue
│   │   │   ├── CotisationsSummary.vue
│   │   │   └── RecentInvoices.vue
│   │   └── ledger/
│   │       └── LedgerTable.vue
│   ├── composables/           # Logique réutilisable (useXxx)
│   │   ├── useAuth.ts         # Auth Supabase
│   │   ├── useClients.ts      # CRUD clients
│   │   ├── useInvoices.ts     # CRUD factures + logique métier
│   │   ├── useQuotes.ts       # CRUD devis
│   │   ├── usePayments.ts     # Enregistrement paiements
│   │   ├── useLedger.ts       # Livre de recettes
│   │   ├── useThresholds.ts   # Calcul seuils + alertes + prorata
│   │   ├── useCotisations.ts  # Calcul cotisations Urssaf
│   │   └── usePdf.ts          # Génération / téléchargement PDF
│   ├── lib/
│   │   ├── supabase.ts        # Client Supabase initialisé
│   │   ├── constants.ts       # Seuils, taux, mentions légales
│   │   └── types.ts           # Types générés depuis Supabase (supabase gen types)
│   ├── pages/                 # Routes (file-based routing)
│   │   ├── index.vue          # Dashboard
│   │   ├── invoices/
│   │   │   ├── index.vue      # Liste factures
│   │   │   └── [id].vue       # Détail facture
│   │   ├── quotes/
│   │   │   └── index.vue
│   │   ├── clients/
│   │   │   ├── index.vue
│   │   │   └── [id].vue
│   │   ├── ledger.vue         # Livre de recettes
│   │   ├── settings.vue       # Paramètres
│   │   ├── login.vue
│   │   └── register.vue
│   ├── stores/                # Pinia stores
│   │   ├── auth.ts
│   │   ├── ui.ts              # État UI (sidebar, modals, theme)
│   │   └── notifications.ts   # Alertes et notifications
│   ├── router/
│   │   ├── index.ts
│   │   └── guards.ts          # Navigation guards (auth)
│   ├── utils/
│   │   ├── formatters.ts      # formatCurrency, formatDate, formatSiret
│   │   ├── validators.ts      # Zod schemas pour validation formulaires
│   │   └── pdf-template.ts    # Template PDF facture
│   ├── App.vue
│   └── main.ts
├── tests/
│   ├── unit/                  # Tests unitaires (Vitest)
│   │   ├── composables/
│   │   │   ├── useThresholds.test.ts
│   │   │   ├── useCotisations.test.ts
│   │   │   └── useInvoices.test.ts
│   │   ├── utils/
│   │   │   ├── formatters.test.ts
│   │   │   └── validators.test.ts
│   │   └── components/
│   │       ├── InvoiceStatusBadge.test.ts
│   │       └── Gauge.test.ts
│   └── e2e/                   # Tests end-to-end (Playwright)
│       ├── auth.spec.ts
│       ├── invoice-creation.spec.ts
│       ├── invoice-immutability.spec.ts
│       ├── ledger.spec.ts
│       └── thresholds.spec.ts
├── .env.local                 # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
├── .env.example
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── package.json
├── pnpm-lock.yaml
├── PRD.md                     # Ce fichier
├── CLAUDE.md                  # Instructions pour Claude Code
└── README.md
```

### Principes d'architecture

1. **Composition API + `<script setup>` uniquement** — jamais d'Options API
2. **Composables pour la logique** — chaque domaine (invoices, clients, thresholds) a son composable `useXxx.ts`
3. **Composants dumb vs smart** — les composants dans `ui/` sont purement visuels (props in, events out), la logique métier est dans les composables et les pages
4. **Types générés depuis Supabase** — `npx supabase gen types typescript --local > src/lib/types.ts`
5. **Validation avec Zod** — chaque formulaire a un schema Zod correspondant
6. **Pinia uniquement pour l'état global** — auth, UI, notifications. Le reste est dans les composables avec les queries Supabase
7. **File-based routing** — les fichiers dans `pages/` génèrent automatiquement les routes

---

## 4. Base de données — SQL (Supabase migrations)

```sql
-- 001_initial_schema.sql

-- Extension pour UUID
create extension if not exists "uuid-ossp";

-- Enum types
create type vat_regime as enum ('FRANCHISE', 'SUBJECT');
create type frequency as enum ('MONTHLY', 'QUARTERLY');
create type client_type as enum ('PROFESSIONAL', 'INDIVIDUAL');
create type invoice_status as enum ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');
create type quote_status as enum ('DRAFT', 'SENT', 'ACCEPTED', 'REFUSED', 'EXPIRED');

-- Profiles (extends Supabase auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  first_name text not null,
  last_name text not null,
  address text not null,
  city text not null,
  postal_code text not null,
  siret text not null,
  code_ape text,
  iban text,
  bic text,
  company_created_at date not null,
  vat_regime vat_regime default 'FRANCHISE',
  declaration_freq frequency default 'QUARTERLY',
  cotisation_rate numeric(5,3) default 0.256,
  logo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Clients
create table clients (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  type client_type default 'PROFESSIONAL',
  siret text,
  address text not null,
  city text not null,
  postal_code text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Invoice sequence (atomic numbering per user per year)
create table invoice_sequences (
  user_id uuid references profiles(id) on delete cascade,
  year int not null,
  last_number int default 0,
  primary key (user_id, year)
);

-- Invoices
create table invoices (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  client_id uuid references clients(id) not null,
  number text unique,              -- FAC-2026-001 (null while DRAFT)
  sequence_number int,             -- 1, 2, 3...
  status invoice_status default 'DRAFT',
  issue_date date not null,
  service_date date not null,
  due_date date not null,
  payment_term_days int default 30,
  payment_method text default 'Virement bancaire',
  subtotal numeric(10,2) not null,
  vat_rate numeric(5,3) default 0,
  vat_amount numeric(10,2) default 0,
  total numeric(10,2) not null,
  notes text,
  pdf_url text,                    -- URL du PDF dans Supabase Storage
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Invoice lines
create table invoice_lines (
  id uuid default uuid_generate_v4() primary key,
  invoice_id uuid references invoices(id) on delete cascade not null,
  description text not null,
  quantity numeric(10,2) not null,
  unit_price numeric(10,2) not null,
  amount numeric(10,2) not null,
  sort_order int default 0
);

-- Payments
create table payments (
  id uuid default uuid_generate_v4() primary key,
  invoice_id uuid references invoices(id) not null,
  amount numeric(10,2) not null,
  date date not null,
  method text not null,
  reference text,
  created_at timestamptz default now()
);

-- Quote sequence
create table quote_sequences (
  user_id uuid references profiles(id) on delete cascade,
  year int not null,
  last_number int default 0,
  primary key (user_id, year)
);

-- Quotes
create table quotes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  client_id uuid references clients(id) not null,
  number text unique,
  status quote_status default 'DRAFT',
  issue_date date not null,
  valid_until date not null,
  subtotal numeric(10,2) not null,
  notes text,
  converted_invoice_id uuid references invoices(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Quote lines
create table quote_lines (
  id uuid default uuid_generate_v4() primary key,
  quote_id uuid references quotes(id) on delete cascade not null,
  description text not null,
  quantity numeric(10,2) not null,
  unit_price numeric(10,2) not null,
  amount numeric(10,2) not null,
  sort_order int default 0
);

-- Audit log (IMMUTABLE — no update, no delete)
create table audit_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  action text not null,
  entity text not null,
  entity_id uuid not null,
  details jsonb,
  created_at timestamptz default now()
);

-- Indexes
create index idx_invoices_user on invoices(user_id);
create index idx_invoices_client on invoices(client_id);
create index idx_invoices_status on invoices(status);
create index idx_clients_user on clients(user_id);
create index idx_payments_invoice on payments(invoice_id);
create index idx_audit_user on audit_logs(user_id);
```

```sql
-- 002_rls_policies.sql

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table clients enable row level security;
alter table invoices enable row level security;
alter table invoice_lines enable row level security;
alter table payments enable row level security;
alter table quotes enable row level security;
alter table quote_lines enable row level security;
alter table audit_logs enable row level security;
alter table invoice_sequences enable row level security;
alter table quote_sequences enable row level security;

-- Profiles: users can only access their own profile
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Clients: users can only access their own clients
create policy "Users can CRUD own clients" on clients for all using (auth.uid() = user_id);

-- Invoices: users can only access their own invoices
create policy "Users can view own invoices" on invoices for select using (auth.uid() = user_id);
create policy "Users can insert own invoices" on invoices for insert with check (auth.uid() = user_id);
-- CRITICAL: only DRAFT invoices can be updated
create policy "Users can update own DRAFT invoices" on invoices for update
  using (auth.uid() = user_id AND status = 'DRAFT');
-- CRITICAL: only DRAFT invoices without a number can be deleted
create policy "Users can delete own DRAFT invoices" on invoices for delete
  using (auth.uid() = user_id AND status = 'DRAFT' AND number is null);

-- Invoice lines: access through parent invoice
create policy "Users can manage invoice lines" on invoice_lines for all
  using (exists (select 1 from invoices where invoices.id = invoice_lines.invoice_id and invoices.user_id = auth.uid()));

-- Payments
create policy "Users can manage payments" on payments for all
  using (exists (select 1 from invoices where invoices.id = payments.invoice_id and invoices.user_id = auth.uid()));

-- Quotes
create policy "Users can CRUD own quotes" on quotes for all using (auth.uid() = user_id);
create policy "Users can manage quote lines" on quote_lines for all
  using (exists (select 1 from quotes where quotes.id = quote_lines.quote_id and quotes.user_id = auth.uid()));

-- Audit logs: insert only (IMMUTABLE), read own
create policy "Users can view own audit logs" on audit_logs for select using (auth.uid() = user_id);
create policy "Users can insert audit logs" on audit_logs for insert with check (auth.uid() = user_id);
-- NO update or delete policy → audit logs are immutable

-- Sequences
create policy "Users can manage own sequences" on invoice_sequences for all using (auth.uid() = user_id);
create policy "Users can manage own quote sequences" on quote_sequences for all using (auth.uid() = user_id);
```

```sql
-- 003_functions.sql

-- Atomic invoice number generation (called from Edge Function)
create or replace function generate_invoice_number(p_user_id uuid, p_year int)
returns table(seq_number int, invoice_number text)
language plpgsql
security definer
as $$
declare
  v_seq int;
begin
  -- Upsert sequence with lock
  insert into invoice_sequences (user_id, year, last_number)
  values (p_user_id, p_year, 1)
  on conflict (user_id, year)
  do update set last_number = invoice_sequences.last_number + 1
  returning last_number into v_seq;

  return query select v_seq, 'FAC-' || p_year::text || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

-- Similar for quotes
create or replace function generate_quote_number(p_user_id uuid, p_year int)
returns table(seq_number int, quote_number text)
language plpgsql
security definer
as $$
declare
  v_seq int;
begin
  insert into quote_sequences (user_id, year, last_number)
  values (p_user_id, p_year, 1)
  on conflict (user_id, year)
  do update set last_number = quote_sequences.last_number + 1
  returning last_number into v_seq;

  return query select v_seq, 'DEV-' || p_year::text || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

-- Dashboard stats view
create or replace view dashboard_stats as
select
  user_id,
  sum(case when status = 'PAID' then total else 0 end) as ca_encaisse,
  sum(total) as ca_facture,
  sum(case when status = 'SENT' then total else 0 end) as en_attente,
  count(case when status = 'SENT' then 1 end) as nb_en_attente,
  count(case when status = 'PAID' then 1 end) as nb_payees,
  count(*) as nb_total
from invoices
where extract(year from issue_date) = extract(year from current_date)
group by user_id;
```

---

## 5. Design System tokens

(Identique au document précédent — couleurs, typo DM Sans, espacement base 4, rayons, composants.
Utiliser shadcn-vue comme base de composants UI et personnaliser avec les tokens.)

### Couleurs Tailwind (tailwind.config.ts)

```typescript
export default {
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#7C3AED', light: '#EDE9FE', hover: '#6D28D9' },
        success: { DEFAULT: '#059669', light: '#DCFCE7' },
        warning: { DEFAULT: '#D97706', light: '#FEF3C7' },
        danger: { DEFAULT: '#DC2626', light: '#FEE2E2' },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
}
```

---

## 6. Constantes métier (src/lib/constants.ts)

```typescript
export const THRESHOLDS = {
  microEnterprise: { services: 83_600, sales: 203_100 },
  vatFranchise: { services: 37_500, sales: 85_000 },
  vatMajored: { services: 41_250, sales: 93_500 },
  dedicatedBankAccount: 10_000,
} as const;

export const COTISATION_RATES_2026 = {
  BNC_SSI: 0.256,
  BNC_CIPAV: 0.232,
  BIC_SERVICES: 0.212,
  BIC_VENTE: 0.123,
  CFP: 0.002,
  VFL_BNC: 0.022,
  VFL_BIC_SERVICES: 0.017,
  VFL_BIC_VENTE: 0.01,
} as const;

export const INVOICE_MENTIONS = {
  vatExemption: 'TVA non applicable, article 293 B du Code Général des Impôts',
  recoveryIndemnity: 'Indemnité forfaitaire pour frais de recouvrement : 40 €',
  latePaymentRate: 'Pénalités de retard : 3 fois le taux d\'intérêt légal',
  eiMention: 'Entrepreneur individuel',
} as const;

export const ALERT_THRESHOLDS = { warning: 0.80, danger: 0.95 } as const;

export function getProratedThreshold(annual: number, companyCreatedAt: Date): number {
  const year = new Date().getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const creationDate = companyCreatedAt > startOfYear ? companyCreatedAt : startOfYear;
  const daysRemaining = Math.ceil(
    (new Date(year, 11, 31).getTime() - creationDate.getTime()) / 86_400_000
  );
  return Math.round(annual * (daysRemaining / 365));
}
```

---

## 7. Règles métier IMPÉRATIVES

### Numérotation
- Chronologique, continue, SANS TROU
- Générée côté serveur via `generate_invoice_number()` (transaction atomique PostgreSQL)
- Le numéro est attribué au moment de l'émission (DRAFT → SENT), PAS à la création du brouillon
- Format : FAC-{YEAR}-{SEQ} (ex : FAC-2026-001)

### Immuabilité
- RLS policy : seuls les DRAFT peuvent être UPDATE/DELETE
- Une facture SENT/PAID/OVERDUE/CANCELLED ne peut JAMAIS être modifiée
- Pour corriger : émettre un avoir puis une nouvelle facture
- Chaque action est tracée dans audit_logs (insert only, pas de update/delete)

### Mentions obligatoires sur le PDF
Voir la liste complète dans le PRD précédent. Le PDF est généré côté Edge Function pour garantir l'immuabilité et stocké dans Supabase Storage.

### Seuils et alertes
- Prorata automatique en 1ère année
- Alertes à 80 % (warning) et 95 % (danger)
- Calculés dans le composable `useThresholds.ts`

---

## 8. Tests

### Vitest (unit)
```
tests/unit/
├── composables/
│   ├── useThresholds.test.ts    — prorata, alertes 80/95%
│   ├── useCotisations.test.ts   — calcul exact des taux
│   └── useInvoices.test.ts      — logique métier
├── utils/
│   ├── formatters.test.ts       — formatCurrency, formatDate
│   └── validators.test.ts       — schemas Zod
└── components/
    ├── Gauge.test.ts             — rendu couleurs selon %
    └── InvoiceStatusBadge.test.ts
```

### Playwright (e2e)
```
tests/e2e/
├── auth.spec.ts                — inscription, connexion, déconnexion
├── invoice-creation.spec.ts    — créer brouillon → émettre → PDF correct
├── invoice-immutability.spec.ts — vérifier qu'on ne peut pas modifier une facture émise
├── ledger.spec.ts              — vérifier que seules les factures payées apparaissent
└── thresholds.spec.ts          — vérifier les alertes au franchissement des seuils
```

### Tests critiques (bloquants)
- [ ] Numérotation continue sans trou
- [ ] Facture émise non modifiable / non supprimable
- [ ] Toutes les mentions obligatoires sur le PDF
- [ ] Seuils proratisés correctement en 1ère année
- [ ] Alertes à 80 % et 95 %
- [ ] Livre de recettes = uniquement paiements reçus
- [ ] Chaque action crée une entrée audit_log

---

## 9. Commandes Ralph Loop pour le développement

### Phase 1 — Supabase + Auth + Clients

```
/ralph-loop "Read PRD.md. Phase 1: Setup Supabase + Auth + Clients.

Use the Supabase MCP to:
1. Create the database schema (run migration 001_initial_schema.sql)
2. Apply RLS policies (migration 002_rls_policies.sql)
3. Create the database functions (migration 003_functions.sql)

Then in the Vue.js app:
4. Initialize Vue 3 + TypeScript + Vite + Tailwind + Pinia + Vue Router
5. Set up Supabase client (src/lib/supabase.ts)
6. Generate types: npx supabase gen types typescript --local > src/lib/types.ts
7. Implement auth (login, register, logout) with Supabase Auth
8. Implement navigation guards (redirect to login if not authenticated)
9. Implement client CRUD with composable useClients.ts
10. Create AppLayout (sidebar + main area)

Use context7 for Vue 3, Supabase, and Tailwind docs.
Follow the file structure from PRD.md exactly.
Use Composition API + <script setup> everywhere.

Success criteria:
- supabase start works, migrations applied
- Auth flow works (register → login → protected routes)
- Client CRUD works (create, read, update, delete)
- RLS policies verified (user can only see their own data)
- Types generated from Supabase schema

Output <promise>PHASE1_DONE</promise>" --max-iterations 25 --completion-promise "PHASE1_DONE"
```

### Phase 2 — Factures (coeur métier)

```
/ralph-loop "Read PRD.md. Phase 2: Invoice system.

1. Create Edge Function 'generate-invoice-number' that calls the PostgreSQL function generate_invoice_number() atomically
2. Implement useInvoices.ts composable:
   - Create draft invoice
   - Add/edit/remove line items
   - Emit invoice (DRAFT → SENT): calls Edge Function for number, generates PDF, stores in Supabase Storage
   - IMMUTABILITY: verify RLS prevents editing non-DRAFT invoices
3. Implement PDF generation (Edge Function or client-side):
   - Must contain ALL mandatory French mentions from PRD.md constants
   - Professional layout with logo, IBAN/BIC, line items table
4. Implement usePayments.ts: record payment, mark invoice as PAID
5. Implement useLedger.ts: query only PAID invoices with payment date
6. Implement audit logging (insert into audit_logs on every action)
7. Write Vitest tests for:
   - Invoice number sequential (no gaps)
   - Cannot update/delete SENT invoice (RLS rejects)
   - PDF contains all required mentions
   - Ledger only contains paid invoices

Use context7 for Supabase Edge Functions docs.

Output <promise>PHASE2_DONE</promise>" --max-iterations 35 --completion-promise "PHASE2_DONE"
```

### Phase 3 — Frontend complet

```
/ralph-loop "Read PRD.md. Phase 3: Complete frontend.

Use the frontend-design skill. Design direction: clean, modern, professional. DM Sans font. Violet #7C3AED primary. Flat design inspired by Linear/Vercel. Use shadcn-vue components as base.

Build ALL screens from PRD.md file structure:
1. Dashboard (pages/index.vue): 4 metric cards, 2 threshold gauges, cotisations grid, recent invoices
2. Invoices (pages/invoices/index.vue): filterable table, status badges, PDF download
3. Invoice detail (pages/invoices/[id].vue): full invoice view + payment recording
4. Invoice creation: modal or page with client select, line items, auto-totals
5. Quotes (pages/quotes/index.vue): table + convert to invoice
6. Clients (pages/clients/index.vue): card grid with avatars
7. Client detail (pages/clients/[id].vue): info + invoice history
8. Ledger (pages/ledger.vue): table with CSV/PDF export
9. Settings (pages/settings.vue): profile form
10. Login + Register pages

All screens must be connected to real Supabase data via composables.
Threshold gauges: green < 80%, yellow 80-95%, red > 95%.
Responsive layout (sidebar collapses on mobile).

Output <promise>PHASE3_DONE</promise>" --max-iterations 40 --completion-promise "PHASE3_DONE"
```

### Phase 4 — Devis + Relances + Polish

```
/ralph-loop "Read PRD.md. Phase 4: Quotes, reminders, polish.

1. Implement quotes (useQuotes.ts): CRUD, numbering, convert to invoice
2. Implement email sending (Edge Function send-invoice-email)
3. Implement automatic overdue detection (SENT + past due_date → OVERDUE)
4. Implement Urssaf declaration helper (useCotisations.ts: CA per period, estimated amounts)
5. Add declaration reminder in sidebar
6. Write Playwright e2e tests for all critical flows
7. Polish: loading states, error handling, empty states, toast notifications
8. README.md with setup instructions

Output <promise>PHASE4_DONE</promise>" --max-iterations 35 --completion-promise "PHASE4_DONE"
```

---

## 10. CLAUDE.md — Instructions pour Claude Code

Créer ce fichier à la racine du projet :

```markdown
# CLAUDE.md

## Project: facture.dev
Invoicing app for French micro-entrepreneurs (BNC).

## Stack
- Frontend: Vue 3 + TypeScript + Composition API + Tailwind + shadcn-vue + Pinia
- Backend: Supabase (Auth, Database, Edge Functions, Storage)
- Tests: Vitest (unit) + Playwright (e2e)

## Rules
- ALWAYS use `<script setup lang="ts">` in Vue components
- ALWAYS use Composition API, NEVER Options API
- ALWAYS use TypeScript strict mode
- Business logic goes in composables (src/composables/useXxx.ts), NOT in components
- Components in src/components/ui/ are dumb (props in, events out, no business logic)
- Use Zod for ALL form validation
- Use Supabase generated types (src/lib/types.ts) — regenerate after schema changes
- French locale for all dates and currencies (Intl.NumberFormat, Intl.DateTimeFormat)
- Follow the file structure in PRD.md exactly

## Critical business rules
- Invoice numbers are SEQUENTIAL and CONTINUOUS (no gaps)
- Emitted invoices (status != DRAFT) are IMMUTABLE (enforced by RLS)
- All PDF invoices MUST contain ALL mandatory French mentions (see src/lib/constants.ts)
- Thresholds are prorated in the first year of activity
- Audit logs are INSERT ONLY (no update, no delete)

## Testing
- Run unit tests: pnpm test
- Run e2e: pnpm test:e2e
- All critical tests must pass before any merge
```
