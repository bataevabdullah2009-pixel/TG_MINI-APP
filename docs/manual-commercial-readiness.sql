-- Commercial readiness patch for Vitrina AI.
-- Safe to run repeatedly in Supabase SQL Editor. It does not delete production data.

DO $$
BEGIN
  CREATE TYPE "StockMode" AS ENUM ('SIMPLE_AVAILABILITY', 'TRACK_STOCK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "Item"
  ADD COLUMN IF NOT EXISTS "stockMode" "StockMode" NOT NULL DEFAULT 'SIMPLE_AVAILABILITY',
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

UPDATE "Item"
SET "stockMode" = 'TRACK_STOCK'
WHERE "stock" IS NOT NULL
  AND "stockMode" = 'SIMPLE_AVAILABILITY';

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentProofAiDetails" TEXT,
  ADD COLUMN IF NOT EXISTS "promoCode" TEXT,
  ADD COLUMN IF NOT EXISTS "promoDiscountPercent" INTEGER,
  ADD COLUMN IF NOT EXISTS "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "PromoCode" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "discountPercent" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "usageLimit" INTEGER,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoCode_businessId_fkey') THEN
    ALTER TABLE "PromoCode"
      ADD CONSTRAINT "PromoCode_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_businessId_customerId_idempotencyKey_key"
  ON "Order" ("businessId", "customerId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "Order_businessId_createdAt_idx"
  ON "Order" ("businessId", "createdAt");

CREATE INDEX IF NOT EXISTS "Order_customerId_createdAt_idx"
  ON "Order" ("customerId", "createdAt");

CREATE INDEX IF NOT EXISTS "Item_businessId_isAvailable_archivedAt_idx"
  ON "Item" ("businessId", "isAvailable", "archivedAt");

CREATE INDEX IF NOT EXISTS "Item_businessId_categoryId_idx"
  ON "Item" ("businessId", "categoryId");

CREATE INDEX IF NOT EXISTS "DeliveryAssignment_courierId_status_idx"
  ON "DeliveryAssignment" ("courierId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "PromoCode_businessId_code_key"
  ON "PromoCode" ("businessId", "code");

CREATE INDEX IF NOT EXISTS "PromoCode_businessId_isActive_archivedAt_idx"
  ON "PromoCode" ("businessId", "isActive", "archivedAt");
