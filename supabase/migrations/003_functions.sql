-- 003_functions.sql

-- Atomic invoice number generation (called from Edge Function)
create or replace function generate_invoice_number(p_user_id uuid, p_year int)
returns table(seq_number int, invoice_number text)
language plpgsql
security definer
as $$
declare
  v_seq int;
begin
  -- Upsert sequence with lock
  insert into invoice_sequences (user_id, year, last_number)
  values (p_user_id, p_year, 1)
  on conflict (user_id, year)
  do update set last_number = invoice_sequences.last_number + 1
  returning last_number into v_seq;

  return query select v_seq, 'FAC-' || p_year::text || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

-- Similar for quotes
create or replace function generate_quote_number(p_user_id uuid, p_year int)
returns table(seq_number int, quote_number text)
language plpgsql
security definer
as $$
declare
  v_seq int;
begin
  insert into quote_sequences (user_id, year, last_number)
  values (p_user_id, p_year, 1)
  on conflict (user_id, year)
  do update set last_number = quote_sequences.last_number + 1
  returning last_number into v_seq;

  return query select v_seq, 'DEV-' || p_year::text || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

-- Dashboard stats view
create or replace view dashboard_stats as
select
  user_id,
  sum(case when status = 'PAID' then total else 0 end) as ca_encaisse,
  sum(total) as ca_facture,
  sum(case when status = 'SENT' then total else 0 end) as en_attente,
  count(case when status = 'SENT' then 1 end) as nb_en_attente,
  count(case when status = 'PAID' then 1 end) as nb_payees,
  count(*) as nb_total
from invoices
where extract(year from issue_date) = extract(year from current_date)
group by user_id;
