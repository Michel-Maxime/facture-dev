# Phase 7 — Avoirs, édition brouillons et duplication Implementation Plan

> ✅ **COMPLÉTÉE** — 2026-03-15 · commit `7498262`

**Goal:** Avoirs (notes de crédit) conformes, édition complète des brouillons et duplication de factures.

**Livraisons :**
- Migration `010_credit_notes.sql` — tables `credit_notes`, `credit_note_lines`, `credit_note_sequences`, RLS
- Composable `useCreditNotes.ts` — création depuis facture émise, numérotation AV-YEAR-SEQ, émission
- Pages `/credit-notes`, `/credit-notes/[id]`
- `updateInvoiceFull` dans `useInvoices` — remplacement complet header + lignes d'un brouillon
- Page `/invoices/edit` — formulaire édition brouillon
- `duplicateInvoice` dans `useInvoices` — copie facture existante en brouillon avec dates du jour
- Bouton "Dupliquer" sur la page détail facture
- Tests unitaires `useCreditNotes.test.ts`
