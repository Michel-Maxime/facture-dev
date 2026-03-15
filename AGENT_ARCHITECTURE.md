# facture.dev — Architecture d'agents Claude Code
# Plugins, Skills, Subagents, Hooks et workflow Ralph Loop

---

## 0. Vue d'ensemble de l'architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLAUDE.md                             │
│         (Règles globales, toujours en contexte)         │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│                PLUGINS INSTALLÉS                         │
│  ralph-loop · frontend-design · context7                │
│  MCP: supabase · figma                                  │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│                 SKILLS (auto-invoquées)                  │
│  french-invoicing · vue-conventions · supabase-patterns  │
│  testing-standards · design-system                       │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│               SUBAGENTS (invoqués à la demande)          │
│  db-architect · ui-builder · qa-auditor · pdf-generator  │
│  spec-reviewer · migration-planner                       │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│                 HOOKS (automatiques)                      │
│  PostToolUse: lint + typecheck                           │
│  PreToolUse: protect-immutable-files                     │
│  Stop: ralph-loop continuation                           │
└──────────────────────────────────────────────────────────┘
```

**Règle d'or** :
- CLAUDE.md = ce qui est TOUJOURS vrai (< 200 lignes)
- Skills = contexte chargé à la demande selon le sujet
- Subagents = tâches isolées dans leur propre contexte (préserve le contexte principal)
- Hooks = actions déterministes automatiques (lint, validation, sécurité)

---

## 1. CLAUDE.md — Le cerveau global (< 200 lignes)

Fichier : `.claude/CLAUDE.md`

```markdown
# facture.dev

## Project
Self-hosted invoicing app for French micro-entrepreneurs (BNC).
Stack: Vue 3 + TypeScript + Supabase + Tailwind + shadcn-vue.

## Architecture rules
- Vue: ALWAYS use <script setup lang="ts"> and Composition API
- Business logic: ONLY in composables (src/composables/useXxx.ts)
- Components in src/components/ui/ are dumb (props in, events out)
- Types: generated from Supabase (src/lib/types.ts) — regenerate after schema changes
- Validation: Zod for ALL forms
- State: Pinia ONLY for global state (auth, UI). Domain state in composables.
- Locale: ALL dates and currencies in French (fr-FR)

## Critical business rules
- Invoice numbers: SEQUENTIAL, CONTINUOUS, NO GAPS
- Emitted invoices (status != DRAFT): IMMUTABLE (enforced by Supabase RLS)
- PDF invoices: MUST contain ALL mandatory French mentions (see src/lib/constants.ts)
- Audit logs: INSERT ONLY (no update, no delete)
- Thresholds: prorated in first year of activity

## File structure
- src/components/ui/ → atomic UI components (shadcn-vue based)
- src/components/{domain}/ → domain-specific components
- src/composables/ → useXxx.ts business logic
- src/pages/ → file-based routing
- src/lib/ → supabase client, types, constants
- src/utils/ → formatters, validators
- supabase/migrations/ → SQL migrations (versioned)
- supabase/functions/ → Edge Functions (Deno)
- tests/unit/ → Vitest
- tests/e2e/ → Playwright

## Testing
- Run: pnpm test (unit) | pnpm test:e2e (e2e)
- Critical tests MUST pass before merge
- Coverage minimum: 80%

## Conventions
- Commits: conventional commits (feat:, fix:, chore:, test:)
- Branch: feature/{name}, fix/{name}
- PR: always against main, squash merge
- French for UI labels, English for code

## MCP Available
- Supabase: database, auth, storage, edge functions
- Figma: design context, code connect
- Context7: live docs for Vue, Supabase, Tailwind

## Do NOT
- Use Options API
- Put business logic in components
- Modify emitted invoices (status != DRAFT)
- Delete audit logs
- Skip type generation after schema changes
- Use any locale other than fr-FR for user-facing content
```

---

## 2. Skills — Contexte spécialisé auto-invoqué

### Skill : french-invoicing

Fichier : `.claude/skills/french-invoicing/SKILL.md`

```markdown
---
name: french-invoicing
description: French micro-enterprise invoicing rules, mandatory mentions, thresholds, VAT, cotisations. Auto-invoked when working on invoices, PDF generation, thresholds, tax calculations, ledger.
---

