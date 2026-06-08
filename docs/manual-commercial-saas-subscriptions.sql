-- Commercial SaaS subscription patch for Vitrina AI.
-- Apply in Supabase SQL Editor before deploying code that uses these fields.
-- The patch does not delete production data. It performs a targeted conversion
-- of businesses already attached to plan-commercial to lifetime access.

ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PAST_DUE';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'LIFETIME';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'AWAITING_PROOF';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PROOF_UPLOADED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'AI_REVIEW';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'NEEDS_MANUAL_REVIEW';

-- PostgreSQL requires newly added enum values to be committed before use below.
COMMIT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BusinessPaymentType') THEN
    CREATE TYPE "BusinessPaymentType" AS ENUM ('SETUP', 'MONTHLY', 'MANUAL', 'REFUND', 'BONUS');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BusinessPaymentMethod') THEN
    CREATE TYPE "BusinessPaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD', 'MANUAL');
  END IF;
END
$$;

ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "setupFeeAmount" INTEGER NOT NULL DEFAULT 30000,
  ADD COLUMN IF NOT EXISTS "monthlyFeeAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastPaidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "nextPaymentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "blockedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "blockedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "gracePeriodUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paymentComment" TEXT,
  ADD COLUMN IF NOT EXISTS "subscriptionReminder3dSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "subscriptionReminder1dSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "subscriptionExpiredNoticeSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "subscriptionBlockedNoticeSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "SubscriptionPlan"
  ADD COLUMN IF NOT EXISTS "setupFeeAmount" INTEGER NOT NULL DEFAULT 30000,
  ADD COLUMN IF NOT EXISTS "monthlyFeeAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "billingPeriodMonths" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Business" ALTER COLUMN "monthlyFeeAmount" SET DEFAULT 0;
ALTER TABLE "SubscriptionPlan" ALTER COLUMN "monthlyFeeAmount" SET DEFAULT 0;
ALTER TABLE "SubscriptionPlan" ALTER COLUMN "billingPeriodMonths" SET DEFAULT 0;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT;

CREATE TABLE IF NOT EXISTS "BusinessPayment" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "type" "BusinessPaymentType" NOT NULL,
  "monthsAdded" INTEGER NOT NULL DEFAULT 0,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "method" "BusinessPaymentMethod" NOT NULL DEFAULT 'MANUAL',
  "comment" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessPayment_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BusinessPayment_businessId_fkey') THEN
    ALTER TABLE "BusinessPayment"
      ADD CONSTRAINT "BusinessPayment_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BusinessPayment_createdByAdminId_fkey') THEN
    ALTER TABLE "BusinessPayment"
      ADD CONSTRAINT "BusinessPayment_createdByAdminId_fkey"
      FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "Business_subscriptionEndDate_idx" ON "Business" ("subscriptionEndDate");
CREATE INDEX IF NOT EXISTS "Business_isBlocked_idx" ON "Business" ("isBlocked");
CREATE INDEX IF NOT EXISTS "Business_isArchived_isDeleted_idx" ON "Business" ("isArchived", "isDeleted");
CREATE INDEX IF NOT EXISTS "BusinessPayment_businessId_paidAt_idx" ON "BusinessPayment" ("businessId", "paidAt");
CREATE INDEX IF NOT EXISTS "BusinessPayment_createdByAdminId_idx" ON "BusinessPayment" ("createdByAdminId");
CREATE INDEX IF NOT EXISTS "BusinessPayment_type_idx" ON "BusinessPayment" ("type");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_clientRequestId_key" ON "Order" ("clientRequestId");

INSERT INTO "SubscriptionPlan" (
  "id",
  "name",
  "description",
  "price",
  "setupFeeAmount",
  "monthlyFeeAmount",
  "billingPeriodMonths",
  "maxItems",
  "maxOrdersPerMonth",
  "maxStaff",
  "features",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES (
  'plan-commercial',
  'Commercial',
  'Разовое подключение 50 000 ₽ — бессрочный доступ. Каталог, заказы, ИИ, доставка, уведомления.',
  50000,
  50000,
  0,
  0,
  1000,
  10000,
  20,
  '["catalog","orders","telegram-mini-app","ai","notifications","delivery"]',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "price" = EXCLUDED."price",
  "setupFeeAmount" = EXCLUDED."setupFeeAmount",
  "monthlyFeeAmount" = EXCLUDED."monthlyFeeAmount",
  "billingPeriodMonths" = EXCLUDED."billingPeriodMonths",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "Business"
SET
  "monthlyFeeAmount" = 0,
  "subscriptionStatus" = CASE
    WHEN "isArchived" = true OR "isDeleted" = true THEN 'ARCHIVED'::"SubscriptionStatus"
    WHEN "isBlocked" = true
      AND COALESCE("blockedReason", '') <> 'Истёк срок подписки'
      THEN 'BLOCKED'::"SubscriptionStatus"
    WHEN "subscriptionPlanId" = 'plan-commercial' AND "subscriptionStatus" = 'LIFETIME'
      THEN 'LIFETIME'::"SubscriptionStatus"
    ELSE 'LIFETIME'::"SubscriptionStatus"
  END,
  "subscriptionEndDate" = NULL,
  "nextPaymentAt" = NULL,
  "gracePeriodUntil" = NULL,
  "isBlocked" = CASE
    WHEN "isBlocked" = true
      AND COALESCE("blockedReason", '') <> 'Истёк срок подписки'
      THEN true
    ELSE false
  END,
  "blockedAt" = CASE
    WHEN "isBlocked" = true
      AND COALESCE("blockedReason", '') <> 'Истёк срок подписки'
      THEN "blockedAt"
    ELSE NULL
  END,
  "blockedReason" = CASE
    WHEN "isBlocked" = true
      AND COALESCE("blockedReason", '') <> 'Истёк срок подписки'
      THEN "blockedReason"
    ELSE NULL
  END
WHERE "subscriptionPlanId" = 'plan-commercial';

ALTER TABLE "BusinessPayment" ENABLE ROW LEVEL SECURITY;
