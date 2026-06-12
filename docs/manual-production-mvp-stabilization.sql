-- Production MVP stabilization patch for Vitrina AI.
-- Safe to run repeatedly in Supabase SQL Editor.
-- Additive only: no DROP and no production data deletion.
-- Apply after docs/manual-commercial-readiness.sql.

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "stockRestoredAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "TelegramChatContext" (
  "telegramUserId" BIGINT NOT NULL,
  "businessId" TEXT,
  "lastProductQuery" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelegramChatContext_pkey" PRIMARY KEY ("telegramUserId")
);

ALTER TABLE "TelegramChatContext"
  ADD COLUMN IF NOT EXISTS "lastProductQuery" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TelegramChatContext_businessId_fkey'
  ) THEN
    ALTER TABLE "TelegramChatContext"
      ADD CONSTRAINT "TelegramChatContext_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "TelegramChatContext_businessId_idx"
  ON "TelegramChatContext" ("businessId");

CREATE INDEX IF NOT EXISTS "Order_businessId_status_createdAt_idx"
  ON "Order" ("businessId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "Order_businessId_createdAt_idx"
  ON "Order" ("businessId", "createdAt");

CREATE INDEX IF NOT EXISTS "Order_customerId_createdAt_idx"
  ON "Order" ("customerId", "createdAt");

CREATE INDEX IF NOT EXISTS "Order_status_idx"
  ON "Order" ("status");

CREATE INDEX IF NOT EXISTS "Business_slug_idx"
  ON "Business" ("slug");

CREATE INDEX IF NOT EXISTS "Customer_telegramUserId_idx"
  ON "Customer" ("telegramUserId");

CREATE INDEX IF NOT EXISTS "Customer_businessId_createdAt_idx"
  ON "Customer" ("businessId", "createdAt");

CREATE INDEX IF NOT EXISTS "Item_businessId_isAvailable_archivedAt_idx"
  ON "Item" ("businessId", "isAvailable", "archivedAt");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Order'
      AND column_name = 'paymentProofAiStatus'
  ) THEN
    UPDATE "Order"
    SET
      "paymentProofAiStatus" = 'MANUAL_REVIEW',
      "paymentProofAiSummary" = COALESCE(
        "paymentProofAiSummary",
        'Проверка заняла больше 30 секунд. Нужна ручная проверка.'
      )
    WHERE "paymentProofAiStatus" IN ('PENDING', 'AI_CHECKING')
      AND "createdAt" < CURRENT_TIMESTAMP - INTERVAL '30 seconds'
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
