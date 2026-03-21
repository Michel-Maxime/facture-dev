-- Migration 015: ACRE reform (LSFSS 2026)
-- After July 1st 2026, ACRE access is restricted to specific eligible populations
-- and the reduction rate drops from 50% to 25%.
-- This field tracks whether the user belongs to an eligible population
-- (only relevant for companies created on or after 2026-07-01).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS acre_public_eligible BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.acre_public_eligible IS
  'ACRE reform (July 2026): true if the user belongs to an eligible population for ACRE (demandeurs emploi, RSA, QPV/ZRR, 18-26 ans, etc.). Only relevant when company_created_at >= 2026-07-01.';
