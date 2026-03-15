-- 005_cancel_invoice_policy.sql
-- Adds a RLS policy allowing users to cancel their own SENT or OVERDUE invoices.
-- The existing update policy only allows updating DRAFT invoices, but cancellation
-- must be possible for SENT and OVERDUE invoices too.
-- USING checks the old row (must be SENT or OVERDUE).
-- WITH CHECK enforces that the new status must be CANCELLED (no other field changes allowed via this policy).

create policy "Users can cancel own SENT invoices" on invoices for update
  using (auth.uid() = user_id AND status IN ('SENT', 'OVERDUE'))
  with check (auth.uid() = user_id AND status = 'CANCELLED');
