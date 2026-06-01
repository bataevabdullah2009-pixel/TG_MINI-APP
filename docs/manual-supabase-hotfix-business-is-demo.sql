-- Manual Supabase hotfix for production schema drift.
-- Run this in Supabase SQL Editor. It is idempotent and does not delete data.

ALTER TABLE public."Business"
  ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;

UPDATE public."Business"
SET "isDemo" = true
WHERE "slug" LIKE 'demo-%'
   OR "name" ILIKE 'Демо%';

CREATE INDEX IF NOT EXISTS "Business_isDemo_idx"
  ON public."Business" ("isDemo");
