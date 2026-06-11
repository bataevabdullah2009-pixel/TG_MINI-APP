-- Vitrina AI commercial MVP, stock and archive lifecycle patch.
-- Safe to run repeatedly in Supabase SQL Editor.
-- Additive only: no destructive DDL, production data deletion, or database reset.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BusinessAccessStatus') THEN
    CREATE TYPE "BusinessAccessStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'ARCHIVED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlanType') THEN
    CREATE TYPE "PlanType" AS ENUM ('LIFETIME');
  END IF;
END $$;

ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "accessStatus" "BusinessAccessStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "planType" "PlanType" NOT NULL DEFAULT 'LIFETIME',
  ADD COLUMN IF NOT EXISTS "paidAmount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "blockedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

UPDATE "Business"
SET
  "accessStatus" = CASE
    WHEN "subscriptionStatus" = 'BLOCKED' THEN 'BLOCKED'::"BusinessAccessStatus"
    WHEN "isActive" = false THEN 'ARCHIVED'::"BusinessAccessStatus"
    ELSE 'ACTIVE'::"BusinessAccessStatus"
  END,
  "planType" = 'LIFETIME'::"PlanType"
WHERE "accessStatus" = 'ACTIVE'::"BusinessAccessStatus";

ALTER TABLE "Item"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

ALTER TABLE "DeliveryZone"
  ADD COLUMN IF NOT EXISTS "minOrderAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "stockRestoredAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Business_accessStatus_idx" ON "Business" ("accessStatus");
CREATE INDEX IF NOT EXISTS "Business_archivedAt_idx" ON "Business" ("archivedAt");
CREATE INDEX IF NOT EXISTS "Item_businessId_archivedAt_idx" ON "Item" ("businessId", "archivedAt");
CREATE INDEX IF NOT EXISTS "Item_businessId_isAvailable_archivedAt_idx" ON "Item" ("businessId", "isAvailable", "archivedAt");
CREATE INDEX IF NOT EXISTS "DeliveryZone_businessId_archivedAt_idx" ON "DeliveryZone" ("businessId", "archivedAt");
CREATE INDEX IF NOT EXISTS "Order_stockRestoredAt_idx" ON "Order" ("stockRestoredAt");
