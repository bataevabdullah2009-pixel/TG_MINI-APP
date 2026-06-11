export type CustomerIntent =
  | "product_search"
  | "order_status"
  | "payment_question"
  | "delivery_question"
  | "booking_question"
  | "fallback";

export type CustomerIntentResult = {
  intent: CustomerIntent;
  query: string;
  confidence: number;
};

const STOP_WORDS = new Set([
  "есть",
  "ли",
  "у",
  "вас",
  "в",
  "наличии",
  "сейчас",
  "товар",
  "товары",
  "найди",
  "покажи",
  "можно",
  "купить",
  "заказать",
  "нужен",
  "нужна",
  "нужно",
]);

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, markers: string[]) {
  return markers.some((marker) => text.includes(marker));
}

function productQuery(text: string) {
  const query = normalize(text)
    .split(" ")
    .filter((word) => !STOP_WORDS.has(word))
    .join(" ")
    .trim();
  return query || normalize(text);
}

export function routeCustomerIntent(text: string): CustomerIntentResult {
  const normalized = normalize(text);

  if (includesAny(normalized, ["где заказ", "статус заказ", "мой заказ", "что с заказ", "когда заказ"])) {
    return { intent: "order_status", query: normalized, confidence: 0.96 };
  }
  if (includesAny(normalized, ["оплат", "перевод", "чек", "реквизит", "наличн"])) {
    return { intent: "payment_question", query: normalized, confidence: 0.93 };
  }
  if (includesAny(normalized, ["достав", "курьер", "привез", "самовывоз", "район"])) {
    return { intent: "delivery_question", query: normalized, confidence: 0.93 };
  }
  if (includesAny(normalized, ["запис", "брон", "мастер", "перенести запись", "отменить запись"])) {
    return { intent: "booking_question", query: normalized, confidence: 0.93 };
  }

  const productMarkers = ["есть ", "найди ", "покажи ", "в наличии", "купить ", "заказать "];
  const words = normalized.split(" ").filter(Boolean);
  if (includesAny(normalized, productMarkers) || (words.length > 0 && words.length <= 4)) {
    return { intent: "product_search", query: productQuery(normalized), confidence: includesAny(normalized, productMarkers) ? 0.92 : 0.72 };
  }

  return { intent: "fallback", query: normalized, confidence: 0.55 };
}