# French micro-enterprise invoicing rules (2026)

## Mandatory invoice mentions (amende 15 € par mention manquante)
Every generated PDF MUST include:
1. The word "Facture"
2. Unique sequential number (FAC-{YEAR}-{SEQ})
3. Issue date
4. Service date (period or date)
5. Seller: first name + last name + address + SIRET + "Entrepreneur individuel" or "EI"
6. Client: name/company + address + SIRET (if professional)
7. Line items: description, quantity, unit price, amount
8. Subtotal HT
9. VAT mention: "TVA non applicable, article 293 B du CGI" (if franchise)
10. Payment terms: deadline + accepted methods
11. Late payment penalties rate
12. Recovery indemnity: "Indemnité forfaitaire pour frais de recouvrement : 40 €" (B2B only)
13. Bank details: IBAN + BIC (recommended)

## Thresholds 2026
- Micro-enterprise ceiling (services): 83,600 €/year
- VAT franchise (services): 37,500 €/year
- VAT majored (services): 41,250 €/year
- Prorata in first year: threshold × (remaining_days / 365)
- Alert at 80% (warning) and 95% (danger)

## Cotisation rates 2026
- BNC/SSI: 25.6%
- CFP: 0.2%
- VFL (versement libératoire IR): 2.2%
- ACRE (first year, if eligible): rates halved

## Invoice numbering
- Atomic generation via PostgreSQL function (transaction + lock)
- Number assigned at emission (DRAFT → SENT), NOT at creation
- Format: FAC-{YEAR}-{SEQ} padded to 3 digits
- Avoirs (credit notes): AVO-{YEAR}-{SEQ}

## Immutability
- DRAFT: can be edited and deleted
- SENT/PAID/OVERDUE/CANCELLED: IMMUTABLE (Supabase RLS enforces this)
- To correct: issue credit note + new invoice

## Ledger (Livre de recettes)
- Auto-generated from paid invoices only
- Columns: date encaissement, ref facture, client, nature, montant, mode règlement
- Export: PDF + CSV
```

### Skill : vue-conventions

Fichier : `.claude/skills/vue-conventions/SKILL.md`

```markdown
---
name: vue-conventions
description: Vue.js 3 coding conventions and patterns for this project. Auto-invoked when creating or editing Vue components, composables, pages, or router config.
---

# Vue.js 3 conventions for facture.dev

## Components
- ALWAYS use <script setup lang="ts">
- Props: defineProps with TypeScript interface
- Emits: defineEmits with typed events
- No Options API, no mixins
- Use defineModel() for v-model bindings

## Composables
- File naming: useXxx.ts (e.g., useInvoices.ts)
- Return reactive refs and functions
- Handle loading/error states internally
- Use Supabase client from src/lib/supabase.ts
- Never call Supabase directly from components

## Pattern for Supabase composable:
```ts
// src/composables/useClients.ts
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/types'

type Client = Database['public']['Tables']['clients']['Row']

export function useClients() {
  const clients = ref<Client[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchClients() {
    loading.value = true
    error.value = null
    const { data, error: err } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) error.value = err.message
    else clients.value = data ?? []
    loading.value = false
  }

  // ... create, update, delete

  return { clients, loading, error, fetchClients }
}
```

## Pages (file-based routing)
- src/pages/index.vue → /
- src/pages/invoices/index.vue → /invoices
- src/pages/invoices/[id].vue → /invoices/:id
- Use unplugin-vue-router for auto-generation

## State management
- Pinia for: auth state, UI state (sidebar, theme), notifications
- Composables for: domain data (clients, invoices, quotes)
- Never duplicate Supabase data in Pinia

## Validation
- Zod schemas in src/utils/validators.ts
- vee-validate + @vee-validate/zod for form integration
```

### Skill : supabase-patterns

Fichier : `.claude/skills/supabase-patterns/SKILL.md`

```markdown
---
name: supabase-patterns
description: Supabase usage patterns, RLS policies, Edge Functions, and database conventions. Auto-invoked when working on database, migrations, auth, storage, or edge functions.
---

# Supabase patterns for facture.dev

