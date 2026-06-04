-- Courier MVP, delivery zones and direct store links patch for Vitrina AI.
-- Safe to run multiple times in Supabase SQL Editor.
-- Additive only: no DROP TABLE, no production data deletion.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'COURIER';

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_PICKUP';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_DELIVERY';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'COURIER_ASSIGNED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PICKED_UP';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryStatus') THEN
    CREATE TYPE "DeliveryStatus" AS ENUM (
      'NONE',
      'WAITING_COURIER',
      'ASSIGNED',
      'PICKED_UP',
      'DELIVERED',
      'CANCELLED',
      'EXPIRED'
    );
  END IF;
END $$;

UPDATE "Business"
SET "slug" = 'store-' || substr(md5("id"), 1, 12)
WHERE "slug" IS NULL OR btrim("slug") = '';

CREATE UNIQUE INDEX IF NOT EXISTS "Business_slug_key" ON "Business" ("slug");

ALTER TABLE "BusinessSettings"
  ADD COLUMN IF NOT EXISTS "pickupWaitHours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS "courierAcceptanceMinutes" INTEGER NOT NULL DEFAULT 30;

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

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "itemsSubtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "deliveryZoneId" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryZoneName" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryCityArea" TEXT,
  ADD COLUMN IF NOT EXISTS "courierAssignedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "courierPickupDeadline" TIMESTAMP(3);

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
END $$;

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
CREATE INDEX IF NOT EXISTS "Order_deliveryStatus_status_createdAt_idx" ON "Order" ("deliveryStatus", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_deliveryZoneId_idx" ON "Order" ("deliveryZoneId");

-- These tables are used only through backend Prisma/database credentials.
-- No anon/authenticated policies are created intentionally.
ALTER TABLE "Courier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeliveryZone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeliveryAssignment" ENABLE ROW LEVEL SECURITY;
