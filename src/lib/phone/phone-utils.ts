export function normalizeRuPhone(phone: unknown): string | null {
  if (typeof phone !== "string" && typeof phone !== "number") return null;

  const raw = String(phone).trim();
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  let normalized = "";

  if (digits.length === 11 && digits.startsWith("8")) {
    normalized = `+7${digits.slice(1)}`;
  } else if (digits.length === 11 && digits.startsWith("7")) {
    normalized = `+${digits}`;
  } else if (digits.length === 10 && digits.startsWith("9")) {
    normalized = `+7${digits}`;
  }

  return /^\+7\d{10}$/.test(normalized) ? normalized : null;
}

export function phonesEqual(left: unknown, right: unknown) {
  const normalizedLeft = normalizeRuPhone(left);
  const normalizedRight = normalizeRuPhone(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

export function validateCustomerName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const cleaned = name.replace(/\s+/g, " ").trim();

  if (cleaned.length < 2 || cleaned.length > 80) return null;
  if (/https?:\/\//i.test(cleaned) || /www\./i.test(cleaned) || /@\w+/i.test(cleaned)) return null;
  if (/[0-9_()[\]{}<>/\\|+=*~`^%$#&!?,.;:"']/u.test(cleaned)) return null;
  if (!/^[\p{L}\s-]+$/u.test(cleaned)) return null;

  return cleaned;
}
