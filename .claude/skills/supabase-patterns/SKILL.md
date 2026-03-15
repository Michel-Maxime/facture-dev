---
name: supabase-patterns
description: Supabase patterns, RLS, Edge Functions. Auto-invoked for DB work.
---
# Supabase patterns
- Auth: email+password, profile in public.profiles extending auth.users
- RLS on ALL tables. user_id = auth.uid(). Invoice UPDATE only for DRAFT. audit_logs INSERT only.
- Edge Functions (Deno): generate-invoice-number (atomic), generate-pdf, send-email
- After schema change: `npx supabase gen types typescript --local > src/lib/types.ts`
