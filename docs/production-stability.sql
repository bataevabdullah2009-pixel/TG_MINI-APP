-- Vitrina AI production stability patch.
-- Copy this entire file into Supabase SQL Editor and run it once before deploy.
-- Safe to run repeatedly. Additive only: no DROP and no production data deletion.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'COURIER';

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_PICKUP';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_DELIVERY';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'COURIER_ASSIGNED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PICKED_UP';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'AWAITING_REVIEW';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_REJECTED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryStatus') THEN
    CREATE TYPE "DeliveryStatus" AS ENUM (
      'NONE',
      'NEW',
      'WAITING_COURIER',
      'ASSIGNED',
      'ACCEPTED_BY_COURIER',
      'PICKED_UP',
      'DELIVERED',
      'CANCELLED',
      'EXPIRED'
    );
  END IF;
END $$;

ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'NEW';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED_BY_COURIER';

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3);

ALTER TABLE "Business"
  ALTER COLUMN "aiProvider" SET DEFAULT 'polza';

UPDATE "Business"
SET "aiProvider" = 'polza'
WHERE "aiProvider" IS NULL OR lower("aiProvider") = 'mock';

ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "transferPaymentEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "transferBankName" TEXT,
  ADD COLUMN IF NOT EXISTS "transferPaymentPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "transferRecipientName" TEXT,
  ADD COLUMN IF NOT EXISTS "transferPaymentCommentRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "transferPaymentInstructions" TEXT;

ALTER TABLE "BusinessSettings"
  ADD COLUMN IF NOT EXISTS "pickupWaitHours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS "courierAcceptanceMinutes" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "verificationMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "blockReason" TEXT;

CREATE TABLE IF NOT EXISTS "Courier" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "userId" TEXT,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "telegramId" BIGINT,
  "cityArea" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Courier_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Courier"
  ADD COLUMN IF NOT EXISTS "businessId" TEXT,
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "telegramId" BIGINT,
  ADD COLUMN IF NOT EXISTS "cityArea" TEXT,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "DeliveryZone" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "cityArea" TEXT NOT NULL,
  "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "estimatedMinutes" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DeliveryZone"
  ADD COLUMN IF NOT EXISTS "businessId" TEXT,
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "cityArea" TEXT,
  ADD COLUMN IF NOT EXISTS "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "estimatedMinutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "itemsSubtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "deliveryZoneId" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryZoneName" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryCityArea" TEXT,
  ADD COLUMN IF NOT EXISTS "courierAssignedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "courierPickupDeadline" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paymentMethod" "PaymentProvider" NOT NULL DEFAULT 'CASH',
  ADD COLUMN IF NOT EXISTS "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "paymentProofUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentProofFileName" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentProofMimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentProofAiStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentProofAiSummary" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentProofAiConfidence" INTEGER,
  ADD COLUMN IF NOT EXISTS "paymentReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paymentReviewedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentRejectReason" TEXT;

UPDATE "Order"
SET "itemsSubtotal" = GREATEST("totalPrice" - COALESCE("deliveryFee", 0), 0)
WHERE "itemsSubtotal" = 0 AND "totalPrice" > 0;

CREATE TABLE IF NOT EXISTS "DeliveryAssignment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "courierId" TEXT NOT NULL,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'ASSIGNED',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pickupDeadline" TIMESTAMP(3) NOT NULL,
  "pickedUpAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryAssignment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DeliveryAssignment"
  ADD COLUMN IF NOT EXISTS "orderId" TEXT,
  ADD COLUMN IF NOT EXISTS "courierId" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "DeliveryStatus" NOT NULL DEFAULT 'ASSIGNED',
  ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "pickupDeadline" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pickedUpAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "releasedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "OrderAttempt" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "telegramUserId" BIGINT NOT NULL,
  "phone" TEXT,
  "ipAddress" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderAttempt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrderAttempt"
  ADD COLUMN IF NOT EXISTS "businessId" TEXT,
  ADD COLUMN IF NOT EXISTS "telegramUserId" BIGINT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "ipAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "success" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reason" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Courier_businessId_fkey') THEN
    ALTER TABLE "Courier" ADD CONSTRAINT "Courier_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Courier_userId_fkey') THEN
    ALTER TABLE "Courier" ADD CONSTRAINT "Courier_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryZone_businessId_fkey') THEN
    ALTER TABLE "DeliveryZone" ADD CONSTRAINT "DeliveryZone_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_deliveryZoneId_fkey') THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryZoneId_fkey"
      FOREIGN KEY ("deliveryZoneId") REFERENCES "DeliveryZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryAssignment_orderId_fkey') THEN
    ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryAssignment_courierId_fkey') THEN
    ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_courierId_fkey"
      FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderAttempt_businessId_fkey') THEN
    ALTER TABLE "OrderAttempt" ADD CONSTRAINT "OrderAttempt_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Business_transferPaymentEnabled_idx" ON "Business" ("transferPaymentEnabled");
