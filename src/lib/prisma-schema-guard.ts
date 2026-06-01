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

export function warnPrismaSchemaDrift(context: string, error: unknown) {
  const err = error as { code?: string; message?: string; meta?: Record<string, unknown> };

  console.warn(
    `[DB SCHEMA SYNC] ${context}: production database is behind prisma/schema.prisma. Apply docs/manual-supabase-patch.sql in Supabase SQL Editor.`,
    {
      code: err?.code,
      meta: err?.meta,
      message: err?.message,
    }
  );
}

export function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, current) => (typeof current === "bigint" ? current.toString() : current))
  );
}
