export type ProductCardJson = {
  title: string;
  shortDescription: string;
  description: string;
  categorySuggestion: string;
  tags: string[];
  tgPost: string;
};

export type PaymentProofAnalysisJson = {
  valid: boolean;
  amount: number | null;
  date: string | null;
  receiver: string | null;
  confidence: number;
  reason: string;
};

export function aiRawPreview(raw: string, limit = 200) {
  return raw.replace(/\s+/g, " ").trim().slice(0, limit);
}

export function extractAiJsonObject(raw: string) {
  const trimmed = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");

  if (first === -1 || last === -1 || last <= first) {
    throw new Error("AI response does not contain a JSON object.");
  }

  return trimmed.slice(first, last + 1);
}

export function safeParseAiJson<T>(
  raw: string,
  validate: (value: unknown) => T
): T {
  const jsonText = extractAiJsonObject(raw);
  const candidates = [
    jsonText,
    jsonText
      .replace(/[“”]/g, "\"")
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""),
  ];

  let lastError: unknown;
  for (const candidate of Array.from(new Set(candidates))) {
    try {
      return validate(JSON.parse(candidate));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AI JSON repair parse failed.");
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required AI JSON field: ${field}`);
  }
  return value.trim();
}

export function validateProductCardJson(value: unknown): ProductCardJson {
  const input = value as Partial<ProductCardJson> & {
    name?: unknown;
    category?: unknown;
    marketingText?: unknown;
    telegramPost?: unknown;
    categorySuggestion?: unknown;
  };

  const tgPost = requiredString(input.tgPost ?? input.telegramPost ?? input.marketingText, "tgPost");
  return {
    title: requiredString(input.title ?? input.name, "title"),
    shortDescription: requiredString(input.shortDescription ?? input.marketingText ?? tgPost.slice(0, 160), "shortDescription"),
    description: requiredString(input.description, "description"),
    categorySuggestion: requiredString(input.categorySuggestion ?? input.category, "categorySuggestion"),
    tags: Array.isArray(input.tags) ? input.tags.map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 12) : [],
    tgPost,
  };
}

export function validatePaymentProofAnalysisJson(value: unknown): PaymentProofAnalysisJson {
  const input = value as Partial<PaymentProofAnalysisJson>;
  if (typeof input.valid !== "boolean") {
    throw new Error("Invalid payment proof AI valid value.");
  }

  const confidence = Number(input.confidence);

  return {
    valid: input.valid,
    amount: typeof input.amount === "number" && Number.isFinite(input.amount) ? input.amount : null,
    date: typeof input.date === "string" && input.date.trim() ? input.date.trim() : null,
    receiver: typeof input.receiver === "string" && input.receiver.trim() ? input.receiver.trim() : null,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
    reason: requiredString(input.reason, "reason").slice(0, 600),
  };
}
