# Phase 5 — Devis, email et détection retards Implementation Plan

> ✅ **COMPLÉTÉE** — 2026-03-15 · commits `15fea8a`, `125be4f`, `d60adc4`

**Goal:** Gestion des devis avec conversion en facture, envoi email et détection automatique des retards.

**Livraisons :**
- Composable `useQuotes.ts` — CRUD devis, numérotation DEV-YEAR-SEQ, émission, conversion en facture
- Page `/quotes` avec tabs filtrants, recherche, actions contextuelles
- Page `/quotes/[id]` (via QuoteForm)
- Migration `008_quote_immutability_policy.sql` — immuabilité devis émis
- Edge Function `send-invoice-email` — envoi via Resend API, pièce jointe PDF
- Migration `006_overdue_detection.sql` — fonction `mark_overdue_invoices()`
- Migration `009_scope_overdue_to_user.sql` — scope par utilisateur
- Composable `useAuditLog.ts` — logs insert-only pour chaque action métier
- Migration `005_cancel_invoice_policy.sql` — politique annulation factures
- Migration `007_payment_status_policy.sql` — politique paiements
