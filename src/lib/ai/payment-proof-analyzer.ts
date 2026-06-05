import { PolzaAIProvider, getPolzaChatEndpoint } from "@/lib/ai/polza-provider";
import {
  PaymentProofAnalysisJson,
  aiRawPreview,
  safeParseAiJson,
  validatePaymentProofAnalysisJson,
} from "@/lib/ai/safe-ai-json";

export type PaymentProofAnalysisResult = PaymentProofAnalysisJson & {
  status: "LIKELY_VALID" | "SUSPICIOUS" | "INVALID" | "UNREADABLE" | "AI_UNAVAILABLE";
  summary: string;
};

function toResult(analysis: PaymentProofAnalysisJson, orderTotal: number): PaymentProofAnalysisResult {
  const amountMismatch = analysis.amount !== null && Math.abs(analysis.amount - orderTotal) > 1;
  const status = !analysis.isReceipt
    ? "INVALID"
    : amountMismatch || analysis.confidence < 60
      ? "SUSPICIOUS"
      : "LIKELY_VALID";

  return {
    ...analysis,
    status,
    summary: amountMismatch
      ? `${analysis.comment} Сумма на чеке не совпадает с суммой заказа.`
      : analysis.comment,
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
      isReceipt: false,
      amount: null,
      date: null,
      confidence: 0,
      comment: "ИИ временно недоступен, чек отправлен продавцу.",
      summary: "ИИ-проверка чека не выполнена. Проверьте чек вручную.",
    };
  }

  const system = [
    "Ты проверяешь изображение банковского чека перевода для Telegram Mini App.",
    "Верни только JSON без markdown и пояснений.",
    "Не ставь заказ как оплаченный. Финальное решение принимает продавец.",
    "Схема строго такая: {\"isReceipt\":true,\"amount\":number|null,\"date\":\"string|null\",\"confidence\":number,\"comment\":\"string\"}.",
    "confidence укажи числом от 0 до 100.",
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
    "2. Извлеки сумму и дату, если они читаются.",
    "3. В comment кратко укажи сомнения, несовпадения или причину низкой уверенности.",
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
            "{\"isReceipt\":true,\"amount\":number|null,\"date\":\"string|null\",\"confidence\":number,\"comment\":\"string\"}",
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
      status: raw ? "UNREADABLE" : "AI_UNAVAILABLE",
      isReceipt: false,
      amount: null,
      date: null,
      confidence: 0,
      comment: raw ? "ИИ не смог прочитать или проверить чек." : "ИИ временно недоступен, чек отправлен продавцу.",
      summary: raw ? "ИИ не смог проверить чек автоматически. Проверьте чек вручную." : "ИИ временно недоступен, чек отправлен продавцу.",
    };
  }
}
