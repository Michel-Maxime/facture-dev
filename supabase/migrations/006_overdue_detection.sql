-- 006_overdue_detection.sql
-- Function to automatically mark SENT invoices as OVERDUE when their due_date has passed.
-- Called from the frontend before fetching invoices to ensure up-to-date statuses.
-- Uses security definer to run with elevated privileges and bypass RLS for the update.

create or replace function public.mark_overdue_invoices()
returns void
language plpgsql
security definer
as $$
begin
  update invoices
  set
    status = 'OVERDUE',
    updated_at = now()
  where
    status = 'SENT'
    and due_date < current_date;
end;
$$;
