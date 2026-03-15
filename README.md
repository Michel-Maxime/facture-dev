# facture.dev

Application de facturation pour micro-entrepreneurs français (BNC). Self-hosted via Supabase.

## Stack

- **Frontend**: Vue 3 + TypeScript + Tailwind CSS + shadcn-vue + Pinia
- **Backend**: Supabase (Auth, PostgreSQL + RLS, Edge Functions)
- **Tests**: Vitest (unit) + Playwright (e2e)

## Prérequis

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Compte [Supabase](https://supabase.com) (gratuit)

## Installation

### 1. Cloner le projet

```bash
git clone https://github.com/your-username/facture-dev.git
cd facture-dev
pnpm install
```

### 2. Configurer Supabase

Créez un projet sur [supabase.com](https://supabase.com), puis récupérez :
- **Project URL** (Settings > API > Project URL)
- **Anon key** (Settings > API > Project API keys)

Créez le fichier `.env.local` :

```bash
cp .env.example .env.local
```

Remplissez les variables :

```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-anon-key
```

### 3. Appliquer les migrations SQL

Dans le dashboard Supabase > SQL Editor, exécutez dans l'ordre :

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/migrations/003_functions.sql`
4. `supabase/migrations/004_handle_new_user_trigger.sql`
5. `supabase/migrations/005_cancel_invoice_policy.sql`
6. `supabase/migrations/006_overdue_detection.sql`

### 4. Déployer les Edge Functions

Installez la CLI Supabase :

```bash
npm install -g supabase
supabase login
supabase link --project-ref votre-project-ref
```

Déployez les fonctions :

```bash
supabase functions deploy generate-invoice-number --no-verify-jwt
supabase functions deploy send-invoice-email --no-verify-jwt
```

Pour l'envoi d'emails, configurez la variable `RESEND_API_KEY` dans Supabase > Edge Functions > Secrets.

### 5. Lancer l'application

```bash
pnpm dev
```

Ouvrez [http://localhost:5173](http://localhost:5173).

## Tests

```bash
# Tests unitaires
pnpm test

# Tests unitaires avec couverture
npx vitest run --coverage

# Tests end-to-end (nécessite pnpm dev en cours)
pnpm test:e2e
```

## Structure du projet

```
src/
├── composables/     # Logique métier (useInvoices, useClients, etc.)
├── components/
│   ├── ui/          # Composants atomiques (Button, Input, Modal…)
│   ├── layout/      # AppSidebar, AppHeader, AppLayout
│   ├── invoices/    # InvoiceForm, InvoiceStatusBadge
│   ├── quotes/      # QuoteForm
│   ├── clients/     # ClientForm, ClientCard
│   └── ledger/      # LedgerTable
├── pages/           # Routes (file-based routing)
├── stores/          # Pinia (auth, ui, notifications)
├── lib/             # Supabase client, types, constants
└── utils/           # formatters, validators, pdf-template
supabase/
├── migrations/      # Migrations SQL versionnées
└── functions/       # Edge Functions (Deno)
tests/
├── unit/            # Vitest
└── e2e/             # Playwright
```

## Fonctionnalités

- **Factures** : Création, émission (DRAFT → SENT), paiement, annulation
- **Numérotation séquentielle** : FAC-YYYY-NNN (atomique, sans trou, côté serveur)
- **Devis** : CRUD complet, conversion en facture
- **Clients** : CRUD, historique de facturation
- **Livre de recettes** : Paiements reçus uniquement, export CSV
- **Tableau de bord** : CA encaissé, facturé, en attente, jauges seuils
- **Seuils 2026** : Micro 83 600 €, franchise TVA 37 500 € — proratisés en 1ère année
- **Alertes** : Orange à 80%, Rouge à 95% des seuils
- **PDF** : 13 mentions légales obligatoires (Art. 293 B CGI, indemnité 40 €, pénalités)
- **Mode sombre** : Toggle dans l'en-tête, persisté en localStorage
- **Email** : Envoi de factures via Edge Function + Resend

## Règles métier importantes

- Les factures émises (status ≠ DRAFT) sont **immutables** (RLS enforced au niveau DB)
- Le numéro de facture est attribué au moment de l'émission, jamais à la création
- Les logs d'audit sont **insert only** (jamais modifiés ni supprimés)
- Le livre de recettes ne contient que les factures avec status = PAID

## Variables d'environnement

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé publique Supabase |

Pour les Edge Functions (Supabase Secrets) :

| Secret | Description |
|---|---|
| `RESEND_API_KEY` | Clé API Resend pour l'envoi d'emails |

## Licence

MIT