## Auth
- Use Supabase Auth (email + password)
- Profile data in public.profiles table (extends auth.users via FK)
- On signup: create profile via database trigger or client-side insert
- Navigation guard: check supabase.auth.getSession() before protected routes

## RLS (Row Level Security)
- EVERY table has RLS enabled
- Users can ONLY access their own data (user_id = auth.uid())
- CRITICAL: invoices UPDATE policy restricts to status = 'DRAFT' only
- CRITICAL: audit_logs has INSERT policy only (no UPDATE, no DELETE)

## Edge Functions (Deno)
Use for server-side logic that MUST NOT run on the client:
- generate-invoice-number: atomic numbering (calls PostgreSQL function)
- generate-pdf: creates immutable PDF, stores in Supabase Storage
- send-invoice-email: sends email via SMTP/Resend

## Migrations
- Versioned SQL files in supabase/migrations/
- Run: npx supabase db push (cloud) or npx supabase migration up (local)
- After schema change: npx supabase gen types typescript --local > src/lib/types.ts

## Storage
- Bucket "invoices": generated PDFs (public read per user)
- Bucket "logos": user logos (public read per user)
- RLS on storage: users can only access their own folder

## Realtime (optional)
- Subscribe to invoice status changes for live dashboard updates
```

### Skill : testing-standards

Fichier : `.claude/skills/testing-standards/SKILL.md`

```markdown
---
name: testing-standards
description: Testing standards and patterns. Auto-invoked when writing or discussing tests, QA, coverage, or test strategy.
---

# Testing standards for facture.dev

## Unit tests (Vitest)
Location: tests/unit/
Config: vitest.config.ts
Run: pnpm test

### What to test:
- Composables: useThresholds, useCotisations, useInvoices logic
- Utils: formatters (currency, date, SIRET), validators (Zod schemas)
- Components: rendering, props, events (Vue Test Utils)

### Pattern:
```ts
import { describe, it, expect } from 'vitest'
import { getProratedThreshold } from '@/lib/constants'

describe('getProratedThreshold', () => {
  it('prorates correctly for mid-year creation', () => {
    const threshold = getProratedThreshold(83600, new Date('2026-07-01'))
    expect(threshold).toBeCloseTo(42121, 0) // ~184/365 * 83600
  })
})
```

## E2E tests (Playwright)
Location: tests/e2e/
Config: playwright.config.ts
Run: pnpm test:e2e

### Critical test scenarios (MUST pass):
1. Auth: register → login → access protected route → logout
2. Invoice creation: create draft → add lines → emit → verify number is sequential
3. Invoice immutability: try to edit SENT invoice → verify rejection
4. PDF compliance: download PDF → verify all mandatory mentions present
5. Ledger: create invoice → pay → verify appears in ledger → verify unpaid does NOT
6. Thresholds: create invoices approaching 80% → verify warning alert

## Coverage
- Minimum: 80% on composables and utils
- Run: pnpm test --coverage
```

### Skill : design-system

Fichier : `.claude/skills/design-system/SKILL.md`

```markdown
---
name: design-system
description: Design system tokens, colors, typography, and component specs. Auto-invoked when building UI components, pages, or styling.
---

# Design system — facture.dev

## Colors (Tailwind config)
- Primary: #7C3AED (violet-600), light: #EDE9FE, hover: #6D28D9
- Success: #059669, light: #DCFCE7
- Warning: #D97706, light: #FEF3C7
- Danger: #DC2626, light: #FEE2E2
- Background: #F9FAFB, Cards: #FFFFFF, Borders: #E5E7EB
- Text: #111827 (primary), #6B7280 (secondary), #9CA3AF (muted)

## Typography
- Font: 'DM Sans', system-ui, sans-serif
- Mono: 'JetBrains Mono' (invoice numbers, SIRET, IBAN)
- H1: 22px/700, H2: 18px/700, Body: 14px/400, Small: 12px/400

## Components
- Buttons: primary (violet bg), secondary (border), ghost (text only)
- Badges: paid (green), sent (blue), draft (gray), overdue (red)
- Cards: white bg, 1px border #E5E7EB, radius 12px, padding 20px
- Metric cards: label 12px gray + value 24px bold + sub 11px
- Gauges: 8px height, full radius, color by threshold (green/yellow/red)
- Tables: 11px uppercase header, mono numbers, hover bg-gray-50
- Modals: overlay 40% black, card radius 16px, max-width 620px

