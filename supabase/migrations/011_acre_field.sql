-- 011_acre_field.sql
-- Adds is_acre boolean field to profiles.
-- ACRE (Aide à la Création ou Reprise d'une Entreprise) halves cotisation rates
-- for eligible micro-entrepreneurs in their first year of activity.

alter table profiles add column if not exists is_acre boolean default false;
