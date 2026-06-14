import { Prisma, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildBusinessMiniAppUrl,
  buildMiniAppUrl,
  buildProductMiniAppUrl,
} from "@/lib/production-url";

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
  buttons?: AgentButton[];
};

const ACTIVE_BUSINESS_FILTER: Prisma.BusinessWhereInput = {
  isActive: true,
  accessStatus: "ACTIVE",
  archivedAt: null,
  isDemo: false,
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

const BOOKING_STATUS_RU: Record<string, string> = {
  PENDING: "ожидает подтверждения",
  NEW: "новая",
  CONFIRMED: "подтверждена",
  COMPLETED: "завершена",
  CANCELLED: "отменена",
  EXPIRED: "истекла",
  NO_SHOW: "неявка",
};

const DAY_NAMES = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

function safeText(value: string | null | undefined) {
  return (value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/ё/g, "е").replace(/[?!.,;:()[\]{}"«»]/g, " ").replace(/\s+/g, " ").trim();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function formatPrice(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function isProductAvailable(product: Pick<AgentProduct, "isAvailable" | "stockMode" | "stock">) {
  return product.isAvailable && (product.stockMode === "SIMPLE_AVAILABILITY" || (product.stock || 0) > 0);
}

function businessUrl(slug: string) {
  return buildBusinessMiniAppUrl(slug);
}

function ordersUrl(orderId?: string) {
  const url = new URL(buildMiniAppUrl("/app"));
  url.searchParams.set("tab", "orders");
  if (orderId) url.searchParams.set("orderId", orderId);
  return url.toString();
}

export function buildOpenBusinessButton(businessSlug: string): AgentButton {
  return {
    text: "Открыть магазин",
    url: businessUrl(businessSlug),
  };
}

export function buildOpenProductButton(productSlug: string, businessSlug: string): AgentButton {
  return {
    text: "Открыть товар",
    url: buildProductMiniAppUrl(businessSlug, productSlug),
  };
}

export const buildBusinessOpenButton = buildOpenBusinessButton;
export const buildProductOpenButton = buildOpenProductButton;

export function detectMarketplaceIntent(text: string): MarketplaceIntent {
  const normalized = normalizeText(text);

  if (includesAny(normalized, ["заказ"]) && includesAny(normalized, ["статус", "где", "мой", "мои", "готов", "достав"])) {
    return "order_status";
  }
  if (includesAny(normalized, ["достав", "зона", "район", "привез"])) return "delivery_info";
  if (includesAny(normalized, ["оплат", "перевод", "наличн", "карта", "чек"])) return "payment_info";
  if (includesAny(normalized, ["работаете", "работает", "открыт", "закрыт", "график", "часы"])) return "working_hours";
  if (includesAny(normalized, ["запис", "брон", "услуг", "мастер"])) return "booking_info";
  if (
    (includesAny(normalized, ["какие", "список", "покажи"]) &&
      includesAny(normalized, ["магазин", "бизнес", "заведен"])) ||
    normalized.includes("что есть в витрине")
  ) {
    return "marketplace_list_businesses";
  }
  if (includesAny(normalized, ["адрес", "телефон", "контакт", "связаться", "продавец", "о магазине", "о бизнесе"])) {
    return "business_info";
  }
  if (
    normalized === "что есть" ||
    normalized.includes("что есть у вас") ||
    normalized.includes("что есть в магазине") ||
    includesAny(normalized, ["есть", "найди", "ищу", "товар", "цена", "сколько стоит"])
  ) {
    return "product_search";
  }
  return "fallback";
}

function extractProductQuery(text: string) {
  const phrases = [
    "есть ли у вас",
    "у вас есть",
    "сколько стоит",
    "есть ли",
    "в наличии",
    "пожалуйста",
    "покажи",
    "найди",
    "ищу",
    "нужен",
    "нужна",
    "нужно",
    "товар",
    "товары",
    "какие",
    "что",
    "сейчас",
  ];
  return phrases
    .reduce((query, phrase) => query.split(phrase).join(" "), normalizeText(text))
    .replace(/\s+/g, " ")
    .trim();
}

function extractMaxPrice(text: string) {
  const normalized = normalizeText(text);
  const match = normalized.match(/(?:до|не дороже)\s+(\d[\d\s]*)\s*(?:руб(?:лей|ля)?|₽)?/);
  if (!match) return null;
  const value = Number(match[1].replace(/\s+/g, ""));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function stripPriceConstraint(query: string) {
  return normalizeText(query)
    .replace(/(?:до|не дороже)\s+\d[\d\s]*\s*(?:руб(?:лей|ля)?|₽)?/g, " ")
    .replace(/\b(рублей|рубля|руб)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDeliveryZoneQuery(text: string) {
  const normalized = normalizeText(text);
  const match = normalized.match(/(?:доставка|доставить|привезти)[^]*?\s(?:в|до)\s+([\p{L}\d -]{2,40})$/u);
  return match?.[1]?.trim() || null;
}

export async function listActiveBusinesses(query?: string) {
  const normalizedQuery = query?.trim();
  return prisma.business.findMany({
    where: {
      ...ACTIVE_BUSINESS_FILTER,
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

export async function resolveBusinessByName(query: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return null;

  const businesses = await listActiveBusinesses();
  const exact = businesses.find((business) => {
    const name = normalizeText(business.name);
    const slug = normalizeText(business.slug.replace(/[-_]/g, " "));
    return normalizedQuery === name || normalizedQuery === slug;
  });
  if (exact) return exact;

  return businesses
    .filter((business) => {
      const name = normalizeText(business.name);
      const slug = normalizeText(business.slug.replace(/[-_]/g, " "));
      return normalizedQuery.includes(name) ||
        name.includes(normalizedQuery) ||
        normalizedQuery.includes(slug);
    })
    .sort((left, right) => right.name.length - left.name.length)[0] || null;
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
  description: true,
  price: true,
  stockMode: true,
  stock: true,
  isAvailable: true,
  isPopular: true,
  category: { select: { name: true } },
  business: { select: { slug: true, name: true, isOpen: true } },
} as const;

type AgentProduct = Prisma.ItemGetPayload<{ select: typeof productSelect }>;

const PRODUCT_SEARCH_STOP_WORDS = new Set([
  "а", "в", "вы", "для", "есть", "и", "какие", "ли", "мне", "на", "нужен", "нужна",
  "нужно", "покажи", "товар", "товары", "у", "хочу", "цена", "сколько", "стоит", "что",
]);

const RUSSIAN_ENDINGS = [
  "иями", "ями", "ами", "ого", "ему", "ому", "ыми", "ими", "ий", "ый", "ая",
  "яя", "ое", "ее", "ые", "ие", "ов", "ев", "ам", "ям", "ах", "ях", "ки",
  "ка", "ку", "ок", "ек", "ы", "и", "а", "я", "у", "ю",
];

function productSearchTerms(query: string) {
  const terms = new Set<string>();
  for (const token of normalizeText(query).split(" ")) {
    if (token.length < 2 || PRODUCT_SEARCH_STOP_WORDS.has(token)) continue;
    terms.add(token);
    const ending = RUSSIAN_ENDINGS.find((candidate) => token.endsWith(candidate) && token.length - candidate.length >= 4);
    if (ending) terms.add(token.slice(0, -ending.length));
  }
  return [...terms].slice(0, 6);
}

export async function searchProductsInBusiness(
  businessId: string,
  query: string,
  options: { maxPrice?: number | null } = {}
): Promise<AgentProduct[]> {
  const terms = productSearchTerms(query);
  const products = await prisma.item.findMany({
    where: {
      businessId,
      type: "PRODUCT",
      archivedAt: null,
      AND: [
        ...(terms.length === 0
          ? [{
              isAvailable: true,
              OR: [
                { stockMode: "SIMPLE_AVAILABILITY" as const },
                { stockMode: "TRACK_STOCK" as const, stock: { gt: 0 } },
              ],
            }]
          : []),
        ...(options.maxPrice !== null && options.maxPrice !== undefined
          ? [{ price: { lte: options.maxPrice } }]
          : []),
        ...(terms.length
          ? [{
              OR: terms.flatMap((term) => [
                { name: { contains: term, mode: "insensitive" as const } },
                { description: { contains: term, mode: "insensitive" as const } },
                {
                  category: {
                    is: {
                      isActive: true,
                      name: { contains: term, mode: "insensitive" as const },
                    },
                  },
                },
              ]),
            }]
          : []),
      ],
    },
    select: productSelect,
    orderBy: [{ isPopular: "desc" }, { sortOrder: "asc" }],
    take: terms.length ? 30 : 5,
  });

  if (!terms.length) return products.slice(0, 5);

  return products
    .map((product) => {
      const name = normalizeText(product.name);
      const description = normalizeText(product.description || "");
      const category = normalizeText(product.category?.name || "");
      const score = terms.reduce((total, term) => {
        if (name === term) return total + 12;
        if (name.startsWith(term)) return total + 8;
        if (name.includes(term)) return total + 6;
        if (category.includes(term)) return total + 3;
        if (description.includes(term)) return total + 1;
        return total;
      }, product.isPopular ? 1 : 0);
      return { product, score };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map(({ product }) => product);
}

export const searchProducts = searchProductsInBusiness;

export async function searchProductsAcrossMarketplace(
  query: string,
  options: { maxPrice?: number | null } = {}
): Promise<AgentProduct[]> {
  const terms = productSearchTerms(query);
  if (terms.length === 0 && options.maxPrice === null) return [];

  const products = await prisma.item.findMany({
    where: {
      type: "PRODUCT",
      archivedAt: null,
      business: ACTIVE_BUSINESS_FILTER,
      AND: [
        ...(options.maxPrice !== null && options.maxPrice !== undefined
          ? [{ price: { lte: options.maxPrice } }]
          : []),
        ...(terms.length
          ? [{
              OR: terms.flatMap((term) => [
                { name: { contains: term, mode: "insensitive" as const } },
                { description: { contains: term, mode: "insensitive" as const } },
                {
                  category: {
                    is: {
                      isActive: true,
                      name: { contains: term, mode: "insensitive" as const },
                    },
                  },
                },
              ]),
            }]
          : [{
              isAvailable: true,
              OR: [
                { stockMode: "SIMPLE_AVAILABILITY" as const },
                { stockMode: "TRACK_STOCK" as const, stock: { gt: 0 } },
              ],
            }]),
      ],
    },
    select: productSelect,
    orderBy: [{ isPopular: "desc" }, { price: "asc" }, { sortOrder: "asc" }],
    take: 40,
  });

  if (!terms.length) return products.slice(0, 10);

  return products
    .map((product) => {
      const name = normalizeText(product.name);
      const description = normalizeText(product.description || "");
      const category = normalizeText(product.category?.name || "");
      const score = terms.reduce((total, term) => {
        if (name === term) return total + 12;
        if (name.startsWith(term)) return total + 8;
        if (name.includes(term)) return total + 6;
        if (category.includes(term)) return total + 3;
        if (description.includes(term)) return total + 1;
        return total;
      }, product.isPopular ? 1 : 0);
      return { product, score };
    })
    .sort((left, right) => right.score - left.score || left.product.price - right.product.price)
    .slice(0, 10)
    .map(({ product }) => product);
}

export async function getBusinessContext(businessId: string) {
  return prisma.business.findFirst({
    where: { id: businessId, ...ACTIVE_BUSINESS_FILTER },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      address: true,
      phone: true,
      isOpen: true,
      workingHours: {
        select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true },
        orderBy: { dayOfWeek: "asc" },
      },
    },
  });
}

export async function getBusinessContact(businessId: string) {
  return prisma.business.findFirst({
    where: { id: businessId, ...ACTIVE_BUSINESS_FILTER },
    select: { id: true, slug: true, name: true, description: true, address: true, phone: true },
  });
}

export async function getBusinessDeliveryInfo(businessId: string) {
  return prisma.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      phone: true,
      settings: { select: { deliveryEnabled: true, pickupEnabled: true, deliveryFee: true, deliveryTime: true } },
      deliveryZones: {
        where: { isActive: true, archivedAt: null },
        select: { name: true, cityArea: true, fee: true, estimatedMinutes: true },
        orderBy: { fee: "asc" },
        take: 20,
      },
    },
  });
}

export const getDeliveryInfo = getBusinessDeliveryInfo;

export async function getBusinessPaymentInfo(businessId: string) {
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

export const getBusinessPaymentMethods = getBusinessPaymentInfo;

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

export const getUserOrders = getCustomerOrders;

export async function getCustomerBookings(telegramUserId: string) {
  return prisma.booking.findMany({
    where: {
      customer: { telegramUserId: BigInt(telegramUserId) },
    },
    select: {
      id: true,
      status: true,
      startTime: true,
      business: { select: { name: true, slug: true } },
      service: { select: { name: true } },
    },
    orderBy: { startTime: "desc" },
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
      button: { text: "Открыть Vitrina AI", url: buildMiniAppUrl() },
      buttons: [{ text: "Открыть Vitrina AI", url: buildMiniAppUrl() }],
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
    button: { text: "Открыть список магазинов", url: buildMiniAppUrl() },
    buttons: businesses.slice(0, 5).map((business) => ({
      ...buildBusinessOpenButton(business.slug),
      text: business.name,
    })),
  };
}

type StoredTelegramContext = {
  business: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    phone: string | null;
    address: string | null;
    isOpen: boolean;
  } | null;
  lastProductQuery: string | null;
};

export async function getSelectedBusinessContext(
  telegramUserId: string
): Promise<StoredTelegramContext> {
  try {
    const context = await prisma.telegramChatContext.findUnique({
      where: { telegramUserId: BigInt(telegramUserId) },
      select: {
        lastProductQuery: true,
        business: {
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            phone: true,
            address: true,
            isOpen: true,
          },
        },
      },
    });
    if (context?.business) {
      const activeBusiness = await getBusinessBySlug(context.business.id);
      if (!activeBusiness) {
        return { business: null, lastProductQuery: null };
      }
      return {
        business: activeBusiness,
        lastProductQuery: context.lastProductQuery || null,
      };
    }
  } catch (error) {
    console.warn("[TELEGRAM AI CONTEXT] context table unavailable:", error);
  }

  const fallbackCustomer = await prisma.customer.findFirst({
    where: {
      telegramUserId: BigInt(telegramUserId),
      business: {
        ...ACTIVE_BUSINESS_FILTER,
      },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      business: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          phone: true,
          address: true,
          isOpen: true,
        },
      },
    },
  });

  return {
    business: fallbackCustomer?.business || null,
    lastProductQuery: null,
  };
}

async function saveLastProductQuery(input: {
  telegramUserId: string;
  businessId?: string | null;
  lastProductQuery: string | null;
}) {
  try {
    await prisma.telegramChatContext.upsert({
      where: { telegramUserId: BigInt(input.telegramUserId) },
      update: {
        ...(input.businessId !== undefined ? { businessId: input.businessId } : {}),
        lastProductQuery: input.lastProductQuery,
      },
      create: {
        telegramUserId: BigInt(input.telegramUserId),
        businessId: input.businessId || null,
        lastProductQuery: input.lastProductQuery || null,
      },
    });
  } catch (error) {
    console.warn("[TELEGRAM AI CONTEXT] context could not be saved:", error);
  }
}

export async function setSelectedBusinessContext(
  telegramUserId: string,
  businessId: string,
  options: { ensureCustomer?: boolean } = {}
) {
  const numericTelegramUserId = BigInt(telegramUserId);
  const business = await prisma.business.findFirst({
    where: {
      id: businessId,
      ...ACTIVE_BUSINESS_FILTER,
    },
    select: { id: true },
  });
  if (!business) return false;

  try {
    await prisma.telegramChatContext.upsert({
      where: { telegramUserId: numericTelegramUserId },
      update: { businessId: business.id },
      create: {
        telegramUserId: numericTelegramUserId,
        businessId: business.id,
      },
    });
  } catch (error) {
    console.warn("[TELEGRAM AI CONTEXT] context table unavailable for selection:", error);
  }

  if (options.ensureCustomer !== false) {
    await prisma.customer.upsert({
      where: {
        businessId_telegramUserId: {
          businessId: business.id,
          telegramUserId: numericTelegramUserId,
        },
      },
      update: { updatedAt: new Date() },
      create: {
        businessId: business.id,
        telegramUserId: numericTelegramUserId,
      },
      select: { id: true },
    });
  }

  return true;
}

export async function runTelegramMarketplaceAgent(input: {
  text: string;
  telegramUserId: string;
  business?: { id: string; slug: string; name: string; description?: string | null; phone?: string | null; address?: string | null; isOpen: boolean } | null;
}): Promise<MarketplaceAgentResponse> {
  let detectedIntent = detectMarketplaceIntent(input.text);
  const storedContext = input.business
    ? { business: null, lastProductQuery: null }
    : await getSelectedBusinessContext(input.telegramUserId);
  const mentionedBusiness = await resolveBusinessByName(input.text);
  const business = mentionedBusiness || input.business || storedContext.business || null;
  const switchedBusiness = Boolean(mentionedBusiness && mentionedBusiness.id !== storedContext.business?.id);

  if (input.business) {
    await setSelectedBusinessContext(input.telegramUserId, input.business.id);
  }

  if (mentionedBusiness) {
    await setSelectedBusinessContext(input.telegramUserId, mentionedBusiness.id);
  }

  if (detectedIntent === "fallback" && switchedBusiness && storedContext.lastProductQuery) {
    detectedIntent = "product_search";
  }

  if (detectedIntent === "marketplace_list_businesses") {
    return businessesResponse(await listActiveBusinesses());
  }

  if (detectedIntent === "product_search") {
    const maxPrice = extractMaxPrice(input.text);
    let query = stripPriceConstraint(extractProductQuery(input.text));
    if (mentionedBusiness) {
      const businessName = normalizeText(mentionedBusiness.name);
      query = normalizeText(query.replace(businessName, ""));
    }
    if (!query && switchedBusiness && storedContext.lastProductQuery) {
      query = storedContext.lastProductQuery;
    }
    const isBroadQuestion = !query || ["что есть", "что есть в магазине", "что есть у вас в магазине"].includes(normalizeText(input.text));

    if (!business) {
      if (!query && maxPrice === null) {
        return businessesResponse(await listActiveBusinesses());
      }
      const products = await searchProductsAcrossMarketplace(query, { maxPrice });
      if (products.length === 0) {
        return {
          text: "Не нашёл это в каталоге.",
          detectedIntent,
          toolsCalled: ["searchProductsAcrossMarketplace"],
          responseSource: "database",
          button: { text: "Открыть магазин", url: buildMiniAppUrl() },
        };
      }
      return {
        text: [
          maxPrice !== null
            ? `Нашёл товары до ${formatPrice(maxPrice)}:`
            : "Нашёл товары:",
          ...products.map((item, index) =>
            `${index + 1}. ${safeText(item.name)} — ${formatPrice(item.price)} — ${safeText(item.business.name)} — ${
              isProductAvailable(item) ? "в наличии" : "товар есть в каталоге, но сейчас нет в наличии"
            }${item.business.isOpen ? "" : " — магазин сейчас закрыт"}`
          ),
        ].join("\n"),
        detectedIntent,
        toolsCalled: ["searchProductsAcrossMarketplace"],
        responseSource: "database",
        buttons: products.slice(0, 5).map((product) => ({
          ...buildProductOpenButton(product.id, product.business.slug),
          text: `Открыть товар: ${product.name}`,
        })),
      };
    }

    const products = await searchProducts(business.id, isBroadQuestion ? "" : query, { maxPrice });
    const toolName = "searchProducts";

    if (query) {
      await saveLastProductQuery({
        telegramUserId: input.telegramUserId,
        businessId: business.id,
        lastProductQuery: query,
      });
    }

    if (products.length === 0) {
      return {
        text: "Не нашёл это в каталоге.",
        detectedIntent,
        toolsCalled: [toolName],
        responseSource: "database",
        button: {
          text: "Открыть каталог",
          url: businessUrl(business.slug),
        },
        buttons: [{ ...buildBusinessOpenButton(business.slug), text: `Открыть ${business.name}` }],
      };
    }

    return {
      text: [
        business.isOpen ? null : "Магазин сейчас закрыт, но витрину можно открыть.",
        isBroadQuestion && business ? `Популярное в ${safeText(business.name)}:` : "Нашёл товары:",
        ...products.map((item, index) => {
          return `${index + 1}. ${safeText(item.name)} — ${formatPrice(item.price)} — ${
            isProductAvailable(item) ? "в наличии" : "товар есть в каталоге, но сейчас нет в наличии"
          }`;
        }),
      ].filter(Boolean).join("\n"),
      detectedIntent,
      toolsCalled: [toolName],
      responseSource: "database",
      button: {
        ...buildProductOpenButton(products[0].id, products[0].business.slug),
        text: `Открыть ${products[0].name}`,
      },
      buttons: products.map((product) => ({
        ...buildProductOpenButton(product.id, product.business.slug),
        text: `Открыть товар: ${product.name}`,
      })),
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
        button: { text: "Открыть мои заказы", url: buildMiniAppUrl("/app?tab=orders") },
        buttons: order
          ? [{ text: "Открыть заказ", url: ordersUrl(order.id) }]
          : [{ text: "Открыть мои заказы", url: ordersUrl() }],
      };
    }

    const orders = await getUserOrders(input.telegramUserId);
    return {
      text: orders.length
        ? ["Ваши последние заказы:", ...orders.map((order) =>
            `#${order.id.slice(-6).toUpperCase()} — ${safeText(order.business.name)} — ${ORDER_STATUS_RU[order.status] || "статус уточняется"} — ${formatPrice(order.totalPrice)}`
          )].join("\n")
        : "У вас пока нет заказов.",
      detectedIntent,
      toolsCalled: ["getUserOrders"],
      responseSource: "database",
      button: { text: "Открыть мои заказы", url: ordersUrl() },
    };
  }

  if (!business) {
    const businesses = await listActiveBusinesses();
    const response = businessesResponse(businesses);
    return {
      ...response,
      detectedIntent,
    };
  }

  if (detectedIntent === "delivery_info") {
    const delivery = await getDeliveryInfo(business.id);
    const zones = delivery?.deliveryZones || [];
    const normalizedQuestion = normalizeText(input.text);
    const asksPickup = includesAny(normalizedQuestion, ["самовывоз", "самовывоза", "забрать самому"]);
    if (asksPickup) {
      return {
        text: delivery?.settings?.pickupEnabled
          ? `Да, в ${safeText(delivery.name)} доступен самовывоз.`
          : `В ${safeText(delivery?.name || business.name)} самовывоз не настроен.`,
        detectedIntent,
        toolsCalled: ["getDeliveryInfo"],
        responseSource: "database",
        button: { text: "Открыть магазин", url: businessUrl(business.slug) },
      };
    }

    const zoneQuery = extractDeliveryZoneQuery(input.text);
    const matchedZone = zoneQuery
      ? zones.find((zone) => {
          const haystack = `${normalizeText(zone.name)} ${normalizeText(zone.cityArea)}`;
          return haystack.includes(normalizeText(zoneQuery));
        })
      : null;
    if (zoneQuery && !matchedZone) {
      return {
        text: "Для этой зоны доставка не настроена.",
        detectedIntent,
        toolsCalled: ["getDeliveryInfo"],
        responseSource: "database",
        button: { text: "Открыть магазин", url: businessUrl(business.slug) },
      };
    }

    return {
      text: matchedZone
        ? `Доставка в ${safeText(matchedZone.name)} (${safeText(matchedZone.cityArea)}) стоит ${formatPrice(matchedZone.fee)}${
            matchedZone.estimatedMinutes ? `, примерно ${matchedZone.estimatedMinutes} мин.` : ""
          }`
        : delivery?.settings?.deliveryEnabled && zones.length
        ? [
            `Доставка ${safeText(delivery.name)}:`,
            ...zones.map((zone) =>
              `${safeText(zone.name)} (${safeText(zone.cityArea)}) — ${formatPrice(zone.fee)}${zone.estimatedMinutes ? `, примерно ${zone.estimatedMinutes} мин.` : ""}`
            ),
          ].join("\n")
        : `У этого магазина доставка пока не настроена.${delivery?.phone ? ` Можно связаться с продавцом: ${safeText(delivery.phone)}.` : ""}`,
      detectedIntent,
      toolsCalled: ["getDeliveryInfo"],
      responseSource: "database",
      button: { text: "Открыть магазин", url: businessUrl(business.slug) },
    };
  }

  if (detectedIntent === "payment_info") {
    const payment = await getBusinessPaymentInfo(business.id);
    const methods = ["наличными"];
    if (payment?.transferPaymentEnabled) methods.push("переводом по реквизитам продавца");
    return {
      text: `В ${safeText(payment?.name || business.name)} можно оплатить ${methods.join(" или ")}.${payment?.transferBankName ? ` Банк для перевода: ${safeText(payment.transferBankName)}.` : ""}`,
      detectedIntent,
      toolsCalled: ["getBusinessPaymentInfo"],
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
    const normalizedQuestion = normalizeText(input.text);
    if (includesAny(normalizedQuestion, ["мои записи", "какие записи", "моя запись", "мои бронирования"])) {
      const bookings = await getCustomerBookings(input.telegramUserId);
      return {
        text: bookings.length
          ? [
              "Ваши последние записи:",
              ...bookings.map((booking) =>
                `${safeText(booking.business.name)} — ${safeText(booking.service?.name || "услуга")} — ${
                  new Date(booking.startTime).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                } — ${BOOKING_STATUS_RU[booking.status] || "статус уточняется"}`
              ),
            ].join("\n")
          : "У вас пока нет записей.",
        detectedIntent,
        toolsCalled: ["getCustomerBookings"],
        responseSource: "database",
        button: { text: "Открыть мои заказы", url: ordersUrl() },
      };
    }
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
    const freshBusiness = await getBusinessContact(business.id);
    return {
      text: [
        safeText(freshBusiness?.name || business.name),
        freshBusiness?.description ? safeText(freshBusiness.description) : null,
        freshBusiness?.address ? `Адрес: ${safeText(freshBusiness.address)}` : null,
        freshBusiness?.phone ? `Телефон: ${safeText(freshBusiness.phone)}` : null,
      ].filter(Boolean).join("\n"),
      detectedIntent,
      toolsCalled: ["getBusinessContact"],
      responseSource: "database",
      button: { text: "Связаться с продавцом", url: businessUrl(business.slug) },
      buttons: [
        { text: "Связаться с продавцом", url: businessUrl(business.slug) },
        { text: "Открыть магазин", url: businessUrl(business.slug) },
      ],
    };
  }

  const contact = await getBusinessContact(business.id);
  return {
    text: [
      "Не нашёл это в каталоге.",
      contact?.phone ? `Телефон продавца: ${safeText(contact.phone)}.` : "Откройте магазин, чтобы посмотреть актуальную информацию.",
    ].join(" "),
    detectedIntent,
    toolsCalled: ["getBusinessContact"],
    responseSource: "database",
    button: { text: "Открыть магазин", url: businessUrl(business.slug) },
  };
}
