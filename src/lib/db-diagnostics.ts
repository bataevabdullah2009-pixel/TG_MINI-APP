import { prisma } from "@/lib/prisma";

export type DatabaseDiagnosticIssue = {
  type: "connection_error" | "wrong_database" | "missing_table" | "missing_column" | "enum_value_missing";
  message: string;
  patch?: string;
  table?: string;
  column?: string;
  enum?: string;
  value?: string;
};

const BASE_SCHEMA_PATCH = "docs/manual-supabase-patch.sql";
const PROFILE_SCHEMA_PATCH = "docs/manual-supabase-hotfix-schema-sync.sql";
const BUSINESS_OPEN_PATCH = "docs/manual-add-business-is-open.sql";
const BUSINESS_DEMO_PATCH = "docs/manual-add-business-is-demo.sql";
const CHECKOUT_PATCH = "docs/manual-hotfix-polza-checkout-payment-flow.sql";
const EXPIRATION_PATCH = "docs/manual-expire-bookings-orders.sql";
const DELIVERY_PATCH = "docs/manual-courier-direct-links.sql";

const REQUIRED_TABLES = [
  "User",
  "Business",
  "BusinessTemplate",
  "SubscriptionPlan",
  "BusinessSettings",
  "Category",
  "Item",
  "Staff",
  "WorkingHours",
  "StaffSchedule",
  "Customer",
  "FavoriteBusiness",
  "FavoriteItem",
  "Order",
  "OrderAttempt",
  "OrderItem",
  "Booking",
  "Payment",
  "Notification",
  "AIUsageLog",
  "AICache",
  "MarketingPost",
  "MediaAsset",
  "PhoneVerification",
  "SellerInvite",
  "AiRequestLog",
  "Courier",
  "DeliveryZone",
  "DeliveryAssignment",
] as const;

const REQUIRED_COLUMNS = [
  {
    table: "User",
    patch: PROFILE_SCHEMA_PATCH,
    columns: ["phone", "phoneVerified", "phoneVerifiedAt"],
  },
  {
    table: "User",
    patch: BASE_SCHEMA_PATCH,
    columns: ["telegramId", "username", "telegramLinkCode", "telegramLinkExpiresAt", "businessId", "isActive"],
  },
  {
    table: "Business",
    patch: BASE_SCHEMA_PATCH,
    columns: ["slug", "templateKey", "modulesEnabled", "aiProvider", "aiModel", "aiEnabled", "isActive"],
  },
  { table: "Business", patch: BUSINESS_OPEN_PATCH, columns: ["isOpen"] },
  { table: "Business", patch: BUSINESS_DEMO_PATCH, columns: ["isDemo"] },
  { table: "BusinessSettings", patch: DELIVERY_PATCH, columns: ["pickupWaitHours", "courierAcceptanceMinutes"] },
  {
    table: "Business",
    patch: CHECKOUT_PATCH,
    columns: [
      "transferPaymentEnabled",
      "transferBankName",
      "transferPaymentPhone",
      "transferRecipientName",
      "transferPaymentCommentRequired",
      "transferPaymentInstructions",
    ],
  },
  { table: "Category", patch: BASE_SCHEMA_PATCH, columns: ["businessId", "sortOrder", "isActive"] },
  {
    table: "Item",
    patch: BASE_SCHEMA_PATCH,
    columns: ["businessId", "categoryId", "type", "price", "isAvailable", "isPopular", "sortOrder"],
  },
  {
    table: "Customer",
    patch: BASE_SCHEMA_PATCH,
    columns: ["businessId", "userId", "telegramUserId", "phone", "address", "phoneVerified", "verificationMethod"],
  },
  { table: "Customer", patch: CHECKOUT_PATCH, columns: ["isBlocked", "blockReason"] },
  {
    table: "Order",
    patch: CHECKOUT_PATCH,
    columns: [
      "paymentMethod",
      "paymentStatus",
      "paymentProofUrl",
      "paymentProofAiStatus",
      "paymentProofAiSummary",
      "paymentProofAiConfidence",
      "paymentReviewedAt",
      "paymentReviewedBy",
      "paymentRejectReason",
    ],
  },
  { table: "Order", patch: EXPIRATION_PATCH, columns: ["expiredAt", "expireReason"] },
  {
    table: "Order",
    patch: DELIVERY_PATCH,
    columns: [
      "itemsSubtotal",
      "deliveryFee",
      "deliveryStatus",
      "deliveryZoneId",
      "deliveryZoneName",
      "deliveryCityArea",
      "courierAssignedAt",
      "courierPickupDeadline",
    ],
  },
  { table: "Booking", patch: EXPIRATION_PATCH, columns: ["expiredAt", "expireReason"] },
  {
    table: "OrderAttempt",
    patch: CHECKOUT_PATCH,
    columns: ["businessId", "telegramUserId", "phone", "success", "reason", "createdAt"],
  },
] as const;

