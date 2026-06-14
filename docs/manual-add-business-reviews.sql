DO $$
BEGIN
  CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'HIDDEN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Review" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT,
  "bookingId" TEXT,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "authorName" TEXT NOT NULL,
  "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
  "hiddenAt" TIMESTAMP(3),
  "hiddenByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Review_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "Review_source_check" CHECK (
    ("orderId" IS NOT NULL AND "bookingId" IS NULL) OR
    ("orderId" IS NULL AND "bookingId" IS NOT NULL)
  ),
  CONSTRAINT "Review_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Review_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Review_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Review_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Review_hiddenByUserId_fkey"
    FOREIGN KEY ("hiddenByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Review_orderId_key"
  ON "Review"("orderId");

CREATE UNIQUE INDEX IF NOT EXISTS "Review_bookingId_key"
  ON "Review"("bookingId");

CREATE INDEX IF NOT EXISTS "Review_businessId_status_createdAt_idx"
  ON "Review"("businessId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "Review_userId_createdAt_idx"
  ON "Review"("userId", "createdAt");
