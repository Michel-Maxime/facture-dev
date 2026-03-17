# Phase 3 — Factures et clients Implementation Plan

> ✅ **COMPLÉTÉE** — 2026-03-15 · commit `fb082da`

**Goal:** CRUD complet clients et factures avec émission, numérotation séquentielle et PDF côté client.

**Livraisons :**
- Composable `useClients.ts` — CRUD clients (PRO/INDIVIDUAL, SIRET conditionnel)
- Composable `useInvoices.ts` — création, édition, suppression brouillons, émission
- Pages `/clients`, `/clients/[id]`, `/invoices`, `/invoices/[id]`, `/invoices/new`, `/invoices/edit`
- Composants `ClientCard`, `ClientForm`, `ClientGrid`, `InvoiceForm`, `InvoiceStatusBadge`
- Utilitaire PDF client-side `pdf-template.ts` avec 13 mentions légales
- Composable `usePdf.ts` — téléchargement PDF
- Validators Zod pour clients et factures
- Tests unitaires mentions PDF (22 tests)