const REQUIRED_ENUMS = [
  { enum: "Role", patch: DELIVERY_PATCH, values: ["COURIER"] },
  { enum: "OrderStatus", patch: EXPIRATION_PATCH, values: ["EXPIRED"] },
  {
    enum: "OrderStatus",
    patch: DELIVERY_PATCH,
    values: ["READY_FOR_PICKUP", "READY_FOR_DELIVERY", "COURIER_ASSIGNED", "PICKED_UP", "DELIVERED"],
  },
  {
    enum: "DeliveryStatus",
    patch: DELIVERY_PATCH,
    values: ["NONE", "WAITING_COURIER", "ASSIGNED", "PICKED_UP", "DELIVERED", "CANCELLED", "EXPIRED"],
  },
  { enum: "BookingStatus", patch: EXPIRATION_PATCH, values: ["PENDING", "EXPIRED"] },
  { enum: "PaymentStatus", patch: CHECKOUT_PATCH, values: ["AWAITING_REVIEW", "REJECTED"] },
] as const;

function configuredDatabaseName(value?: string) {
  if (!value) return null;
  try {
    return decodeURIComponent(new URL(value).pathname.replace(/^\/+/, "")) || null;
  } catch {
    return null;
  }
}

export async function runDatabaseDiagnostics() {
  const [identityRows, tableRows, columnRows, enumRows] = await Promise.all([
    prisma.$queryRaw<Array<{ database: string; schema: string }>>`
      SELECT current_database() AS database, current_schema() AS schema
    `,
    prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `,
    prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'
    `,
    prisma.$queryRaw<Array<{ enum_name: string; enum_value: string }>>`
      SELECT t.typname AS enum_name, e.enumlabel AS enum_value
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
    `,
  ]);

  const identity = identityRows[0] || { database: "unknown", schema: "unknown" };
  const tables = new Set(tableRows.map((row) => row.table_name));
  const columns = new Set(columnRows.map((row) => `${row.table_name}.${row.column_name}`));
  const enumValues = new Set(enumRows.map((row) => `${row.enum_name}.${row.enum_value}`));
  const issues: DatabaseDiagnosticIssue[] = [];

  const configuredDb = configuredDatabaseName(process.env.DATABASE_URL);
  if (configuredDb && configuredDb !== identity.database) {
    issues.push({
      type: "wrong_database",
      message: `DATABASE_URL points to "${configuredDb}", but the active connection reports "${identity.database}".`,
    });
  }

  if (["Business", "Item", "User"].every((table) => !tables.has(table))) {
    issues.push({
      type: "wrong_database",
      message: `Core Vitrina AI tables are absent in database "${identity.database}" schema "${identity.schema}".`,
    });
  }

  for (const table of REQUIRED_TABLES) {
    if (!tables.has(table)) {
      issues.push({
        type: "missing_table",
        table,
        patch: table === "OrderAttempt"
          ? CHECKOUT_PATCH
          : ["Courier", "DeliveryZone", "DeliveryAssignment"].includes(table)
            ? DELIVERY_PATCH
            : BASE_SCHEMA_PATCH,
        message: `Missing table public."${table}".`,
      });
    }
  }

  for (const requirement of REQUIRED_COLUMNS) {
    if (!tables.has(requirement.table)) continue;
    for (const column of requirement.columns) {
      if (!columns.has(`${requirement.table}.${column}`)) {
        issues.push({
          type: "missing_column",
          table: requirement.table,
          column,
          patch: requirement.patch,
          message: `Missing column public."${requirement.table}"."${column}".`,
        });
      }
    }
  }

  for (const requirement of REQUIRED_ENUMS) {
    for (const value of requirement.values) {
      if (!enumValues.has(`${requirement.enum}.${value}`)) {
        issues.push({
          type: "enum_value_missing",
          enum: requirement.enum,
          value,
          patch: requirement.patch,
          message: `Missing enum value "${value}" in public."${requirement.enum}".`,
        });
      }
    }
  }

  return {
    ok: issues.length === 0,
    identity,
    summary: {
      tables: tables.size,
      columns: columns.size,
      enumValues: enumValues.size,
      issues: issues.length,
    },
    issues,
  };
}

export function logDatabaseDiagnostics(result: Awaited<ReturnType<typeof runDatabaseDiagnostics>>) {
  if (result.ok) {
    console.info("[DB DIAGNOSTIC] schema check passed", result.identity);
    return;
  }

  for (const issue of result.issues) {
    console.error(`[DB DIAGNOSTIC] ${issue.type}: ${issue.message}`, {
      patch: issue.patch,
      table: issue.table,
      column: issue.column,
      enum: issue.enum,
      value: issue.value,
      database: result.identity.database,
      schema: result.identity.schema,
    });
  }
}
