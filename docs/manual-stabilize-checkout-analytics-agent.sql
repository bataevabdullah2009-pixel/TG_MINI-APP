-- Vitrina AI checkout, analytics and Telegram agent stabilization.
-- Apply in Supabase SQL Editor before the production deploy.
-- Run after docs/production-stability.sql and docs/manual-commercial-readiness.sql
-- if those patches have not already been applied.
-- Safe to run repeatedly. Additive only: no DROP and no order deletion.

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'AWAITING_REVIEW';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_REJECTED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "lastBusinessId" TEXT;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "itemsSubtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "promoCode" TEXT,
  ADD COLUMN IF NOT EXISTS "promoDiscountPercent" INTEGER,
  ADD COLUMN IF NOT EXISTS "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paymentProofFileName" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentProofMimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "stockRestoredAt" TIMESTAMP(3);

ALTER TABLE "DeliveryZone"
  ADD COLUMN IF NOT EXISTS "minOrderAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "TelegramChatContext" (
  "telegramUserId" BIGINT NOT NULL,
  "businessId" TEXT,
  "lastProductQuery" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelegramChatContext_pkey" PRIMARY KEY ("telegramUserId")
);

ALTER TABLE "TelegramChatContext"
  ADD COLUMN IF NOT EXISTS "businessId" TEXT,
  ADD COLUMN IF NOT EXISTS "lastProductQuery" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TelegramChatContext_businessId_fkey'
  ) THEN
    ALTER TABLE "TelegramChatContext"
      ADD CONSTRAINT "TelegramChatContext_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- Preserve historical orders while making the technical key unique.
WITH ranked_keys AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "businessId", "customerId", "idempotencyKey"
      ORDER BY "createdAt", "id"
    ) AS row_number
  FROM "Order"
  WHERE "idempotencyKey" IS NOT NULL
)
UPDATE "Order" AS orders
SET "idempotencyKey" = NULL
FROM ranked_keys
WHERE orders."id" = ranked_keys."id"
  AND ranked_keys.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_businessId_customerId_idempotencyKey_key"
  ON "Order" ("businessId", "customerId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "Order_businessId_idx"
  ON "Order" ("businessId");
CREATE INDEX IF NOT EXISTS "Order_customerId_idx"
  ON "Order" ("customerId");
CREATE INDEX IF NOT EXISTS "Order_status_idx"
  ON "Order" ("status");
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx"
  ON "Order" ("createdAt");
CREATE INDEX IF NOT EXISTS "Order_businessId_createdAt_idx"
  ON "Order" ("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_businessId_status_createdAt_idx"
  ON "Order" ("businessId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx"
  ON "OrderItem" ("orderId");
CREATE INDEX IF NOT EXISTS "Item_businessId_idx"
  ON "Item" ("businessId");
CREATE INDEX IF NOT EXISTS "Item_businessId_isAvailable_archivedAt_idx"
  ON "Item" ("businessId", "isAvailable", "archivedAt");
CREATE INDEX IF NOT EXISTS "DeliveryZone_businessId_idx"
  ON "DeliveryZone" ("businessId");
CREATE INDEX IF NOT EXISTS "FavoriteBusiness_telegramUserId_idx"
  ON "FavoriteBusiness" ("telegramUserId");
CREATE INDEX IF NOT EXISTS "FavoriteItem_telegramUserId_idx"
  ON "FavoriteItem" ("telegramUserId");
CREATE INDEX IF NOT EXISTS "User_lastBusinessId_idx"
  ON "User" ("lastBusinessId");
CREATE INDEX IF NOT EXISTS "TelegramChatContext_businessId_idx"
  ON "TelegramChatContext" ("businessId");

-- Old receipt-AI metadata is retained for compatibility, but no longer drives checkout.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Order'
      AND column_name = 'paymentProofAiStatus'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Order'
      AND column_name = 'paymentReviewedAt'
  ) THEN
    UPDATE "Order"
    SET "paymentProofAiStatus" = 'MANUAL_REVIEW'
    WHERE "paymentProofAiStatus" IN ('PENDING', 'AI_CHECKING')
      AND "paymentReviewedAt" IS NULL;
  END IF;
END
$$;

ALTER TABLE "TelegramChatContext" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'TelegramChatContext'
      AND policyname = 'service_role_full_access_telegram_chat_context'
  ) THEN
    CREATE POLICY "service_role_full_access_telegram_chat_context"
      ON public."TelegramChatContext"
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
