-- Hotfix: Polza AI, checkout phone sync, customer order history, transfer payment review.
-- Safe for production: additive only, no data deletion.

DO $$
BEGIN
  ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'AWAITING_REVIEW';
  ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
END $$;

ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "transferPaymentEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "transferBankName" TEXT,
  ADD COLUMN IF NOT EXISTS "transferPaymentPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "transferRecipientName" TEXT,
  ADD COLUMN IF NOT EXISTS "transferPaymentCommentRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "transferPaymentInstructions" TEXT;

ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "blockReason" TEXT;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "paymentMethod" "PaymentProvider" NOT NULL DEFAULT 'CASH',
  ADD COLUMN IF NOT EXISTS "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "paymentProofUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentProofAiStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentProofAiSummary" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentProofAiConfidence" INTEGER,
  ADD COLUMN IF NOT EXISTS "paymentReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paymentReviewedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentRejectReason" TEXT;

CREATE TABLE IF NOT EXISTS "OrderAttempt" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "telegramUserId" BIGINT NOT NULL,
  "phone" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderAttempt_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OrderAttempt_businessId_fkey'
  ) THEN
    ALTER TABLE "OrderAttempt"
      ADD CONSTRAINT "OrderAttempt_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Business_transferPaymentEnabled_idx"
  ON "Business"("transferPaymentEnabled");

CREATE INDEX IF NOT EXISTS "Customer_isBlocked_idx"
  ON "Customer"("isBlocked");

CREATE INDEX IF NOT EXISTS "Order_paymentMethod_idx"
  ON "Order"("paymentMethod");

CREATE INDEX IF NOT EXISTS "Order_paymentStatus_idx"
  ON "Order"("paymentStatus");

CREATE INDEX IF NOT EXISTS "OrderAttempt_businessId_idx"
  ON "OrderAttempt"("businessId");

CREATE INDEX IF NOT EXISTS "OrderAttempt_telegramUserId_createdAt_idx"
  ON "OrderAttempt"("telegramUserId", "createdAt");

CREATE INDEX IF NOT EXISTS "OrderAttempt_phone_createdAt_idx"
  ON "OrderAttempt"("phone", "createdAt");

CREATE INDEX IF NOT EXISTS "OrderAttempt_success_createdAt_idx"
  ON "OrderAttempt"("success", "createdAt");
