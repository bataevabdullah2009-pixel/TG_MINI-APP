export function isPrismaMissingColumnError(error: unknown, table?: string, column?: string) {
  const err = error as { code?: string; message?: string; meta?: Record<string, unknown> };
  const message = String(err?.message || "");
  const target = `${table || ""}.${column || ""}`.replace(/^\./, "").replace(/\.$/, "");

  if (err?.code === "P2022") {
    if (!target) return true;
    return message.includes(target) || JSON.stringify(err.meta || {}).includes(target);
  }

  const lower = message.toLowerCase();
  if (!lower.includes("column") || !lower.includes("does not exist")) return false;
  if (!target) return true;

  return lower.includes(target.toLowerCase()) || lower.includes(`"${column?.toLowerCase()}"`);
}

export function isBusinessIsDemoMissingColumnError(error: unknown) {
  return isPrismaMissingColumnError(error, "Business", "isDemo");
}

export type DatabaseErrorClassification = {
  type: "connection_error" | "missing_table" | "missing_column" | "enum_value_missing" | "wrong_database" | "database_error";
  code: string;
  message: string;
  patch?: string;
};

function patchForMessage(message: string) {
  if (/transferPayment|paymentProof|paymentMethod|paymentStatus|OrderAttempt|isBlocked|blockReason|AWAITING_REVIEW|REJECTED/i.test(message)) {
    return "docs/manual-hotfix-polza-checkout-payment-flow.sql";
  }
  if (/expiredAt|expireReason|OrderStatus.*EXPIRED|BookingStatus.*(?:PENDING|EXPIRED)/i.test(message)) {
    return "docs/manual-expire-bookings-orders.sql";
  }
  if (/Business.*isOpen/i.test(message)) return "docs/manual-add-business-is-open.sql";
  if (/Business.*isDemo/i.test(message)) return "docs/manual-add-business-is-demo.sql";
  if (/User.*(?:phone|phoneVerified|phoneVerifiedAt)|Customer.*(?:phone|phoneVerified|verificationMethod|userId)/i.test(message)) {
    return "docs/manual-supabase-hotfix-schema-sync.sql";
  }
  return "docs/manual-supabase-patch.sql";
}

export function classifyDatabaseError(error: unknown): DatabaseErrorClassification {
  const err = error as { code?: string; message?: string; meta?: Record<string, unknown> };
  const message = String(err?.message || error || "Unknown database error");
  const lower = message.toLowerCase();
  const combined = `${message} ${JSON.stringify(err?.meta || {})}`;

  if (err?.code === "P2021" || (lower.includes("relation") && lower.includes("does not exist"))) {
    return { type: "missing_table", code: "DB_MISSING_TABLE", message, patch: patchForMessage(combined) };
  }

  if (err?.code === "P2022" || (lower.includes("column") && lower.includes("does not exist"))) {
    return { type: "missing_column", code: "DB_MISSING_COLUMN", message, patch: patchForMessage(combined) };
  }

  if (lower.includes("invalid input value for enum") || lower.includes("enum value")) {
    return { type: "enum_value_missing", code: "DB_ENUM_VALUE_MISSING", message, patch: patchForMessage(combined) };
  }

  if (err?.code === "P1001" || err?.code === "P1000" || lower.includes("can't reach database server")) {
    return { type: "connection_error", code: "DB_CONNECTION_ERROR", message };
  }

  if (err?.code === "P1003" || (lower.includes("database") && lower.includes("does not exist"))) {
    return { type: "wrong_database", code: "DB_WRONG_DATABASE", message };
  }

  return { type: "database_error", code: "DB_ERROR", message, patch: patchForMessage(combined) };
}

export function warnPrismaSchemaDrift(context: string, error: unknown) {
  const err = error as { code?: string; message?: string; meta?: Record<string, unknown> };
  const classification = classifyDatabaseError(error);
  const action = classification.patch
    ? `Apply ${classification.patch} in Supabase SQL Editor.`
    : classification.type === "connection_error" || classification.type === "wrong_database"
      ? "Check DATABASE_URL and DIRECT_URL."
      : "Check the production database logs.";

  console.error(
    `[DB DIAGNOSTIC] ${classification.type}: ${context}. ${action}`,
    {
      code: err?.code,
      meta: err?.meta,
      message: err?.message,
      diagnosticCode: classification.code,
      patch: classification.patch,
    }
  );
}

export function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, current) => (typeof current === "bigint" ? current.toString() : current))
  );
}
