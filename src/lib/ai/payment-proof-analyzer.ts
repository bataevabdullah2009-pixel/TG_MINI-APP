import { PolzaAIProvider, getPolzaChatEndpoint } from "@/lib/ai/polza-provider";
import {
  PaymentProofAnalysisJson,
  aiRawPreview,
  safeParseAiJson,
  validatePaymentProofAnalysisJson,
} from "@/lib/ai/safe-ai-json";

export type PaymentProofAnalysisResult = PaymentProofAnalysisJson & {
  summary: string;
};

function normalizeComparable(value: string) {
  return value.toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}]/gu, "");
}

function recipientsLookSimilar(extracted: string | null, expected: string | null) {
  if (!extracted || !expected) return null;
  const left = normalizeComparable(extracted);
  const right = normalizeComparable(expected);
  if (!left || !right) return null;
  return left.includes(right) || right.includes(left) || left.slice(0, 6) === right.slice(0, 6);
}

function parseReceiptDate(value: string | null) {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const match = value.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (!match) return null;
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  const parsed = new Date(year, Number(match[2]) - 1, Number(match[1]));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toResult(
  analysis: PaymentProofAnalysisJson,
  orderTotal: number,
  expectedRecipient: string | null,
  orderCreatedAt: Date
): PaymentProofAnalysisResult {
  const amountMatches = analysis.extractedAmount === null
    ? null
    : Math.abs(analysis.extractedAmount - orderTotal) <= 1;
  const recipientMatches = recipientsLookSimilar(analysis.extractedRecipient, expectedRecipient);
  const extractedDate = parseReceiptDate(analysis.extractedDate);
  const dateLooksReasonable = extractedDate
    ? extractedDate.getTime() >= orderCreatedAt.getTime() - 7 * 24 * 60 * 60 * 1000 &&
      extractedDate.getTime() <= Date.now() + 24 * 60 * 60 * 1000
    : false;
  const status = amountMatches === false
    ? "LIKELY_INVALID"
    : amountMatches === true && dateLooksReasonable && recipientMatches === true && analysis.confidencePercent >= 70
      ? "LIKELY_VALID"
      : "MANUAL_REVIEW";
  const reasonRu = amountMatches === false
    ? "Сумма на чеке не совпадает с суммой заказа. Финальное решение принимает продавец."
    : analysis.reasonRu;

  return {
    ...analysis,
    expectedAmount: orderTotal,
    amountMatches,
    expectedRecipient,
    recipientMatches,
    status,
    reasonRu,
    summary: reasonRu,
  };
}

function manualReview(input: {
  orderTotal: number;
  recipientName?: string | null;
  reasonRu: string;
  summary: string;
}): PaymentProofAnalysisResult {
  return {
    extractedAmount: null,
    expectedAmount: input.orderTotal,
    amountMatches: null,
    extractedDate: null,
    extractedRecipient: null,
    expectedRecipient: input.recipientName || null,
    recipientMatches: null,
    extractedBank: null,
    confidencePercent: 0,
    status: "MANUAL_REVIEW",
    reasonRu: input.reasonRu,
    summary: input.summary,
  };
}

export async function analyzePaymentProof(input: {
  imageUrl: string;
  orderTotal: number;
  businessName: string;
  recipientName?: string | null;
  paymentPhone?: string | null;
  bankName?: string | null;
  orderCreatedAt: Date;
}): Promise<PaymentProofAnalysisResult> {
  const apiKey = process.env.POLZA_AI_API_KEY;
  if (!apiKey || process.env.AI_PROVIDER !== "polza") {
    if (process.env.AI_PROVIDER === "polza") {
      console.error("[AI CONFIG ERROR] POLZA_AI_API_KEY missing");
    }
    return manualReview({
      orderTotal: input.orderTotal,
      recipientName: input.recipientName,
      reasonRu: "ИИ временно недоступен, чек отправлен продавцу на ручную проверку.",
      summary: "ИИ-проверка чека не выполнена. Проверьте чек вручную.",
    });
  }

  const schema =
    "{\"extractedAmount\":number|null,\"expectedAmount\":number,\"amountMatches\":boolean|null,\"extractedDate\":\"string|null\",\"extractedRecipient\":\"string|null\",\"expectedRecipient\":\"string|null\",\"recipientMatches\":boolean|null,\"extractedBank\":\"string|null\",\"confidencePercent\":number,\"status\":\"LIKELY_VALID|MANUAL_REVIEW|LIKELY_INVALID\",\"reasonRu\":\"string\"}";
  const system = [
    "Ты проверяешь изображение банковского чека перевода для Telegram Mini App.",
    "Верни только JSON без markdown и пояснений.",
    "Не ставь заказ как оплаченный. Финальное решение принимает продавец.",
    `Схема строго такая: ${schema}.`,
    "confidencePercent укажи числом от 0 до 100.",
  ].join(" ");
  const user = [
    `Бизнес: ${input.businessName}.`,
    `Сумма заказа: ${input.orderTotal} RUB.`,
    `Получатель продавца: ${input.recipientName || "не указан"}.`,
    `Телефон/SBP продавца: ${input.paymentPhone || "не указан"}.`,
    `Банк продавца: ${input.bankName || "не указан"}.`,
    `Заказ создан: ${input.orderCreatedAt.toISOString()}.`,
    "Правила:",
    "1. Определи, похоже ли изображение на банковский чек.",
    "2. Извлеки сумму, дату, получателя и банк, если они читаются.",
    "3. LIKELY_VALID допустим только при совпадении суммы, нормальной дате и похожем получателе.",
    "4. Если данные неполные или изображение читается плохо, верни MANUAL_REVIEW.",
    "5. Если сумма не совпадает, верни LIKELY_INVALID.",
    "6. В reasonRu кратко по-русски укажи факты, сомнения или несовпадения.",
    "7. Не подтверждай оплату и не принимай финальное решение за продавца.",
  ].join("\n");

  const provider = new PolzaAIProvider(
    apiKey,
    process.env.POLZA_VISION_MODEL || process.env.POLZA_IMAGE_MODEL || process.env.POLZA_TEXT_MODEL
  );
  let raw = "";

  try {
    raw = await provider.analyzeImageJson({
      imageUrl: input.imageUrl,
      system,
      user,
      model: process.env.POLZA_VISION_MODEL || process.env.POLZA_IMAGE_MODEL,
    });

    return toResult(
      safeParseAiJson(raw, validatePaymentProofAnalysisJson),
      input.orderTotal,
      input.recipientName || null,
      input.orderCreatedAt
    );
  } catch (firstError) {
    console.error("[PAYMENT PROOF AI] parse/request failed", {
      error: firstError,
      raw,
      endpoint: getPolzaChatEndpoint(),
      model: process.env.POLZA_VISION_MODEL || process.env.POLZA_IMAGE_MODEL,
    });

    if (raw) {
      try {
        const repaired = await new PolzaAIProvider(apiKey, process.env.POLZA_TEXT_MODEL).generateStrictJson({
          system,
          user: [
            "Исправь этот ответ в валидный JSON строго по схеме анализа чека:",
            schema,
            "Верни только JSON.",
            raw,
          ].join("\n"),
        });
        return toResult(
          safeParseAiJson(repaired, validatePaymentProofAnalysisJson),
          input.orderTotal,
          input.recipientName || null,
          input.orderCreatedAt
        );
      } catch (repairError) {
        console.error("[PAYMENT PROOF AI] repair failed", {
          error: repairError,
          rawPreview: aiRawPreview(raw),
        });
      }
    }

    return manualReview({
      orderTotal: input.orderTotal,
      recipientName: input.recipientName,
      reasonRu: raw
        ? "ИИ не смог прочитать или проверить чек."
        : "ИИ временно недоступен, чек отправлен продавцу.",
      summary: raw
        ? "ИИ не смог проверить чек автоматически. Проверьте чек вручную."
        : "ИИ временно недоступен, чек отправлен продавцу.",
    });
  }
}
