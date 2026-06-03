import { PolzaAIProvider } from "@/lib/ai/polza-provider";

export type NoticeKind =
  | "booking_expired_customer"
  | "booking_expired_seller"
  | "pickup_order_expired_customer"
  | "pickup_order_expired_seller";

type NoticeInput = {
  kind: NoticeKind;
  timeText?: string;
  orderCode?: string;
  businessName?: string;
};

const bookingReason = "Клиент не пришёл в течение 5 минут после назначенного времени";
const pickupReason = "Заказ самовывоза не был забран в течение 24 часов";

export function fallbackNotice(input: NoticeInput) {
  const time = input.timeText || "назначенное время";
  const orderCode = input.orderCode || "заказ";

  if (input.kind === "booking_expired_customer") {
    return `Ваша запись на ${time} была снята, так как прошло 5 минут после назначенного времени. Вы можете записаться заново.`;
  }

  if (input.kind === "booking_expired_seller") {
    return `Клиент не пришёл на запись ${time}. Бронь автоматически снята, слот снова доступен.`;
  }

  if (input.kind === "pickup_order_expired_customer") {
    return "Ваш заказ самовывоза истёк, так как не был забран в течение 24 часов. Вы можете оформить заказ заново.";
  }

  return `Заказ самовывоза #${orderCode} автоматически переведён в EXPIRED, так как не был забран за 24 часа.`;
}

function noticeEvent(kind: NoticeKind) {
  switch (kind) {
    case "booking_expired_customer":
      return "запись клиента автоматически снята как no-show";
    case "booking_expired_seller":
      return "клиент не пришёл, запись автоматически снята";
    case "pickup_order_expired_customer":
      return "заказ самовывоза автоматически истёк";
    case "pickup_order_expired_seller":
      return "pickup-заказ автоматически переведён в EXPIRED";
  }
}

function facts(input: NoticeInput) {
  return [
    input.businessName ? `Бизнес: ${input.businessName}` : "",
    input.timeText ? `Время записи: ${input.timeText}` : "",
    input.orderCode ? `Номер заказа: #${input.orderCode}` : "",
    input.kind.includes("booking") ? `Причина: ${bookingReason}` : `Причина: ${pickupReason}`,
  ].filter(Boolean).join("; ");
}

function normalizeNotice(text: string, fallback: string) {
  const normalized = text
    .replace(/^```(?:text)?/i, "")
    .replace(/```$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalized ? normalized.slice(0, 400) : fallback;
}

export async function generateNotice(input: NoticeInput) {
  const fallback = fallbackNotice(input);
  const provider = (process.env.AI_PROVIDER || "mock").toLowerCase();

  if (provider !== "polza") {
    if (provider !== "mock") {
      console.warn(`[AI Notice] Unsupported AI_PROVIDER=${provider}; using fallback notice template.`);
    }
    return fallback;
  }

  const key = process.env.POLZA_AI_API_KEY;
  if (!key) {
    console.error("[AI Notice] AI_PROVIDER=polza but POLZA_AI_API_KEY is missing. Using fallback notice template.");
    return fallback;
  }

  try {
    const model = process.env.POLZA_TEXT_MODEL || "z-ai/glm-4.7-flash";
    const providerClient = new PolzaAIProvider(key, model);
    const message = await providerClient.generateNotice({
      recipient: input.kind.endsWith("_seller") ? "seller" : "customer",
      event: noticeEvent(input.kind),
      facts: facts(input),
      fallback,
    });
    return normalizeNotice(message, fallback);
  } catch (error) {
    console.warn("[AI Notice] Polza AI unavailable. Using fallback notice template.", error);
    return fallback;
  }
}

export const noticeReasons = {
  booking: bookingReason,
  pickupOrder: pickupReason,
} as const;
