-- 007_payment_status_policy.sql
-- Adds a RLS policy allowing users to mark their own SENT or OVERDUE invoices as PAID.
-- The existing update policy only allows updating DRAFT invoices.
-- The cancel policy (005) allows SENT/OVERDUE → CANCELLED.
-- This policy allows SENT/OVERDUE → PAID for payment recording.
-- USING checks the old row (must be SENT or OVERDUE and owned by the user).
-- WITH CHECK enforces that the new status must be PAID.

create policy "Users can mark own SENT or OVERDUE invoices as PAID" on invoices for update
  using (auth.uid() = user_id AND status IN ('SENT', 'OVERDUE'))
  with check (auth.uid() = user_id AND status = 'PAID');