CREATE INDEX IF NOT EXISTS "Customer_isBlocked_idx" ON "Customer" ("isBlocked");
CREATE INDEX IF NOT EXISTS "Order_paymentMethod_idx" ON "Order" ("paymentMethod");
CREATE INDEX IF NOT EXISTS "Order_paymentStatus_idx" ON "Order" ("paymentStatus");
CREATE INDEX IF NOT EXISTS "Order_deliveryStatus_status_createdAt_idx" ON "Order" ("deliveryStatus", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_deliveryZoneId_idx" ON "Order" ("deliveryZoneId");

CREATE UNIQUE INDEX IF NOT EXISTS "Courier_userId_key" ON "Courier" ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Courier_businessId_telegramId_key" ON "Courier" ("businessId", "telegramId");
CREATE INDEX IF NOT EXISTS "Courier_businessId_idx" ON "Courier" ("businessId");
CREATE INDEX IF NOT EXISTS "Courier_businessId_isActive_idx" ON "Courier" ("businessId", "isActive");
CREATE INDEX IF NOT EXISTS "Courier_telegramId_idx" ON "Courier" ("telegramId");

CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryZone_businessId_name_key" ON "DeliveryZone" ("businessId", "name");
CREATE INDEX IF NOT EXISTS "DeliveryZone_businessId_idx" ON "DeliveryZone" ("businessId");
CREATE INDEX IF NOT EXISTS "DeliveryZone_businessId_isActive_idx" ON "DeliveryZone" ("businessId", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryAssignment_orderId_key" ON "DeliveryAssignment" ("orderId");
CREATE INDEX IF NOT EXISTS "DeliveryAssignment_courierId_status_idx" ON "DeliveryAssignment" ("courierId", "status");
CREATE INDEX IF NOT EXISTS "DeliveryAssignment_status_pickupDeadline_idx" ON "DeliveryAssignment" ("status", "pickupDeadline");

CREATE INDEX IF NOT EXISTS "OrderAttempt_businessId_idx" ON "OrderAttempt" ("businessId");
CREATE INDEX IF NOT EXISTS "OrderAttempt_telegramUserId_createdAt_idx" ON "OrderAttempt" ("telegramUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderAttempt_phone_createdAt_idx" ON "OrderAttempt" ("phone", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderAttempt_ipAddress_createdAt_idx" ON "OrderAttempt" ("ipAddress", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderAttempt_success_createdAt_idx" ON "OrderAttempt" ("success", "createdAt");

ALTER TABLE "Courier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeliveryZone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeliveryAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderAttempt" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  target_table TEXT;
  policy_name TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['Courier', 'DeliveryZone', 'DeliveryAssignment', 'OrderAttempt']
  LOOP
    policy_name := 'service_role_full_access_' || lower(target_table);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = target_table AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        policy_name,
        target_table
      );
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('payment-proofs', 'payment-proofs', true)
    ON CONFLICT (id) DO UPDATE SET public = true;
  END IF;

  IF to_regclass('storage.objects') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'public_read_payment_proofs'
    )
  THEN
    EXECUTE 'CREATE POLICY "public_read_payment_proofs" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = ''payment-proofs'')';
  END IF;
END $$;
