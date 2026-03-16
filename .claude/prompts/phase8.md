Read PRD.md and CLAUDE.md. Phase 8: UX polish, responsive design, and missing tests.

1. Make sidebar responsive:
   - On screens < 768px: collapse sidebar behind a hamburger menu
   - Use useMediaQuery from @vueuse/core (already installed)
   - Animate with CSS transitions (slide in/out)
   - Update AppLayout.vue and AppSidebar.vue

2. Add ACRE toggle to settings:
   - Add is_acre boolean field to profiles (migration 010_acre_field.sql)
   - Add toggle in settings page (fiscal section)
   - In useCotisations: when ACRE is true and company_created_at is within first year, halve the cotisation rate

3. Add bank account threshold alert:
   - On dashboard, show a banner when CA > 10000 EUR: 'Vous devez ouvrir un compte bancaire dédié'
   - Use the THRESHOLDS.dedicatedBankAccount constant

4. Add search to quotes list page (matching invoices page pattern)

5. Add declaration helper to dashboard:
   - New card showing: CA for current period, estimated cotisations due, next deadline
   - Use caPerPeriod and cotisationsPerPeriod from useCotisations

6. Write missing component tests:
   - tests/unit/components/InvoiceStatusBadge.test.ts: renders correct variant for each status
   - tests/unit/components/Gauge.test.ts: renders correct color for safe/warning/danger

7. Add empty state illustrations for all list pages (consistent pattern)

8. Add loading skeletons for all async data (verify all pages have them)

Success criteria:
- Sidebar collapses on mobile (test at 375px width)
- ACRE toggle correctly halves cotisations
- Bank account alert shows at 10k+ EUR
- Quotes page has search
- Dashboard shows declaration helper card
- All component tests pass
- No visual regressions

Output <promise>PHASE8_DONE</promise>
