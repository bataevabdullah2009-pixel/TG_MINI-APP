import { Prisma, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMiniAppUrl } from "@/lib/production-url";

export type MarketplaceIntent =
  | "marketplace_list_businesses"
  | "business_info"
  | "product_search"
  | "delivery_info"
  | "payment_info"
  | "working_hours"
  | "order_status"
  | "booking_info"
  | "fallback";

type AgentButton = {
  text: string;
  url: string;
};

export type MarketplaceAgentResponse = {
  text: string;
  detectedIntent: MarketplaceIntent;
  toolsCalled: string[];
  responseSource: "database" | "rules";
  button?: AgentButton;
};

const ACTIVE_BUSINESS_FILTER: Prisma.BusinessWhereInput = {
  isActive: true,
  subscriptionStatus: { notIn: [SubscriptionStatus.BLOCKED, SubscriptionStatus.EXPIRED] },
};

const ORDER_STATUS_RU: Record<string, string> = {
  NEW: "новый",
  ACCEPTED: "принят",
  PREPARING: "готовится",
  READY: "готов",
  READY_FOR_PICKUP: "готов к самовывозу",
  READY_FOR_DELIVERY: "готов к доставке",
  COURIER_ASSIGNED: "курьер назначен",
  PICKED_UP: "передан курьеру",
  DELIVERING: "доставляется",
  DELIVERED: "доставлен",
  COMPLETED: "завершён",
  CANCELLED: "отменён",
  EXPIRED: "истёк",
};

const DAY_NAMES = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

