Read PRD.md. Phase 3: Complete frontend + dashboard.

Use the frontend-design skill. Direction: clean, modern, professional. DM Sans. Violet #7C3AED. Flat. Linear/Vercel inspired. Use shadcn-vue.

1. Dashboard (pages/index.vue): 4 metric cards (CA encaissé green, CA facturé, En attente orange, Cotisations red) + ThresholdGauges (micro 83600 + TVA 37500, prorated first year, color by %) + CotisationsSummary (Urssaf 25.6%, CFP 0.2%, VFL 2.2%, net) + RecentInvoices table
2. Invoices list: status filter tabs, search bar, action buttons per status
3. Invoice detail page: full view + record payment
4. Quotes: CRUD + convert accepted quote to invoice
5. Client detail page: info + invoice history
6. Ledger page: table + export CSV/PDF
7. Settings page: full profile form (name, SIRET, IBAN, VAT regime, declaration freq)
8. All pages connected to real Supabase data
9. Loading spinners, error messages, empty states on every page
10. Toast notifications for actions
11. Responsive: sidebar collapses on mobile
12. Run qa-auditor + spec-reviewer subagents

SUCCESS CRITERIA:
- All pages render with real data
- Dashboard metrics are accurate
- Threshold gauges show correct % with first-year prorata
- All CRUD operations work
- Responsive at 375px
- pnpm build + all tests pass

Output <promise>PHASE3_DONE</promise> when ALL verified.
