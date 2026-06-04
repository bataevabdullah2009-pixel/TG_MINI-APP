-- Production stabilization patch for Vitrina AI.
-- Safe to run multiple times in Supabase SQL Editor.
-- Additive only: no DROP TABLE, no data deletion, no database reset.

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'AWAITING_REVIEW';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "telegramId" BIGINT,
  ADD COLUMN IF NOT EXISTS "username" TEXT,
  ADD COLUMN IF NOT EXISTS "telegramLinkCode" TEXT,
  ADD COLUMN IF NOT EXISTS "telegramLinkExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "businessId" TEXT,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "isOpen" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "transferPaymentEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "transferBankName" TEXT,
  ADD COLUMN IF NOT EXISTS "transferPaymentPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "transferRecipientName" TEXT,
  ADD COLUMN IF NOT EXISTS "transferPaymentCommentRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "transferPaymentInstructions" TEXT;

ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "verificationMethod" TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "totalOrders" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "bonusBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
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
  ADD COLUMN IF NOT EXISTS "paymentRejectReason" TEXT,
  ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expireReason" TEXT;

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expireReason" TEXT;

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
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderAttempt_businessId_fkey') THEN
    ALTER TABLE "OrderAttempt"
      ADD CONSTRAINT "OrderAttempt_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Business_isDemo_idx" ON "Business" ("isDemo");
CREATE INDEX IF NOT EXISTS "Business_transferPaymentEnabled_idx" ON "Business" ("transferPaymentEnabled");
CREATE UNIQUE INDEX IF NOT EXISTS "User_telegramId_key" ON "User" ("telegramId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_telegramLinkCode_key" ON "User" ("telegramLinkCode");
CREATE INDEX IF NOT EXISTS "User_businessId_idx" ON "User" ("businessId");
CREATE INDEX IF NOT EXISTS "User_telegramId_idx" ON "User" ("telegramId");
CREATE INDEX IF NOT EXISTS "Customer_userId_idx" ON "Customer" ("userId");
CREATE INDEX IF NOT EXISTS "Customer_isBlocked_idx" ON "Customer" ("isBlocked");
CREATE INDEX IF NOT EXISTS "Order_paymentMethod_idx" ON "Order" ("paymentMethod");
CREATE INDEX IF NOT EXISTS "Order_paymentStatus_idx" ON "Order" ("paymentStatus");
CREATE INDEX IF NOT EXISTS "Order_deliveryType_status_createdAt_idx" ON "Order" ("deliveryType", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Booking_status_startTime_idx" ON "Booking" ("status", "startTime");
CREATE INDEX IF NOT EXISTS "OrderAttempt_businessId_idx" ON "OrderAttempt" ("businessId");
CREATE INDEX IF NOT EXISTS "OrderAttempt_telegramUserId_createdAt_idx" ON "OrderAttempt" ("telegramUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderAttempt_phone_createdAt_idx" ON "OrderAttempt" ("phone", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderAttempt_success_createdAt_idx" ON "OrderAttempt" ("success", "createdAt");
