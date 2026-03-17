-- 010_credit_notes.sql
-- Adds credit notes (avoirs) tables, sequences, RLS policies, and numbering function.
-- Credit notes allow correcting emitted invoices.
-- After a credit note is emitted, the original invoice is marked as CANCELLED.

-- Credit note sequences (atomic numbering per user per year)
create table credit_note_sequences (
  user_id uuid references profiles(id) on delete cascade,
  year int not null,
  last_number int default 0,
  primary key (user_id, year)
);

-- Credit notes
create table credit_notes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  original_invoice_id uuid references invoices(id) not null,
  number text unique,                    -- AV-2026-001 (null while DRAFT)
  issue_date date not null,
  subtotal numeric(10,2) not null,
  vat_rate numeric(5,3) default 0,
  vat_amount numeric(10,2) default 0,
  total numeric(10,2) not null,
  status text default 'DRAFT' check (status in ('DRAFT', 'SENT')),
  reason text,
  pdf_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Credit note lines (mirrors invoice_lines)
create table credit_note_lines (
  id uuid default uuid_generate_v4() primary key,
  credit_note_id uuid references credit_notes(id) on delete cascade not null,
  description text not null,
  quantity numeric(10,2) not null,
  unit_price numeric(10,2) not null,
  amount numeric(10,2) not null,
  sort_order int default 0
);

-- Indexes
create index idx_credit_notes_user on credit_notes(user_id);
create index idx_credit_notes_invoice on credit_notes(original_invoice_id);

-- Enable RLS
alter table credit_note_sequences enable row level security;
alter table credit_notes enable row level security;
alter table credit_note_lines enable row level security;

-- RLS policies for credit_note_sequences
create policy "Users can manage own credit note sequences" on credit_note_sequences
  for all using (auth.uid() = user_id);

-- RLS policies for credit_notes
create policy "Users can view own credit notes" on credit_notes
  for select using (auth.uid() = user_id);

create policy "Users can insert own credit notes" on credit_notes
  for insert with check (auth.uid() = user_id);

-- Only DRAFT credit notes can be updated
create policy "Users can update own DRAFT credit notes" on credit_notes
  for update using (auth.uid() = user_id AND status = 'DRAFT');

-- Only DRAFT credit notes can be deleted
create policy "Users can delete own DRAFT credit notes" on credit_notes
  for delete using (auth.uid() = user_id AND status = 'DRAFT');

-- RLS policies for credit_note_lines
create policy "Users can manage credit note lines" on credit_note_lines
  for all using (
    exists (
      select 1 from credit_notes
      where credit_notes.id = credit_note_lines.credit_note_id
      and credit_notes.user_id = auth.uid()
    )
  );

-- Atomic credit note number generation
create or replace function generate_credit_note_number(p_user_id uuid, p_year int)
returns table(seq_number int, credit_note_number text)
language plpgsql
security definer
as $$
declare
  v_seq int;
begin
  insert into credit_note_sequences (user_id, year, last_number)
  values (p_user_id, p_year, 1)
  on conflict (user_id, year)
  do update set last_number = credit_note_sequences.last_number + 1
  returning last_number into v_seq;

  return query select v_seq, 'AV-' || p_year::text || '-' || lpad(v_seq::text, 3, '0');
end;
$$;
