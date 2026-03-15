# facture.dev

## Project
Self-hosted invoicing app for French micro-entrepreneurs (BNC).
Stack: Vue 3 + TypeScript + Supabase + Tailwind + shadcn-vue.

## Architecture rules
- Vue: ALWAYS use `<script setup lang="ts">` and Composition API
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

## File structure convention
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
- Coverage minimum: 80%

## Conventions
- Commits: conventional commits (feat:, fix:, chore:, test:)
- French for UI labels, English for code

## Do NOT
- Use Options API
- Put business logic in components
- Modify emitted invoices (status != DRAFT)
- Delete audit logs
- Skip type generation after schema changes
