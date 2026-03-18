-- Migration 014: add facturx_enabled to profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS facturx_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.facturx_enabled IS
  'When true, generated PDFs include an embedded Factur-X MINIMUM XML (PDF/A-3)';