## Layout
- Sidebar: 220px, white bg, border-right
- Main: flex-1, #F9FAFB bg, padding 28px, overflow-y auto
- No shadows. Flat design. 1px borders only.

## Use shadcn-vue
- Base components from shadcn-vue, customized with our tokens
- Do NOT use generic defaults — always apply our color/spacing system
```

---

## 3. Subagents — Travailleurs spécialisés

### Subagent : db-architect

Fichier : `.claude/agents/db-architect.md`

```markdown
---
name: db-architect
description: Database architecture specialist. Use for schema design, migrations, RLS policies, PostgreSQL functions, and Supabase configuration. Reads existing schema and proposes changes.
tools:
  - Read
  - Glob
  - Grep
  - Bash
  - mcp__supabase__*
model: sonnet
---

You are a PostgreSQL and Supabase database architect for the facture.dev project.

Your responsibilities:
- Design and review database schemas
- Write SQL migrations (supabase/migrations/)
- Create and audit RLS policies
- Write PostgreSQL functions (atomic operations)
- Ensure data integrity and security

Rules:
- ALWAYS use RLS on every table
- Invoice update policies MUST restrict to DRAFT status only
- Audit logs MUST be insert-only (no update/delete policies)
- Use transactions for atomic operations (invoice numbering)
- After schema changes, remind to regenerate types

Output format:
- SQL migration files ready to apply
- Explanation of security implications
- List of types that need regeneration
```

### Subagent : ui-builder

Fichier : `.claude/agents/ui-builder.md`

```markdown
---
name: ui-builder
description: Frontend UI specialist for Vue.js 3 components and pages. Use when building new screens, components, or improving the interface. Follows the design system strictly.
tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
skills:
  - design-system
  - vue-conventions
---

You are a senior Vue.js 3 frontend developer for facture.dev.

Your responsibilities:
- Build Vue components using <script setup lang="ts">
- Follow the design system tokens exactly (see design-system skill)
- Create responsive layouts with Tailwind CSS
- Use shadcn-vue as base components
- Implement proper loading, error, and empty states

Rules:
- Components in src/components/ui/ are dumb (no business logic)
- Use composables for data fetching, never call Supabase in components
- All text in French for UI labels
- Use DM Sans for text, JetBrains Mono for numbers/codes
- No shadows, flat design, 1px borders

When building a page:
1. Read the composable for that domain first
2. Build the page component connecting to the composable
3. Handle loading, error, and empty states
4. Ensure responsive behavior
5. Test visually with different data states
```

### Subagent : qa-auditor

Fichier : `.claude/agents/qa-auditor.md`

```markdown
---
name: qa-auditor
description: Quality assurance auditor. Use after implementing a feature to verify compliance with business rules, code quality, test coverage, and French invoicing regulations.
tools:
  - Read
  - Glob
  - Grep
  - Bash
skills:
  - french-invoicing
  - testing-standards
model: sonnet
---

You are a QA auditor for facture.dev. Your job is to find issues BEFORE they reach production.

## Audit checklist

### Business rules compliance
- [ ] Invoice numbering is sequential and continuous (no gaps)
- [ ] Emitted invoices are immutable (RLS enforced)
- [ ] PDF contains ALL mandatory French mentions
- [ ] Thresholds are prorated in first year
- [ ] Alerts fire at 80% and 95%
- [ ] Ledger only contains paid invoices
- [ ] Audit log captures every action

### Code quality
- [ ] No Options API usage
- [ ] No business logic in components
- [ ] Composables handle loading/error states
- [ ] Types are generated and up-to-date
- [ ] Zod validation on all forms
- [ ] No hardcoded strings (use constants.ts)
- [ ] French locale for all user-facing content

### Test coverage
- [ ] Critical paths have unit tests
- [ ] E2E tests cover happy paths
- [ ] Edge cases tested (zero CA, threshold boundary, first year prorata)
- [ ] Coverage ≥ 80% on composables and utils

### Security
- [ ] RLS enabled on all tables
- [ ] No Supabase service key exposed to client
- [ ] Auth guard on all protected routes
- [ ] Input validation before database operations

