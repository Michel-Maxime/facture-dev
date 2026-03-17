# Phase 4 — Livre de recettes, seuils et cotisations Implementation Plan

> ✅ **COMPLÉTÉE** — 2026-03-15 · commit `1e52c85`

**Goal:** Dashboard avec seuils micro-entrepreneur, cotisations URSSAF, livre de recettes exportable.

**Livraisons :**
- Composable `useThresholds.ts` — seuils 2026 (37 500 TVA, 83 600 micro), prorata 1ère année
- Composable `useCotisations.ts` — BNC SSI 25,6%, CFP, VFL, ACRE, déclaration mensuelle/trimestrielle
- Composable `useLedger.ts` — filtre par année, export CSV avec BOM UTF-8
- Page `/ledger` avec `LedgerTable`
- Composant `Gauge` — jauge de seuil avec alertes 80%/95%
- Constants `src/lib/constants.ts` — THRESHOLDS, COTISATION_RATES_2026
- Dashboard `index.vue` — 4 métriques CA, 2 jauges, cotisations, alerte compte bancaire
- Tests unitaires thresholds (9 tests), cotisations (24 tests), Gauge (11 tests)
