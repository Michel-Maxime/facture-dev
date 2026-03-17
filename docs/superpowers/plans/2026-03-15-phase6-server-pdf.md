# Phase 6 — Génération PDF serveur Implementation Plan

> ✅ **COMPLÉTÉE** — 2026-03-15 · commits `5af7e5e`, `2aca8ac` (PR #1)

**Goal:** Génération PDF côté serveur via Edge Function Supabase, stockage dans Supabase Storage, téléchargement sécurisé.

**Livraisons :**
- Edge Function `generate-pdf` — génération avec pdf-lib (Helvetica, A4), stockage bucket `invoices`
- Edge Function `generate-invoice-number` — attribution numéro atomique + déclenchement PDF
- Bucket Supabase Storage `invoices` avec RLS par utilisateur
- Mise à jour `pdf_url` dans la table `invoices` après génération
- `usePdf.downloadStoredPdf` — téléchargement depuis Storage via URL signée
- Correction auth/CORS sur les Edge Functions
- Tests unitaires `usePdf.test.ts` (10 tests)