Output: structured report with PASS/FAIL per item and remediation for failures.
```

### Subagent : spec-reviewer

Fichier : `.claude/agents/spec-reviewer.md`

```markdown
---
name: spec-reviewer
description: Reviews implementation against the PRD. Use before starting a new phase or after completing one to verify alignment with specifications.
tools:
  - Read
  - Glob
  - Grep
model: sonnet
---

You are a product spec reviewer. Compare the current implementation against PRD.md.

For each feature in the PRD:
1. Check if it's implemented
2. Check if it matches the specification
3. Flag any deviations
4. Identify missing features

Output a status report:
- ✅ Implemented and conforming
- ⚠️ Implemented but deviating (explain how)
- ❌ Not implemented
- 📝 Not in scope for current phase

Always reference the specific PRD section for each item.
```

---

## 4. Hooks — Automatismes déterministes

Fichier : `.claude/settings.json`

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "if echo \"$CLAUDE_TOOL_INPUT\" | grep -q '\\.vue\\|\\.ts\\|\\.tsx'; then cd /path/to/facture-dev && npx vue-tsc --noEmit 2>&1 | head -20; fi"
          }
        ]
      },
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "if echo \"$CLAUDE_TOOL_INPUT\" | grep -q '\\.vue\\|\\.ts'; then cd /path/to/facture-dev && npx eslint --fix $(echo \"$CLAUDE_TOOL_INPUT\" | jq -r '.file_path // .path') 2>&1 | tail -5; fi"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"$CLAUDE_TOOL_INPUT\" | jq -r '.file_path // .path' | grep -q 'supabase/migrations/0' && echo 'BLOCKED: Do not modify existing migrations. Create a new migration file instead.' && exit 2 || exit 0"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"$CLAUDE_TOOL_INPUT\" | jq -r '.command' | grep -qE 'DROP TABLE|TRUNCATE|DELETE FROM audit_logs' && echo 'BLOCKED: Destructive database operation not allowed.' && exit 2 || exit 0"
          }
        ]
      }
    ]
  }
}
```

**Ce que les hooks font :**
- **PostToolUse (Write/Edit)** : type-check TypeScript et lint automatique après chaque fichier modifié
- **PreToolUse (Write/Edit)** : empêche la modification des migrations existantes (on ne modifie jamais une migration appliquée, on en crée une nouvelle)
- **PreToolUse (Bash)** : bloque les commandes SQL destructives (DROP TABLE, TRUNCATE, DELETE FROM audit_logs)

---

## 5. Workflow Ralph Loop — Orchestration par phases

### Principe

Ralph Loop crée une boucle autonome où Claude itère sur la même tâche jusqu'à ce que les critères de succès soient atteints. La clé : des **critères mesurables** (tests qui passent, fichiers qui existent, commandes qui retournent 0).

### Pattern optimal pour chaque phase

```
1. Le prompt Ralph Loop référence le PRD.md
2. Il définit des tâches numérotées et précises
3. Il inclut des critères de succès VÉRIFIABLES
4. Claude utilise les skills automatiquement (french-invoicing, vue-conventions, etc.)
5. Claude peut invoquer les subagents pour des tâches lourdes
6. Les hooks gardent la qualité automatiquement (lint, typecheck, migrations protégées)
7. À chaque itération, Claude voit le travail précédent via git history
8. La completion promise est émise quand TOUS les critères passent
```

### Phase 1 — Fondations

