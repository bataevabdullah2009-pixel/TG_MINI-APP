-- Safe production patch for automatic booking and pickup order expiration.
-- Apply in Supabase SQL Editor after deploying the matching Prisma schema.

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expireReason" TEXT;

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expireReason" TEXT;

CREATE INDEX IF NOT EXISTS "Order_deliveryType_status_createdAt_idx"
  ON "Order" ("deliveryType", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "Booking_status_startTime_idx"
  ON "Booking" ("status", "startTime");
