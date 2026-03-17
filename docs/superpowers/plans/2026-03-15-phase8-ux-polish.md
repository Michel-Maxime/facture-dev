# Phase 8 — UX polish et responsive Implementation Plan

> ✅ **COMPLÉTÉE** — 2026-03-15 · commit `7ea8828`

**Goal:** Peaufinage UX global — sidebar responsive, toggle ACRE, composants de test, états vides et skeletons.

**Livraisons :**
- Sidebar responsive avec overlay mobile et auto-close à la navigation (`AppLayout.vue`)
- Bouton hamburger dans `AppHeader.vue` pour ouvrir/fermer la sidebar sur mobile
- Store UI `stores/ui.ts` — état `sidebarOpen`
- Toggle ACRE dans `settings.vue` — switch on/off exonération cotisations
- Migration `011_acre_field.sql` — champ `is_acre` dans `profiles`
- États vides sur toutes les listes (factures, devis, clients, avoirs)
- Skeletons de chargement (animate-pulse)
- Tests composants `InvoiceStatusBadge.test.ts` (9 tests), `Gauge.test.ts` (11 tests)
- Tests composables `useCotisations.composable.test.ts` (24 tests), `useThresholds.composable.test.ts` (9 tests)
