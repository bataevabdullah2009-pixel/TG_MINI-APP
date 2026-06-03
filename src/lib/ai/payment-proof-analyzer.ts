import { PolzaAIProvider, getPolzaChatEndpoint } from "@/lib/ai/polza-provider";
import {
  PaymentProofAnalysisJson,
  aiRawPreview,
  safeParseAiJson,
  validatePaymentProofAnalysisJson,
} from "@/lib/ai/safe-ai-json";

export async function analyzePaymentProof(input: {
  imageUrl: string;
  orderTotal: number;
  businessName: string;
  recipientName?: string | null;
  paymentPhone?: string | null;
  bankName?: string | null;
  orderCreatedAt: Date;
}): Promise<PaymentProofAnalysisJson> {
  const apiKey = process.env.POLZA_AI_API_KEY;
  if (!apiKey || process.env.AI_PROVIDER !== "polza") {
    if (process.env.AI_PROVIDER === "polza") {
      console.error("[AI CONFIG ERROR] POLZA_AI_API_KEY missing");
    }
    return {
      status: "UNREADABLE",
      confidence: 0,
      amountFound: null,
      dateFound: null,
      recipientFound: null,
      phoneOrCardFound: null,
      bankFound: null,
      problems: ["Автоматическая проверка чека не настроена."],
      summary: "ИИ-проверка чека не выполнена. Проверьте чек вручную.",
    };
  }

  const system = [
    "Ты проверяешь изображение банковского чека перевода для Telegram Mini App.",
    "Верни только JSON без markdown и пояснений.",
    "Не ставь заказ как оплаченный. Финальное решение принимает продавец.",
    "Схема: {\"status\":\"LIKELY_VALID|SUSPICIOUS|INVALID|UNREADABLE\",\"confidence\":0,\"amountFound\":null,\"dateFound\":null,\"recipientFound\":null,\"phoneOrCardFound\":null,\"bankFound\":null,\"problems\":[\"string\"],\"summary\":\"string\"}",
  ].join(" ");

  const user = [
    `Бизнес: ${input.businessName}.`,
    `Сумма заказа: ${input.orderTotal} RUB.`,
    `Получатель продавца: ${input.recipientName || "не указан"}.`,
    `Телефон/SBP продавца: ${input.paymentPhone || "не указан"}.`,
    `Банк продавца: ${input.bankName || "не указан"}.`,
    `Заказ создан: ${input.orderCreatedAt.toISOString()}.`,
    "Правила:",
    "1. Если сумма не совпадает с orderTotal, верни SUSPICIOUS или INVALID.",
    "2. Если дата явно старая или не подходит ко времени заказа, верни SUSPICIOUS.",
    "3. Если получатель/банк/номер не похожи на реквизиты продавца, верни SUSPICIOUS.",
    "4. Если изображение не чек, верни INVALID.",
    "5. Если текст не читается, верни UNREADABLE.",
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

    return safeParseAiJson(raw, validatePaymentProofAnalysisJson);
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
            "{\"status\":\"LIKELY_VALID|SUSPICIOUS|INVALID|UNREADABLE\",\"confidence\":0,\"amountFound\":null,\"dateFound\":null,\"recipientFound\":null,\"phoneOrCardFound\":null,\"bankFound\":null,\"problems\":[\"string\"],\"summary\":\"string\"}",
            "Верни только JSON.",
            raw,
          ].join("\n"),
        });
        return safeParseAiJson(repaired, validatePaymentProofAnalysisJson);
      } catch (repairError) {
        console.error("[PAYMENT PROOF AI] repair failed", {
          error: repairError,
          rawPreview: aiRawPreview(raw),
        });
      }
    }

    return {
      status: "UNREADABLE",
      confidence: 0,
      amountFound: null,
      dateFound: null,
      recipientFound: null,
      phoneOrCardFound: null,
      bankFound: null,
      problems: ["ИИ не смог прочитать или проверить чек."],
      summary: "ИИ не смог проверить чек автоматически. Проверьте чек вручную.",
    };
  }
}