function safeText(value: string | null | undefined) {
  return (value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[?!.,;:()[\]{}"«»]/g, " ").replace(/\s+/g, " ").trim();
}

function formatPrice(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function businessUrl(slug: string) {
  return getMiniAppUrl(`/app/${slug}`);
}

export function detectMarketplaceIntent(text: string): MarketplaceIntent {
  const normalized = normalizeText(text);

  if (/\b(заказ|заказы)\b/.test(normalized) && /\b(статус|где|мой|мои|готов|достав)\w*/.test(normalized)) {
    return "order_status";
  }
  if (/\b(доставк|зона|район|привез)\w*/.test(normalized)) return "delivery_info";
  if (/\b(оплат|перевод|наличн|карта|чек)\w*/.test(normalized)) return "payment_info";
  if (/\b(работаете|работает|открыт|закрыт|график|часы)\w*/.test(normalized)) return "working_hours";
  if (/\b(запис|брон|услуг|мастер)\w*/.test(normalized)) return "booking_info";
  if (
    /\b(какие|список|покажи)\b.*\b(магазин|бизнес|заведен)\w*/.test(normalized) ||
    normalized.includes("что есть в витрине")
  ) {
    return "marketplace_list_businesses";
  }
  if (/\b(адрес|телефон|контакт|о магазине|о бизнесе)\b/.test(normalized)) return "business_info";
  if (
    normalized === "что есть" ||
    normalized.includes("что есть у вас") ||
    normalized.includes("что есть в магазине") ||
    /\b(есть|найди|ищу|товар|цена|сколько стоит)\b/.test(normalized)
  ) {
    return "product_search";
  }
  return "fallback";
}

function extractProductQuery(text: string) {
  return normalizeText(text)
    .replace(/\b(есть ли у вас|у вас есть|есть ли|покажи|найди|ищу|нужен|нужна|нужно|товар|в наличии|сколько стоит)\b/g, " ")
    .replace(/\b(пожалуйста|сейчас)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function listActiveBusinesses(query?: string) {
  const normalizedQuery = query?.trim();
  return prisma.business.findMany({
    where: {
      ...ACTIVE_BUSINESS_FILTER,
      isDemo: false,
      ...(normalizedQuery
        ? {
            OR: [
              { name: { contains: normalizedQuery, mode: "insensitive" as const } },
              { description: { contains: normalizedQuery, mode: "insensitive" as const } },
              { slug: { contains: normalizedQuery, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      description: true,
      address: true,
      phone: true,
      isOpen: true,
    },
    orderBy: [{ isOpen: "desc" }, { name: "asc" }],
    take: 20,
  });
}

export async function getBusinessBySlug(slug: string) {
  return prisma.business.findFirst({
    where: {
      ...ACTIVE_BUSINESS_FILTER,
      OR: [
        { slug },
        { id: slug },
        { slug: { equals: slug, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      description: true,
      address: true,
      phone: true,
      isOpen: true,
    },
  });
}

const productSelect = {
  id: true,
  businessId: true,
  name: true,
  price: true,
  stock: true,
  isAvailable: true,
  isPopular: true,
  category: { select: { name: true } },
  business: { select: { slug: true, name: true } },
} as const;

type AgentProduct = Prisma.ItemGetPayload<{ select: typeof productSelect }>;

export async function searchProductsAcrossBusinesses(query: string): Promise<AgentProduct[]> {
  return prisma.item.findMany({
    where: {
      type: "PRODUCT",
      isAvailable: true,
      name: { contains: query, mode: "insensitive" },
      business: {
        ...ACTIVE_BUSINESS_FILTER,
        isDemo: false,
      },
    },
    select: productSelect,
    orderBy: [{ isPopular: "desc" }, { sortOrder: "asc" }],
    take: 5,
  });
}

export async function searchProductsInBusiness(businessId: string, query: string): Promise<AgentProduct[]> {
  return prisma.item.findMany({
    where: {
      businessId,
      type: "PRODUCT",
      isAvailable: true,
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    select: productSelect,
    orderBy: [{ isPopular: "desc" }, { sortOrder: "asc" }],
    take: 5,
  });
}

export async function getBusinessDeliveryInfo(businessId: string) {
  return prisma.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      phone: true,
      settings: { select: { deliveryEnabled: true, deliveryFee: true, deliveryTime: true } },
      deliveryZones: {
        where: { isActive: true },
        select: { name: true, cityArea: true, fee: true, estimatedMinutes: true },
        orderBy: { fee: "asc" },
        take: 20,
      },
    },
  });
}

export async function getBusinessPaymentMethods(businessId: string) {
  return prisma.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      transferPaymentEnabled: true,
      transferBankName: true,
      transferPaymentInstructions: true,
    },
  });
}

export async function getBusinessWorkingHours(businessId: string) {
  return prisma.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      isOpen: true,
      workingHours: {
        select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true },
        orderBy: { dayOfWeek: "asc" },
      },
    },
  });
}

export async function getCustomerOrders(telegramUserId: string) {
  return prisma.order.findMany({
    where: {
      customer: { telegramUserId: BigInt(telegramUserId) },
    },
    select: {
      id: true,
      status: true,
      totalPrice: true,
      createdAt: true,
      business: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}

export async function getOrderStatus(orderCode: string, telegramUserId: string) {
  const normalizedCode = orderCode.replace(/^#/, "").trim();
  return prisma.order.findFirst({
    where: {
      customer: { telegramUserId: BigInt(telegramUserId) },
      OR: [
        { id: normalizedCode },
        { id: { endsWith: normalizedCode, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      status: true,
      totalPrice: true,
      createdAt: true,
      deliveryType: true,
      business: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function getBookingInfo(businessId: string) {
  return prisma.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      phone: true,
      settings: { select: { bookingEnabled: true } },
      items: {
        where: { type: "SERVICE", isAvailable: true },
        select: { name: true, price: true, durationMinutes: true },
        orderBy: [{ isPopular: "desc" }, { sortOrder: "asc" }],
        take: 5,
      },
    },
  });
}

function businessesResponse(businesses: Awaited<ReturnType<typeof listActiveBusinesses>>): MarketplaceAgentResponse {
  if (businesses.length === 0) {
    return {
      text: "Сейчас в Vitrina AI нет доступных магазинов.",
      detectedIntent: "marketplace_list_businesses",
      toolsCalled: ["listActiveBusinesses"],
      responseSource: "database",
      button: { text: "Открыть Vitrina AI", url: getMiniAppUrl() },
    };
  }

  return {
    text: [
      "Активные магазины в Vitrina AI:",
      ...businesses.slice(0, 10).map((item, index) =>
        `${index + 1}. ${safeText(item.name)} — ${item.isOpen ? "открыто" : "закрыто"}${item.address ? `, ${safeText(item.address)}` : ""}`
      ),
      "Выберите магазин в Mini App, чтобы посмотреть каталог.",
    ].join("\n"),
    detectedIntent: "marketplace_list_businesses",
    toolsCalled: ["listActiveBusinesses"],
    responseSource: "database",
    button: { text: "Открыть список магазинов", url: getMiniAppUrl() },
  };
}

export async function runTelegramMarketplaceAgent(input: {
  text: string;
  telegramUserId: string;
  business?: { id: string; slug: string; name: string; description?: string | null; phone?: string | null; address?: string | null } | null;
}): Promise<MarketplaceAgentResponse> {
  const detectedIntent = detectMarketplaceIntent(input.text);
  const business = input.business || null;

  if (detectedIntent === "marketplace_list_businesses") {
    return businessesResponse(await listActiveBusinesses());
  }

  if (detectedIntent === "product_search") {
    const query = extractProductQuery(input.text);
    const isBroadQuestion = !query || ["что есть", "что есть в магазине", "что есть у вас в магазине"].includes(normalizeText(input.text));

    if (!business && isBroadQuestion) {
      return businessesResponse(await listActiveBusinesses());
    }

    const products = business
      ? await searchProductsInBusiness(business.id, isBroadQuestion ? "" : query)
      : await searchProductsAcrossBusinesses(query);
    const toolName = business ? "searchProductsInBusiness" : "searchProductsAcrossBusinesses";

    if (products.length === 0) {
      return {
        text: "Я не нашёл такой товар. Могу открыть каталог или поискать похожее.",
        detectedIntent,
        toolsCalled: [toolName],
        responseSource: "database",
        button: {
          text: "Открыть каталог",
          url: business ? businessUrl(business.slug) : getMiniAppUrl(),
        },
      };
    }

    return {
      text: [
        isBroadQuestion && business ? `Популярное в ${safeText(business.name)}:` : "Нашёл товары:",
        ...products.map((item, index) => {
          const available = item.isAvailable && (item.stock === null || item.stock > 0);
          return `${index + 1}. ${safeText(item.name)} — ${formatPrice(item.price)} — ${available ? "в наличии" : "нет в наличии"} — ${safeText(item.business.name)}`;
        }),
      ].join("\n"),
      detectedIntent,
      toolsCalled: [toolName],
      responseSource: "database",
      button: {
        text: "Открыть каталог",
        url: business ? businessUrl(business.slug) : businessUrl(products[0].business.slug),
      },
    };
  }

  if (detectedIntent === "order_status") {
    const code = input.text.match(/#?([a-zA-Z0-9]{6,30})\b/)?.[1];
    if (code) {
      const order = await getOrderStatus(code, input.telegramUserId);
      return {
        text: order
          ? `Заказ #${order.id.slice(-6).toUpperCase()} в магазине ${safeText(order.business.name)}: ${ORDER_STATUS_RU[order.status] || "статус уточняется"}. Сумма: ${formatPrice(order.totalPrice)}.`
          : "Я не нашёл этот заказ среди ваших заказов.",
        detectedIntent,
        toolsCalled: ["getOrderStatus"],
        responseSource: "database",
        button: { text: "Открыть мои заказы", url: getMiniAppUrl("/app/profile") },
      };
    }

    const orders = await getCustomerOrders(input.telegramUserId);
    return {
      text: orders.length
        ? ["Ваши последние заказы:", ...orders.map((order) =>
            `#${order.id.slice(-6).toUpperCase()} — ${safeText(order.business.name)} — ${ORDER_STATUS_RU[order.status] || "статус уточняется"} — ${formatPrice(order.totalPrice)}`
          )].join("\n")
        : "У вас пока нет заказов.",
      detectedIntent,
      toolsCalled: ["getCustomerOrders"],
      responseSource: "database",
      button: { text: "Открыть мои заказы", url: getMiniAppUrl("/app/profile") },
    };
  }

  if (!business) {
    const businesses = await listActiveBusinesses();
    const response = businessesResponse(businesses);
    return {
      ...response,
      detectedIntent,
      text: `Сначала выберите магазин. ${response.text}`,
    };
  }

  if (detectedIntent === "delivery_info") {
    const delivery = await getBusinessDeliveryInfo(business.id);
    const zones = delivery?.deliveryZones || [];
    return {
      text: delivery?.settings?.deliveryEnabled && zones.length
        ? [
            `Доставка ${safeText(delivery.name)}:`,
            ...zones.map((zone) =>
              `${safeText(zone.name)} (${safeText(zone.cityArea)}) — ${formatPrice(zone.fee)}${zone.estimatedMinutes ? `, примерно ${zone.estimatedMinutes} мин.` : ""}`
            ),
          ].join("\n")
        : `У этого магазина доставка пока не настроена.${delivery?.phone ? ` Можно связаться с продавцом: ${safeText(delivery.phone)}.` : ""}`,
      detectedIntent,
      toolsCalled: ["getBusinessDeliveryInfo"],
      responseSource: "database",
      button: { text: "Открыть магазин", url: businessUrl(business.slug) },
    };
  }

  if (detectedIntent === "payment_info") {
    const payment = await getBusinessPaymentMethods(business.id);
    const methods = ["наличными"];
    if (payment?.transferPaymentEnabled) methods.push("переводом по реквизитам продавца");
    return {
      text: `В ${safeText(payment?.name || business.name)} можно оплатить ${methods.join(" или ")}.${payment?.transferBankName ? ` Банк для перевода: ${safeText(payment.transferBankName)}.` : ""}`,
      detectedIntent,
      toolsCalled: ["getBusinessPaymentMethods"],
      responseSource: "database",
      button: { text: "Открыть магазин", url: businessUrl(business.slug) },
    };
  }

  if (detectedIntent === "working_hours") {
    const schedule = await getBusinessWorkingHours(business.id);
    const today = new Date().getDay();
    const todayHours = schedule?.workingHours.find((item) => item.dayOfWeek === today);
    const hoursText = !todayHours
      ? "График на сегодня не указан."
      : todayHours.isClosed
        ? `Сегодня, ${DAY_NAMES[today]}, выходной.`
        : `Сегодня, ${DAY_NAMES[today]}, график ${todayHours.openTime}–${todayHours.closeTime}.`;
    return {
      text: `${safeText(schedule?.name || business.name)} сейчас ${schedule?.isOpen ? "открыт" : "закрыт"}. ${hoursText}`,
      detectedIntent,
      toolsCalled: ["getBusinessWorkingHours"],
      responseSource: "database",
      button: { text: "Открыть магазин", url: businessUrl(business.slug) },
    };
  }

  if (detectedIntent === "booking_info") {
    const booking = await getBookingInfo(business.id);
    return {
      text: booking?.settings?.bookingEnabled && booking.items.length
        ? [
            `Доступные услуги ${safeText(booking.name)}:`,
            ...booking.items.map((service) =>
              `${safeText(service.name)} — ${formatPrice(service.price)}${service.durationMinutes ? `, ${service.durationMinutes} мин.` : ""}`
            ),
          ].join("\n")
        : `Онлайн-запись у этого бизнеса пока не настроена.${booking?.phone ? ` Связаться: ${safeText(booking.phone)}.` : ""}`,
      detectedIntent,
      toolsCalled: ["getBookingInfo"],
      responseSource: "database",
      button: { text: "Открыть магазин", url: businessUrl(business.slug) },
    };
  }

  if (detectedIntent === "business_info") {
    const freshBusiness = await getBusinessBySlug(business.slug);
    return {
      text: [
        safeText(freshBusiness?.name || business.name),
        freshBusiness?.description ? safeText(freshBusiness.description) : null,
        freshBusiness?.address ? `Адрес: ${safeText(freshBusiness.address)}` : null,
        freshBusiness?.phone ? `Телефон: ${safeText(freshBusiness.phone)}` : null,
      ].filter(Boolean).join("\n"),
      detectedIntent,
      toolsCalled: ["getBusinessBySlug"],
      responseSource: "database",
      button: { text: "Открыть магазин", url: businessUrl(business.slug) },
    };
  }

  return {
    text: `Я помощник Vitrina AI по магазину ${safeText(business.name)}. Могу найти товар, показать доставку, оплату, график или статус вашего заказа.`,
    detectedIntent,
    toolsCalled: [],
    responseSource: "rules",
    button: { text: "Открыть магазин", url: businessUrl(business.slug) },
  };
}
