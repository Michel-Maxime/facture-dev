Read PRD.md. Phase 2: Invoice system — the core business logic.

1. Create Supabase Edge Function generate-invoice-number (atomic PostgreSQL numbering)
2. Implement useInvoices.ts: createDraft, updateDraft, deleteDraft, emitInvoice (DRAFT→SENT via Edge Function)
3. Implement InvoiceForm.vue: client select, dynamic line items, auto-calculated totals
4. Implement InvoiceTable.vue: filterable by status, searchable, status badges, PDF download
5. Implement invoice detail page with payment recording
6. Implement PDF generation containing ALL 13 mandatory French mentions (see french-invoicing skill)
7. Implement usePayments.ts: record payment with date+method, mark invoice PAID
8. Implement useLedger.ts: query ONLY paid invoices, ordered by payment date
9. Implement LedgerTable.vue with CSV and PDF export
10. Implement audit logging (insert audit_log on every create/emit/pay/cancel action)
11. Run qa-auditor subagent for full compliance check

SUCCESS CRITERIA:
- Creating 5 invoices produces FAC-2026-001 through FAC-2026-005 (no gaps)
- Attempting to update a SENT invoice is rejected (RLS)
- Generated PDF contains all 13 mandatory mentions
- Ledger shows only paid invoices
- audit_logs has entries for every action
- All unit + e2e tests pass

Output <promise>PHASE2_DONE</promise> when ALL verified.
