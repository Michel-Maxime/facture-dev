Read PRD.md completely. This is Phase 1: Full project setup + auth + clients.

You are starting from an EMPTY directory (only config and docs exist). You must:

1. Initialize the full Vue 3 + TypeScript project (pnpm create vue@latest, install all deps)
2. Set up Tailwind CSS 4, shadcn-vue, Supabase client, Pinia, Vue Router, Zod, vee-validate, VueUse
3. Create the complete file structure as defined in PRD.md
4. Set up Supabase: init, create all 3 SQL migrations (schema + RLS + functions), apply them
5. Generate TypeScript types from Supabase
6. Create src/lib/constants.ts with all thresholds, rates, mentions from PRD.md
7. Create src/utils/formatters.ts (French currency, date, SIRET, IBAN formatters)
8. Create src/utils/validators.ts (Zod schemas for all forms)
9. Implement Supabase Auth: useAuth.ts composable, login/register pages, navigation guards
10. Build AppLayout: sidebar (220px, nav items, declaration reminder) + main area
11. Implement client CRUD: useClients.ts composable + ClientGrid + ClientForm + ClientCard pages
12. Write unit tests for constants (prorata), formatters, validators
13. Write 1 e2e test: register → login → create client → see in list
14. Set up vitest.config.ts and playwright.config.ts
15. Create .gitignore, .env.example, README.md

Use db-architect subagent for Supabase setup.
Use ui-builder subagent for components.
Use context7 for up-to-date docs (Vue 3, Supabase, Tailwind, shadcn-vue).

SUCCESS CRITERIA (verify ALL before completing):
- pnpm dev starts without errors
- pnpm build completes successfully
- pnpm test passes all unit tests
- Supabase tables exist with RLS policies
- Auth flow works end-to-end
- Client CRUD works end-to-end
- File structure matches PRD.md conventions

Output <promise>PHASE1_DONE</promise> when ALL criteria are verified.
