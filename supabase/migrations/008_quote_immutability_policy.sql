-- 008_quote_immutability_policy.sql
-- Replaces the permissive 'for all' quotes policy with granular policies.
-- UPDATE is now restricted to DRAFT quotes only, matching the invoice pattern.

-- Drop the old permissive 'for all' policy
drop policy if exists "Users can CRUD own quotes" on quotes;

-- SELECT: can view all own quotes regardless of status
create policy "Users can view own quotes" on quotes for select
  using (auth.uid() = user_id);

-- INSERT: can insert quotes for themselves
create policy "Users can insert own quotes" on quotes for insert
  with check (auth.uid() = user_id);

-- UPDATE: CRITICAL — only DRAFT quotes can be updated
create policy "Users can update own DRAFT quotes" on quotes for update
  using (auth.uid() = user_id AND status = 'DRAFT');

-- Emit quote: allow DRAFT → SENT transition
create policy "Users can emit own DRAFT quotes" on quotes for update
  using (auth.uid() = user_id AND status = 'DRAFT')
  with check (auth.uid() = user_id AND status = 'SENT');

-- Convert quote: allow SENT/ACCEPTED status updates (convert to invoice sets ACCEPTED)
create policy "Users can accept own SENT quotes" on quotes for update
  using (auth.uid() = user_id AND status IN ('SENT', 'ACCEPTED'))
  with check (auth.uid() = user_id AND status IN ('SENT', 'ACCEPTED'));

-- DELETE: only DRAFT quotes can be deleted
create policy "Users can delete own DRAFT quotes" on quotes for delete
  using (auth.uid() = user_id AND status = 'DRAFT');
