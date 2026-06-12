import { PolzaAIProvider, getPolzaChatEndpoint } from "@/lib/ai/polza-provider";
import {
  PaymentProofAnalysisJson,
  aiRawPreview,
  safeParseAiJson,
  validatePaymentProofAnalysisJson,
} from "@/lib/ai/safe-ai-json";

export type PaymentProofAiStatus =
  | "MANUAL_REVIEW"
  | "AMOUNT_MATCHED"
  | "AMOUNT_MISMATCH"
  | "AI_FAILED";

export type PaymentProofAnalysisResult = PaymentProofAnalysisJson & {
  status: PaymentProofAiStatus;
  summary: string;
};

export const PAYMENT_PROOF_CONFIG_SUMMARY =
  "Нужна ручная проверка: ИИ-проверка сейчас не настроена.";

export function isPaymentProofAiConfigured() {
  return Boolean(process.env.POLZA_AI_API_KEY) &&
    (process.env.AI_PROVIDER || "").trim().toLowerCase() === "polza";
}

function toResult(
  analysis: PaymentProofAnalysisJson,
  orderTotal: number
): PaymentProofAnalysisResult {
  const match = analysis.extractedAmount !== null &&
    Math.abs(analysis.extractedAmount - orderTotal) <= 1;
  const status = analysis.extractedAmount === null
    ? "MANUAL_REVIEW"
    : match
      ? "AMOUNT_MATCHED"
      : "AMOUNT_MISMATCH";
  const comment = analysis.extractedAmount === null
    ? "Сумма на чеке не распознана. Нужна ручная проверка."
    : !match
      ? "Сумма на чеке не совпадает с суммой заказа."
      : analysis.comment || "Сумма совпадает. Подтвердите оплату вручную.";

  return {
    ...analysis,
    expectedAmount: orderTotal,
    match,
    status,
    comment,
    summary: comment,
  };
}

export async function analyzePaymentProof(input: {
  imageUrl: string;
  orderTotal: number;
  businessName: string;
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
      match: false,
      confidence: 0,
      status: "MANUAL_REVIEW",
      comment: "ИИ-проверка недоступна. Проверьте сумму вручную.",
      summary: PAYMENT_PROOF_CONFIG_SUMMARY,
    };
  }

  const schema =
    "{\"extractedAmount\":number|null,\"expectedAmount\":number,\"match\":boolean,\"confidence\":number,\"comment\":\"string\"}";
  const system = [
    "Ты проверяешь изображение банковского чека перевода для Telegram Mini App.",
    "Верни только JSON без markdown и пояснений.",
    "Не ставь заказ как оплаченный. Финальное решение принимает продавец.",
    `Схема строго такая: ${schema}.`,
    "confidence укажи числом от 0 до 100, comment напиши кратко по-русски.",
  ].join(" ");

  const user = [
    `Бизнес: ${input.businessName}.`,
    `Сумма заказа: ${input.orderTotal} RUB.`,
    `Формат файла: ${input.mimeType || "не указан"}.`,
    "Правила:",
    "1. Найди итоговую сумму перевода на чеке.",
    "2. Сравни только сумму с ожидаемой суммой заказа.",
    "3. Не анализируй банк, получателя или дату.",
    "4. Не подтверждай оплату и не принимай финальное решение за продавца.",
  ].join("\n");

  const provider = new PolzaAIProvider(
    apiKey,
    process.env.POLZA_VISION_MODEL ||
      process.env.POLZA_IMAGE_MODEL ||
      process.env.POLZA_TEXT_MODEL
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
      input.orderTotal
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
        const repaired = await new PolzaAIProvider(
          apiKey,
          process.env.POLZA_TEXT_MODEL
        ).generateStrictJson({
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
          input.orderTotal
        );
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
      match: false,
      confidence: 0,
      status: "AI_FAILED",
      comment: "ИИ не смог распознать сумму. Проверьте чек вручную.",
      summary: "ИИ не смог проверить чек. Проверьте оплату вручную.",
    };
  }
}
