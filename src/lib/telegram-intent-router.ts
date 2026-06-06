import { prisma } from "@/lib/prisma";
import { buildBusinessUrl } from "@/lib/production-url";

type CatalogItem = {
  name: string;
  price: number;
  category: { name: string } | null;
};

type DeliveryZone = {
  name: string;
  cityArea: string;
  fee: number;
  estimatedMinutes: number | null;
};

type IntentBusiness = {
  id: string;
  slug: string;
  name: string;
  settings?: {
    deliveryEnabled: boolean;
    pickupEnabled: boolean;
    bookingEnabled: boolean;
  } | null;
  deliveryZones?: DeliveryZone[];
};

type RouteTelegramIntentInput = {
  text: string;
  business: IntentBusiness;
  customerId?: string | null;
  customerPhone?: string | null;
  catalogItems: CatalogItem[];
};

export type TelegramIntentResponse = {
  kind: "availability" | "order" | "status" | "delivery" | "booking";
  message: string;
  buttonText?: string;
  buttonUrl?: string;
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  NEW: "создан",
  ACCEPTED: "принят продавцом",
  PREPARING: "готовится",
  READY_FOR_PICKUP: "готов к самовывозу",
  READY_FOR_DELIVERY: "готов к передаче курьеру",
  COURIER_ASSIGNED: "курьер назначен",
  PICKED_UP: "забран курьером",
  DELIVERED: "доставлен",
  READY: "готов",
  DELIVERING: "доставляется",
  COMPLETED: "выполнен",
  CANCELLED: "отменён",
  EXPIRED: "истёк",
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, markers: string[]) {
  return markers.some((marker) => text.includes(marker));
}

function extractAvailabilityQuery(text: string) {
  const cleaned = text
    .replace(/\b(есть|ли|у|вас|в|наличии|сейчас|товар|товары|продаете|продаётся|продается)\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 2 ? cleaned : "";
}

function findCatalogMatches(query: string, items: CatalogItem[]) {
  if (!query) return [];
  const queryWords = normalizeText(query).split(" ").filter((word) => word.length > 1);

  return items.filter((item) => {
    const haystack = normalizeText(`${item.name} ${item.category?.name || ""}`);
    return queryWords.every((word) => haystack.includes(word));
  });
}

export async function routeTelegramBusinessIntent(
  input: RouteTelegramIntentInput
): Promise<TelegramIntentResponse | null> {
  const normalized = normalizeText(input.text);
  const storeUrl = buildBusinessUrl(input.business.slug);

  if (includesAny(normalized, ["статус заказа", "где заказ", "что с заказом", "мой заказ"])) {
    const identityFilters = [
      input.customerId ? { customerId: input.customerId } : null,
      input.customerPhone ? { customerPhone: input.customerPhone } : null,
    ].filter(Boolean) as Array<{ customerId: string } | { customerPhone: string }>;

    if (identityFilters.length === 0) {
      return {
        kind: "status",
        message: "Не нашёл подтверждённый номер телефона. Откройте Mini App и проверьте заказ в профиле.",
        buttonText: "Открыть магазин",
        buttonUrl: storeUrl,
      };
    }

    const order = await prisma.order.findFirst({
      where: {
        businessId: input.business.id,
        OR: identityFilters,
      },
      select: {
        id: true,
        status: true,
        deliveryStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!order) {
      return {
        kind: "status",
        message: `В ${input.business.name} заказов для этого аккаунта пока нет.`,
        buttonText: "Открыть магазин",
        buttonUrl: storeUrl,
      };
    }

    return {
      kind: "status",
      message: `Последний заказ №${order.id.slice(-6).toUpperCase()}: ${ORDER_STATUS_LABELS[order.status] || "обрабатывается"}.`,
      buttonText: "Открыть заказы",
      buttonUrl: storeUrl,
    };
  }

  if (includesAny(normalized, ["доставка", "доставляете", "зона доставки", "стоимость доставки"])) {
    if (!input.business.settings?.deliveryEnabled) {
      return {
        kind: "delivery",
        message: `У ${input.business.name} доставка сейчас недоступна. Можно выбрать самовывоз.`,
        buttonText: "Открыть магазин",
        buttonUrl: storeUrl,
      };
    }

    const zones = input.business.deliveryZones || [];
    const zoneText = zones.length
      ? zones
          .slice(0, 5)
          .map((zone) => `${zone.name}: ${zone.fee} ₽${zone.estimatedMinutes ? `, около ${zone.estimatedMinutes} мин.` : ""}`)
          .join("; ")
      : "Зоны и стоимость будут показаны при оформлении.";

    return {
      kind: "delivery",
      message: `Доставка ${input.business.name}. ${zoneText}`,
      buttonText: "Оформить доставку",
      buttonUrl: storeUrl,
    };
  }

  if (includesAny(normalized, ["записаться", "запись", "забронировать", "бронирование"])) {
    if (!input.business.settings?.bookingEnabled) {
      return {
        kind: "booking",
        message: `${input.business.name} не принимает запись. Товары можно заказать в Mini App.`,
        buttonText: "Открыть магазин",
        buttonUrl: storeUrl,
      };
    }

    return {
      kind: "booking",
      message: `Записаться в ${input.business.name} можно через Mini App.`,
      buttonText: "Записаться",
      buttonUrl: storeUrl,
    };
  }

  const availabilityIntent = includesAny(normalized, [
    "есть ли",
    "в наличии",
    "у вас есть",
    "продаете",
    "продаётся",
    "продается",
  ]);
  if (availabilityIntent) {
    const query = extractAvailabilityQuery(normalized);
    const matches = findCatalogMatches(query, input.catalogItems);

    if (matches.length === 0) {
      return {
        kind: "availability",
        message: query
          ? `В каталоге ${input.business.name} такого товара сейчас нет.`
          : `Уточните название товара. Я проверю каталог ${input.business.name}.`,
        buttonText: "Открыть каталог",
        buttonUrl: storeUrl,
      };
    }

    return {
      kind: "availability",
      message: `В наличии: ${matches
        .slice(0, 5)
        .map((item) => `${item.name} — ${item.price} ₽`)
        .join(", ")}.`,
      buttonText: "Открыть каталог",
      buttonUrl: storeUrl,
    };
  }

  if (includesAny(normalized, ["хочу заказать", "сделать заказ", "оформить заказ", "заказать"])) {
    return {
      kind: "order",
      message: `Заказ в ${input.business.name} можно оформить в Mini App.`,
      buttonText: "Оформить заказ",
      buttonUrl: storeUrl,
    };
  }

  return null;
}
