export type ProductCardJson = {
  name: string;
  description: string;
  category: string;
  marketingText: string;
  imagePrompt: string;
};

export type PaymentProofAnalysisJson = {
  status: "LIKELY_VALID" | "SUSPICIOUS" | "INVALID" | "UNREADABLE";
  confidence: number;
  amountFound: number | null;
  dateFound: string | null;
  recipientFound: string | null;
  phoneOrCardFound: string | null;
  bankFound: string | null;
  problems: string[];
  summary: string;
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
  const parsed = JSON.parse(jsonText);
  return validate(parsed);
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required AI JSON field: ${field}`);
  }
  return value.trim();
}

export function validateProductCardJson(value: unknown): ProductCardJson {
  const input = value as Partial<ProductCardJson>;

  return {
    name: requiredString(input.name, "name"),
    description: requiredString(input.description, "description"),
    category: requiredString(input.category, "category"),
    marketingText: requiredString(input.marketingText, "marketingText"),
    imagePrompt: requiredString(input.imagePrompt, "imagePrompt"),
  };
}

export function validatePaymentProofAnalysisJson(value: unknown): PaymentProofAnalysisJson {
  const input = value as Partial<PaymentProofAnalysisJson>;
  const status = input.status;

  if (!["LIKELY_VALID", "SUSPICIOUS", "INVALID", "UNREADABLE"].includes(String(status))) {
    throw new Error("Invalid payment proof AI status.");
  }

  const confidence = Number(input.confidence);

  return {
    status: status as PaymentProofAnalysisJson["status"],
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, Math.round(confidence))) : 0,
    amountFound: typeof input.amountFound === "number" && Number.isFinite(input.amountFound) ? input.amountFound : null,
    dateFound: typeof input.dateFound === "string" && input.dateFound.trim() ? input.dateFound.trim() : null,
    recipientFound: typeof input.recipientFound === "string" && input.recipientFound.trim() ? input.recipientFound.trim() : null,
    phoneOrCardFound: typeof input.phoneOrCardFound === "string" && input.phoneOrCardFound.trim() ? input.phoneOrCardFound.trim() : null,
    bankFound: typeof input.bankFound === "string" && input.bankFound.trim() ? input.bankFound.trim() : null,
    problems: Array.isArray(input.problems) ? input.problems.map(String).filter(Boolean).slice(0, 10) : [],
    summary: requiredString(input.summary, "summary").slice(0, 600),
  };
}
