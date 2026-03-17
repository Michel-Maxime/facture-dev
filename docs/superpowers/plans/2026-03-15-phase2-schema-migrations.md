# Phase 2 — Schéma DB et migrations Implementation Plan

> ✅ **COMPLÉTÉE** — 2026-03-15 · commit `f8ce64c`

**Goal:** Schéma PostgreSQL complet via Supabase — tables, RLS, fonctions, triggers.

**Livraisons :**
- Migration `001_initial_schema.sql` — tables profiles, clients, invoices, invoice_lines, payments, sequences
- Migration `002_rls_policies.sql` — politiques RLS (immuabilité factures émises)
- Migration `003_functions.sql` — `generate_invoice_number()` atomique avec upsert + lock
- Migration `004_handle_new_user_trigger.sql` — création automatique du profil à l'inscription
- Types TypeScript générés (`src/lib/types.ts`)
- Seed SQL pour les tests
