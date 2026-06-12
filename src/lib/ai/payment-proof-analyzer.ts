import { PolzaAIProvider, getPolzaChatEndpoint } from "@/lib/ai/polza-provider";
import {
  PaymentProofAnalysisJson,
  aiRawPreview,
  safeParseAiJson,
  validatePaymentProofAnalysisJson,
} from "@/lib/ai/safe-ai-json";

export type PaymentProofAiStatus =
  | "MANUAL_REVIEW"
  | "LIKELY_VALID"
  | "LIKELY_INVALID"
  | "AI_FAILED";

export type PaymentProofAnalysisResult = Omit<PaymentProofAnalysisJson, "status"> & {
  status: PaymentProofAiStatus;
  summary: string;
};

export const PAYMENT_PROOF_CONFIG_SUMMARY =
  "Нужна ручная проверка: ИИ-проверка сейчас не настроена.";

export function isPaymentProofAiConfigured() {
  return Boolean(process.env.POLZA_AI_API_KEY) &&
    (process.env.AI_PROVIDER || "").trim().toLowerCase() === "polza";
}

function normalizedText(value?: string | null) {
  return (value || "").toLowerCase().replace(/[^a-zа-яё0-9]/gi, "");
}

function toResult(
  analysis: PaymentProofAnalysisJson,
  orderTotal: number,
  expectedRecipient?: string | null
): PaymentProofAnalysisResult {
  const amountMatches = analysis.extractedAmount === null
    ? null
    : Math.abs(analysis.extractedAmount - orderTotal) <= 1;
  const expectedRecipientNormalized = normalizedText(expectedRecipient);
  const extractedRecipientNormalized = normalizedText(analysis.extractedRecipient);
  const recipientMatches = !expectedRecipientNormalized || !extractedRecipientNormalized
    ? null
    : extractedRecipientNormalized.includes(expectedRecipientNormalized) ||
      expectedRecipientNormalized.includes(extractedRecipientNormalized);
  const status = amountMatches === false || recipientMatches === false
    ? "LIKELY_INVALID"
    : amountMatches === true && analysis.confidencePercent >= 70
      ? "LIKELY_VALID"
      : "MANUAL_REVIEW";
  const reasonRu = amountMatches === false
    ? "Сумма на чеке не совпадает с суммой заказа."
    : status === "LIKELY_VALID"
      ? "Чек похож на корректный, но подтвердите вручную."
      : analysis.reasonRu || "ИИ не смог прочитать чек. Проверьте оплату вручную.";

  return {
    ...analysis,
    expectedAmount: orderTotal,
    expectedRecipient: expectedRecipient || null,
    amountMatches,
    recipientMatches,
    status,
    reasonRu,
    summary: reasonRu,
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
  mimeType?: string | null;
}): Promise<PaymentProofAnalysisResult> {
  const apiKey = process.env.POLZA_AI_API_KEY;
  const providerName = (process.env.AI_PROVIDER || "").trim().toLowerCase();
  if (!isPaymentProofAiConfigured() || !apiKey) {
    if (providerName === "polza") {
      console.error("[AI CONFIG ERROR] POLZA_AI_API_KEY missing");
    } else {
      console.error("[AI CONFIG ERROR] Payment proof analysis requires AI_PROVIDER=polza", {
        configuredProvider: providerName || null,
      });
    }
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
      reasonRu: "ИИ-проверка недоступна из-за конфигурации. Проверьте оплату вручную.",
      summary: PAYMENT_PROOF_CONFIG_SUMMARY,
    };
  }

  const system = [
    "Ты проверяешь изображение банковского чека перевода для Telegram Mini App.",
    "Верни только JSON без markdown и пояснений.",
    "Не ставь заказ как оплаченный. Финальное решение принимает продавец.",
    "Схема строго такая: {\"extractedAmount\":number|null,\"expectedAmount\":number,\"amountMatches\":boolean|null,\"extractedDate\":\"string|null\",\"extractedRecipient\":\"string|null\",\"expectedRecipient\":\"string|null\",\"recipientMatches\":boolean|null,\"extractedBank\":\"string|null\",\"confidencePercent\":number,\"status\":\"LIKELY_VALID|MANUAL_REVIEW|LIKELY_INVALID\",\"reasonRu\":\"string\"}.",
    "confidencePercent укажи числом от 0 до 100.",
  ].join(" ");

  const user = [
    `Бизнес: ${input.businessName}.`,
    `Сумма заказа: ${input.orderTotal} RUB.`,
    `Получатель продавца: ${input.recipientName || "не указан"}.`,
    `Телефон/SBP продавца: ${input.paymentPhone || "не указан"}.`,
    `Банк продавца: ${input.bankName || "не указан"}.`,
    `Формат файла: ${input.mimeType || "не указан"}.`,
    `Заказ создан: ${input.orderCreatedAt.toISOString()}.`,
    "Правила:",
    "1. Определи, похож ли файл на банковский чек.",
    "2. Извлеки сумму, дату, получателя и банк, если они читаются.",
    "3. Сравни сумму и получателя только с переданными ожидаемыми значениями.",
    "4. В reasonRu кратко укажи сомнения, несовпадения или причину низкой уверенности.",
    "5. Не подтверждай оплату и не принимай финальное решение за продавца.",
  ].join("\n");

  const provider = new PolzaAIProvider(apiKey, process.env.POLZA_VISION_MODEL || process.env.POLZA_IMAGE_MODEL || process.env.POLZA_TEXT_MODEL);
  let raw = "";

  try {
    raw = await provider.analyzeImageJson({
      imageUrl: input.imageUrl,
      system,
      user,
      model: process.env.POLZA_VISION_MODEL || process.env.POLZA_IMAGE_MODEL,
    });

    return toResult(safeParseAiJson(raw, validatePaymentProofAnalysisJson), input.orderTotal, input.recipientName);
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
            "{\"extractedAmount\":number|null,\"expectedAmount\":number,\"amountMatches\":boolean|null,\"extractedDate\":\"string|null\",\"extractedRecipient\":\"string|null\",\"expectedRecipient\":\"string|null\",\"recipientMatches\":boolean|null,\"extractedBank\":\"string|null\",\"confidencePercent\":number,\"status\":\"LIKELY_VALID|MANUAL_REVIEW|LIKELY_INVALID\",\"reasonRu\":\"string\"}",
            "Верни только JSON.",
            raw,
          ].join("\n"),
        });
        return toResult(safeParseAiJson(repaired, validatePaymentProofAnalysisJson), input.orderTotal, input.recipientName);
      } catch (repairError) {
        console.error("[PAYMENT PROOF AI] repair failed", {
          error: repairError,
          rawPreview: aiRawPreview(raw),
        });
      }
    }

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
      status: "AI_FAILED",
      reasonRu: "ИИ не смог проверить чек. Проверьте оплату вручную.",
      summary: "ИИ не смог проверить чек. Проверьте оплату вручную.",
    };
  }
}
