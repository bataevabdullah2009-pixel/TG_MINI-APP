#!/usr/bin/env node

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const requirements = {
  tables: ["User", "Business", "Category", "Item", "Customer", "Order", "OrderAttempt", "OrderItem", "Booking", "Payment", "AIUsageLog", "AICache"],
  columns: {
    User: ["phone", "phoneVerified", "phoneVerifiedAt", "telegramId", "username", "telegramLinkCode", "telegramLinkExpiresAt", "businessId", "isActive"],
    Business: ["isOpen", "isDemo", "transferPaymentEnabled", "transferBankName", "transferPaymentPhone", "transferRecipientName", "transferPaymentCommentRequired", "transferPaymentInstructions"],
    Customer: ["userId", "phone", "address", "phoneVerified", "verificationMethod", "totalOrders", "totalSpent", "bonusBalance", "isBlocked", "blockReason"],
    Order: ["paymentMethod", "paymentStatus", "paymentProofUrl", "paymentProofAiStatus", "paymentProofAiSummary", "paymentProofAiConfidence", "paymentReviewedAt", "paymentReviewedBy", "paymentRejectReason", "expiredAt", "expireReason"],
    Booking: ["expiredAt", "expireReason"],
  },
  enums: {
    OrderStatus: ["EXPIRED"],
    BookingStatus: ["PENDING", "EXPIRED"],
    PaymentStatus: ["AWAITING_REVIEW", "REJECTED"],
  },
};

function patchFor(target) {
  if (target === "Business.isOpen") return "docs/manual-add-business-is-open.sql";
  if (target === "Business.isDemo") return "docs/manual-add-business-is-demo.sql";
  if (target === "OrderAttempt" || /^(Business\.transfer|Customer\.(isBlocked|blockReason)|Order\.payment)/.test(target)) {
    return "docs/manual-hotfix-polza-checkout-payment-flow.sql";
  }
  if (/^(Order|Booking)\.(expiredAt|expireReason)/.test(target) || /^(OrderStatus|BookingStatus)\./.test(target)) {
    return "docs/manual-expire-bookings-orders.sql";
  }
  if (/^User\.(phone|phoneVerified|phoneVerifiedAt)$/.test(target)) return "docs/manual-supabase-hotfix-schema-sync.sql";
  if (/^User\./.test(target)) return "docs/manual-supabase-patch.sql";
  return "docs/manual-supabase-patch.sql";
}

function connectionIssue(error) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  const type = lower.includes("does not exist") && lower.includes("database")
    ? "wrong_database"
    : "connection_error";
  return { type, target: "DATABASE_URL", message };
}

try {
  const [identityRows, tableRows, columnRows, enumRows] = await Promise.all([
    prisma.$queryRawUnsafe("SELECT current_database() AS database, current_schema() AS schema"),
    prisma.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"),
    prisma.$queryRawUnsafe("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'"),
    prisma.$queryRawUnsafe(`
      SELECT t.typname AS enum_name, e.enumlabel AS enum_value
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
    `),
  ]);

  const tables = new Set(tableRows.map((row) => row.table_name));
  const columns = new Set(columnRows.map((row) => `${row.table_name}.${row.column_name}`));
  const enumValues = new Set(enumRows.map((row) => `${row.enum_name}.${row.enum_value}`));
  const issues = [];

  if (["Business", "Item", "User"].every((table) => !tables.has(table))) {
    issues.push({ type: "wrong_database", target: identityRows[0]?.database, patch: null });
  }

  for (const table of requirements.tables) {
    if (!tables.has(table)) issues.push({ type: "missing_table", target: table, patch: patchFor(table) });
  }

  for (const [table, requiredColumns] of Object.entries(requirements.columns)) {
    if (!tables.has(table)) continue;
    for (const column of requiredColumns) {
      const target = `${table}.${column}`;
      if (!columns.has(target)) issues.push({ type: "missing_column", target, patch: patchFor(target) });
    }
  }

  for (const [enumName, values] of Object.entries(requirements.enums)) {
    for (const value of values) {
      const target = `${enumName}.${value}`;
      if (!enumValues.has(target)) issues.push({ type: "enum_value_missing", target, patch: patchFor(target) });
    }
  }

  console.log(JSON.stringify({ ok: issues.length === 0, identity: identityRows[0], issues }, null, 2));
  if (issues.length > 0) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    issues: [connectionIssue(error)],
  }, null, 2));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
