-- 009_scope_overdue_to_user.sql
-- Updates mark_overdue_invoices() to accept an optional user_id parameter.
-- When called with a user_id, only marks that user's invoices as overdue.
-- This prevents one user's page load from triggering updates across all users.

create or replace function public.mark_overdue_invoices(p_user_id uuid default null)
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
    and due_date < current_date
    and (p_user_id is null or user_id = p_user_id);
end;
$$;
