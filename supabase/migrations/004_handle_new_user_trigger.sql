-- 004_handle_new_user_trigger.sql
-- Trigger function called when a new Supabase Auth user is created.
-- Profile data is explicitly collected and inserted by the registration form
-- with all required fields (siret, address, etc.).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Profile creation is handled by the app registration form.
  -- This function serves as the trigger entry point for future auto-provisioning.
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
