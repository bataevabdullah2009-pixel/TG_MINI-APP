-- Manual Supabase patch for Business.isOpen.
-- Safe to run multiple times in Supabase SQL Editor.
-- Do not reset the database and do not drop tables.

ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "isOpen" BOOLEAN NOT NULL DEFAULT true;
