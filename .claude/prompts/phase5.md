Read PRD.md and CLAUDE.md. Phase 5: Critical fixes and RLS hardening.

1. Create migration 007_payment_status_policy.sql: add RLS policy allowing SENT or OVERDUE invoices to be updated to PAID status (user_id = auth.uid(), old status IN ('SENT', 'OVERDUE'), new status = 'PAID'). Test that recordPayment() works end-to-end.

2. Create migration 008_quote_immutability_policy.sql: replace the 'for all' quotes policy with separate SELECT/INSERT/UPDATE/DELETE policies. UPDATE must require status = 'DRAFT' (matching the invoice pattern). Verify useQuotes composable still works.

3. Fix useCotisations.ts declaration deadlines: quarterly Urssaf deadlines are April 30, July 31, October 31, January 31 (not the 15th of March/June/September/December). Monthly deadlines are the last day of the following month. Update computeNextDeclarationDate().

4. Scope mark_overdue_invoices() to accept a user_id parameter instead of updating all users. Update the call in useInvoices.ts to pass authStore.user.id.

5. Extract the duplicated logAction() from useInvoices.ts, useClients.ts, and useQuotes.ts into a shared useAuditLog.ts composable.

6. Update existing unit tests and add new tests:
   - Test that SENT invoices CAN be marked PAID via RLS
   - Test that SENT quotes CANNOT be updated via RLS
   - Test correct Urssaf deadline dates (quarterly: Apr 30, Jul 31, Oct 31, Jan 31)

Success criteria:
- All RLS policies pass integration tests
- Urssaf deadlines display correct dates
- No duplicated logAction code
- All existing tests still pass

Output <promise>PHASE5_DONE</promise>
