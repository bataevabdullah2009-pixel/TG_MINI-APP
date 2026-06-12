export type ProductCardJson = {
  title: string;
  shortDescription: string;
  description: string;
  categorySuggestion: string;
  tags: string[];
  tgPost: string;
};

export type PaymentProofAnalysisJson = {
  extractedAmount: number | null;
  expectedAmount: number;
  amountMatches: boolean | null;
  extractedDate: string | null;
  extractedRecipient: string | null;
  expectedRecipient: string | null;
  recipientMatches: boolean | null;
  extractedBank: string | null;
  confidencePercent: number;
  status: "LIKELY_VALID" | "MANUAL_REVIEW" | "LIKELY_INVALID";
  reasonRu: string;
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
  const input = value as Partial<PaymentProofAnalysisJson> & {
    amount?: unknown;
    date?: unknown;
    recipient?: unknown;
    bank?: unknown;
    comment?: unknown;
    confidence?: unknown;
    reason?: unknown;
  };

  const confidence = Number(input.confidencePercent ?? input.confidence);
  const rawStatus = String(input.status || "").toLowerCase();
  const status =
    rawStatus === "likely_valid"
      ? "LIKELY_VALID"
      : rawStatus === "likely_invalid"
        ? "LIKELY_INVALID"
        : "MANUAL_REVIEW";
  const amount = input.extractedAmount ?? input.amount;
  const date = input.extractedDate ?? input.date;
  const recipient = input.extractedRecipient ?? input.recipient;
  const bank = input.extractedBank ?? input.bank;

  return {
    extractedAmount: typeof amount === "number" && Number.isFinite(amount) ? amount : null,
    expectedAmount: Number.isFinite(Number(input.expectedAmount)) ? Number(input.expectedAmount) : 0,
    amountMatches: typeof input.amountMatches === "boolean" ? input.amountMatches : null,
    extractedDate: typeof date === "string" && date.trim() ? date.trim() : null,
    extractedRecipient: typeof recipient === "string" && recipient.trim() ? recipient.trim().slice(0, 200) : null,
    expectedRecipient: typeof input.expectedRecipient === "string" && input.expectedRecipient.trim()
      ? input.expectedRecipient.trim().slice(0, 200)
      : null,
    recipientMatches: typeof input.recipientMatches === "boolean" ? input.recipientMatches : null,
    extractedBank: typeof bank === "string" && bank.trim() ? bank.trim().slice(0, 120) : null,
    confidencePercent: Number.isFinite(confidence) ? Math.max(0, Math.min(100, Math.round(confidence))) : 0,
    status,
    reasonRu: requiredString(input.reasonRu ?? input.reason ?? input.comment, "reasonRu").slice(0, 600),
  };
}
