-- Manual Supabase hotfix for Business.isDemo schema drift.
-- Safe to run multiple times in Supabase SQL Editor.
-- Do not reset the database and do not drop tables.

ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Business"
SET "isDemo" = true
WHERE "slug" IN (
  'demo-cafe',
  'demo-barber',
  'demo-shop',
  'demo-grocery',
  'demo-carwash',
  'demo-hozmag'
);

CREATE INDEX IF NOT EXISTS "Business_isDemo_idx"
  ON "Business" ("isDemo");
