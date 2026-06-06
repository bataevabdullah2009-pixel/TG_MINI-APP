import { PolzaAIProvider, getPolzaChatEndpoint } from "@/lib/ai/polza-provider";
import {
  PaymentProofAnalysisJson,
  aiRawPreview,
  safeParseAiJson,
  validatePaymentProofAnalysisJson,
} from "@/lib/ai/safe-ai-json";

export type PaymentProofAnalysisResult = PaymentProofAnalysisJson & {
  status: "LIKELY_VALID" | "MANUAL_REVIEW" | "AI_UNAVAILABLE";
  summary: string;
};

function toResult(analysis: PaymentProofAnalysisJson, orderTotal: number): PaymentProofAnalysisResult {
  const amountMismatch = analysis.amount === null || Math.abs(analysis.amount - orderTotal) > 1;
  const status = analysis.valid && !amountMismatch && analysis.confidence >= 0.85
    ? "LIKELY_VALID"
    : "MANUAL_REVIEW";

  return {
    ...analysis,
    status,
    summary: amountMismatch
      ? `${analysis.reason} Сумма чека не совпала с суммой заказа или не распознана.`
      : analysis.reason,
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
    return {
      status: "AI_UNAVAILABLE",
      valid: false,
      amount: null,
      date: null,
      receiver: null,
      confidence: 0,
      reason: "ИИ временно недоступен.",
      summary: "ИИ-проверка чека не выполнена. Проверьте чек вручную.",
    };
  }

  const system = [
    "Ты проверяешь изображение банковского чека перевода для Telegram Mini App.",
    "Верни только JSON без markdown и пояснений.",
    "Не ставь заказ как оплаченный. Финальное решение принимает продавец.",
    "Форма JSON строго такая: {\"valid\":true,\"amount\":1250.5,\"date\":\"2026-06-06\",\"receiver\":\"Имя получателя\",\"confidence\":0.95,\"reason\":\"Краткая причина\"}.",
    "Если значение amount, date или receiver не удалось извлечь, верни null в соответствующем поле.",
    "confidence укажи числом от 0 до 1.",
  ].join(" ");

  const user = [
    `Бизнес: ${input.businessName}.`,
    `Сумма заказа: ${input.orderTotal} RUB.`,
    `Получатель продавца: ${input.recipientName || "не указан"}.`,
    `Телефон/SBP продавца: ${input.paymentPhone || "не указан"}.`,
    `Банк продавца: ${input.bankName || "не указан"}.`,
    `Заказ создан: ${input.orderCreatedAt.toISOString()}.`,
    "Правила:",
    "1. valid=true только если файл похож на настоящий банковский чек и ключевые данные читаются.",
    "2. Извлеки сумму, дату и получателя. Не додумывай отсутствующие значения.",
    "3. В reason кратко укажи сомнения, несовпадения или причину низкой уверенности.",
    "4. Не подтверждай оплату и не принимай финальное решение за продавца.",
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

    return toResult(safeParseAiJson(raw, validatePaymentProofAnalysisJson), input.orderTotal);
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
            "{\"valid\":false,\"amount\":null,\"date\":null,\"receiver\":null,\"confidence\":0,\"reason\":\"Краткая причина\"}",
            "Верни только JSON.",
            raw,
          ].join("\n"),
        });
        return toResult(safeParseAiJson(repaired, validatePaymentProofAnalysisJson), input.orderTotal);
      } catch (repairError) {
        console.error("[PAYMENT PROOF AI] repair failed", {
          error: repairError,
          rawPreview: aiRawPreview(raw),
        });
      }
    }

    return {
      status: raw ? "MANUAL_REVIEW" : "AI_UNAVAILABLE",
      valid: false,
      amount: null,
      date: null,
      receiver: null,
      confidence: 0,
      reason: raw ? "ИИ не смог уверенно прочитать чек." : "ИИ временно недоступен.",
      summary: raw ? "ИИ не смог проверить чек автоматически. Проверьте чек вручную." : "ИИ временно недоступен, чек отправлен продавцу.",
    };
  }
}
