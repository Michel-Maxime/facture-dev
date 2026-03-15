-- 002_rls_policies.sql

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table clients enable row level security;
alter table invoices enable row level security;
alter table invoice_lines enable row level security;
alter table payments enable row level security;
alter table quotes enable row level security;
alter table quote_lines enable row level security;
alter table audit_logs enable row level security;
alter table invoice_sequences enable row level security;
alter table quote_sequences enable row level security;

-- Profiles: users can only access their own profile
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Clients: users can only access their own clients
create policy "Users can CRUD own clients" on clients for all using (auth.uid() = user_id);

-- Invoices: users can only access their own invoices
create policy "Users can view own invoices" on invoices for select using (auth.uid() = user_id);
create policy "Users can insert own invoices" on invoices for insert with check (auth.uid() = user_id);
-- CRITICAL: only DRAFT invoices can be updated
create policy "Users can update own DRAFT invoices" on invoices for update
  using (auth.uid() = user_id AND status = 'DRAFT');
-- CRITICAL: only DRAFT invoices without a number can be deleted
create policy "Users can delete own DRAFT invoices" on invoices for delete
  using (auth.uid() = user_id AND status = 'DRAFT' AND number is null);

-- Invoice lines: access through parent invoice
create policy "Users can manage invoice lines" on invoice_lines for all
  using (exists (select 1 from invoices where invoices.id = invoice_lines.invoice_id and invoices.user_id = auth.uid()));

-- Payments
create policy "Users can manage payments" on payments for all
  using (exists (select 1 from invoices where invoices.id = payments.invoice_id and invoices.user_id = auth.uid()));

-- Quotes
create policy "Users can CRUD own quotes" on quotes for all using (auth.uid() = user_id);
create policy "Users can manage quote lines" on quote_lines for all
  using (exists (select 1 from quotes where quotes.id = quote_lines.quote_id and quotes.user_id = auth.uid()));

-- Audit logs: insert only (IMMUTABLE), read own
create policy "Users can view own audit logs" on audit_logs for select using (auth.uid() = user_id);
create policy "Users can insert audit logs" on audit_logs for insert with check (auth.uid() = user_id);
-- NO update or delete policy → audit logs are immutable

-- Sequences
create policy "Users can manage own sequences" on invoice_sequences for all using (auth.uid() = user_id);
create policy "Users can manage own quote sequences" on quote_sequences for all using (auth.uid() = user_id);
