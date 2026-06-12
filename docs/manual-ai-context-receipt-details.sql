-- Vitrina AI: persist the last explicitly opened business and structured receipt analysis.
-- Safe to run repeatedly. Existing users and orders remain unchanged.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "lastBusinessId" TEXT;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "paymentProofAiResult" JSONB;

CREATE INDEX IF NOT EXISTS "User_lastBusinessId_idx"
  ON "User" ("lastBusinessId");