```bash
/ralph-loop "Read PRD.md completely. This is Phase 1: Foundations.

TASKS:
1. Initialize Vue 3 project: pnpm create vue@latest . -- --typescript --vue-router --pinia
2. Install dependencies: tailwind, shadcn-vue, @supabase/supabase-js, zod, vee-validate
3. Set up file structure EXACTLY as defined in PRD.md
4. Use Supabase MCP to create database schema (run all 3 migrations from PRD.md)
5. Generate TypeScript types from Supabase schema
6. Set up Supabase client (src/lib/supabase.ts)
7. Create src/lib/constants.ts with all thresholds, rates, and mentions from PRD.md
8. Implement auth: login page, register page, useAuth.ts composable, navigation guards
9. Implement AppLayout (sidebar + main area) following design-system skill
10. Implement client CRUD: useClients.ts composable + ClientGrid + ClientForm + ClientCard
11. Write unit tests for constants (prorata calculation, formatter utils)
12. Write one e2e test: register → login → create client → see client in list

Use the db-architect subagent for database tasks.
Use the ui-builder subagent for component creation.
Use context7 for Vue 3, Supabase, Tailwind, and shadcn-vue docs.

SUCCESS CRITERIA (all must pass):
- pnpm build completes without errors
- pnpm test passes all unit tests
- pnpm test:e2e passes the auth+client flow
- npx supabase gen types works
- File structure matches PRD.md
- RLS policies are in place and verified

Output <promise>PHASE1_DONE</promise> when ALL criteria pass." --max-iterations 30 --completion-promise "PHASE1_DONE"
```

### Phase 2 — Coeur métier (factures)

```bash
/ralph-loop "Read PRD.md. Phase 2: Invoice system — the core business logic.

TASKS:
1. Create Supabase Edge Function: generate-invoice-number (atomic numbering)
2. Implement useInvoices.ts composable:
   - createDraft, updateDraft, deleteDraft
   - emitInvoice (DRAFT → SENT: calls Edge Function, generates PDF, stores in Storage)
   - Verify immutability: emitted invoices cannot be modified
3. Implement InvoiceForm.vue: client select, line items, auto-totals
4. Implement InvoiceTable.vue: filterable list with status badges
5. Implement PDF generation (must pass french-invoicing skill checklist)
6. Implement usePayments.ts: record payment, mark invoice as PAID
7. Implement useLedger.ts: query only PAID invoices with payment details
8. Implement LedgerTable.vue with CSV and PDF export
9. Implement audit logging on every action

After implementation, invoke the qa-auditor subagent to run a full audit.

SUCCESS CRITERIA:
- Creating 5 invoices produces numbers FAC-2026-001 through FAC-2026-005 (no gaps)
- Attempting to update a SENT invoice returns error (RLS rejects)
- PDF contains ALL 13 mandatory mentions
- Ledger contains only paid invoices
- Audit log has entries for every create/emit/pay action
- pnpm test passes
- pnpm test:e2e passes invoice creation + immutability tests

Output <promise>PHASE2_DONE</promise> when ALL criteria pass." --max-iterations 40 --completion-promise "PHASE2_DONE"
```

### Phase 3 — Dashboard et frontend complet

```bash
/ralph-loop "Read PRD.md. Phase 3: Complete frontend with dashboard.

Use the frontend-design skill for ALL UI work. Use the ui-builder subagent for component creation.

Design direction: clean, modern, professional. DM Sans. Violet primary. Flat. Inspired by Linear.

TASKS:
1. Dashboard (pages/index.vue):
   - 4 MetricCards: CA encaissé (green), CA facturé, En attente (orange), Cotisations (red)
   - ThresholdGauges: micro ceiling (83600) + VAT franchise (37500), with prorata
   - CotisationsSummary: grid showing Urssaf 25.6%, CFP 0.2%, VFL 2.2%, net
   - RecentInvoices: last 5 invoices table
2. Invoices list (pages/invoices/index.vue): filters by status, search, actions
3. Invoice detail (pages/invoices/[id].vue): full view + payment recording
4. Quotes pages: CRUD + convert to invoice
5. Ledger page: table + export buttons
6. Settings page: profile form with all fields from PRD.md
7. All pages connected to real Supabase data via composables
8. Loading states, error states, empty states on every page
9. Toast notifications for success/error actions
10. Responsive: sidebar collapses on mobile

After implementation, invoke the qa-auditor subagent.
Then invoke the spec-reviewer subagent to check PRD alignment.

SUCCESS CRITERIA:
- All pages render without errors
- Dashboard metrics match actual data
- Threshold gauges show correct % with prorata for first year
- All CRUD operations work end-to-end
- Responsive layout works on 375px width
- pnpm build succeeds
- All tests pass

Output <promise>PHASE3_DONE</promise> when ALL criteria pass." --max-iterations 45 --completion-promise "PHASE3_DONE"
```

### Phase 4 — Polish et conformité

```bash
/ralph-loop "Read PRD.md. Phase 4: Polish, email, and compliance.

TASKS:
1. Email sending: Edge Function send-invoice-email (Resend or SMTP)
2. Automatic overdue detection: SENT invoices past due_date
3. Urssaf declaration helper: CA per period + estimated cotisations
4. Declaration reminder in sidebar
5. Dark mode toggle
6. Complete Playwright e2e test suite for ALL critical paths
7. README.md with complete setup instructions
8. Verify ALL PRD features with spec-reviewer subagent
9. Final qa-auditor run

SUCCESS CRITERIA:
- All e2e tests pass (auth, invoices, immutability, ledger, thresholds)
- Test coverage ≥ 80% on composables and utils
- README has working setup instructions (git clone → pnpm install → works)
- Dark mode works on all pages
- spec-reviewer reports 0 missing features for Phase 1-4
- qa-auditor reports 0 FAIL items

Output <promise>PHASE4_DONE</promise> when ALL criteria pass." --max-iterations 35 --completion-promise "PHASE4_DONE"
```

---

## 6. Orchestration overnight (batch)

```bash
#!/bin/bash
# overnight-facture-dev.sh
# Lance les 4 phases séquentiellement

set -e
cd /path/to/facture-dev

echo "=== Phase 1: Foundations ==="
claude -p "/ralph-loop:ralph-loop '$(cat .claude/prompts/phase1.md)' --max-iterations 30 --completion-promise 'PHASE1_DONE'"

echo "=== Phase 2: Invoice system ==="
claude -p "/ralph-loop:ralph-loop '$(cat .claude/prompts/phase2.md)' --max-iterations 40 --completion-promise 'PHASE2_DONE'"

echo "=== Phase 3: Frontend ==="
claude -p "/ralph-loop:ralph-loop '$(cat .claude/prompts/phase3.md)' --max-iterations 45 --completion-promise 'PHASE3_DONE'"

echo "=== Phase 4: Polish ==="
claude -p "/ralph-loop:ralph-loop '$(cat .claude/prompts/phase4.md)' --max-iterations 35 --completion-promise 'PHASE4_DONE'"

echo "=== All phases complete ==="
```

Pour le batch overnight, stockez chaque prompt de phase dans `.claude/prompts/phase{N}.md` séparément.

---

## 7. Récapitulatif — Quand utiliser quoi

| Besoin | Outil | Pourquoi |
|--------|-------|----------|
| Règle qui s'applique TOUJOURS | CLAUDE.md | Toujours en contexte, < 200 lignes |
| Contexte spécifique à un domaine | Skill | Chargé automatiquement quand pertinent |
| Tâche lourde / isolée | Subagent | Préserve le contexte principal |
| Tâche parallélisable | Agent Team | Plusieurs subagents en même temps |
| Action automatique déterministe | Hook | Lint, typecheck, blocage d'actions dangereuses |
| Développement autonome itératif | Ralph Loop | Boucle jusqu'à succès des critères |
| Accès à des services externes | MCP | Supabase, Figma, Context7 |
| Package réutilisable / partageable | Plugin | ralph-loop, frontend-design, context7 |

---

## 8. Setup rapide — Commandes à exécuter

```bash
# 1. Créer le projet
mkdir facture-dev && cd facture-dev && git init

# 2. Copier le PRD
cp ~/Downloads/PRD_vuejs_supabase.md ./PRD.md

# 3. Créer la structure .claude/
mkdir -p .claude/skills/{french-invoicing,vue-conventions,supabase-patterns,testing-standards,design-system}
mkdir -p .claude/agents
mkdir -p .claude/prompts

# 4. Copier ce fichier d'architecture et extraire les fichiers
# (Copier chaque section Skill/Subagent dans le bon fichier)

# 5. Installer les plugins Claude Code
# (Dans une session Claude Code)
/plugin install ralph-loop@claude-plugins-official
/plugin install frontend-design@claude-plugins-official
claude mcp add context7 -- npx -y @upstash/context7-mcp@latest

# 6. Connecter le MCP Supabase
# → Settings > Connected Apps > Supabase (dans claude.ai)

# 7. Lancer Phase 1
/ralph-loop "Read PRD.md. Phase 1..." --max-iterations 30 --completion-promise "PHASE1_DONE"
```
