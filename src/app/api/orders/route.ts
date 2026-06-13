import { after, NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { NotificationService } from "@/lib/notifications/notification-service";
import { ensureTelegramUser } from "@/lib/auth/telegram-user-service";
import {
  processPaymentProofAnalysis,
  recoverStalePaymentProofChecks,
} from "@/lib/ai/payment-proof-service";
import {
  isPaymentProofAiConfigured,
  PAYMENT_PROOF_CONFIG_SUMMARY,
} from "@/lib/ai/payment-proof-analyzer";
import { getTelegramSessionUser, parseTelegramInitData } from "@/lib/auth-telegram";
import { classifyDatabaseError, isBusinessIsDemoMissingColumnError, isPrismaMissingColumnError, warnPrismaSchemaDrift, toJsonSafe } from "@/lib/prisma-schema-guard";
import { isStrictRuPhoneInput, normalizeRuPhone, validateCustomerName } from "@/lib/phone/phone-utils";
import { getApplicablePromoCode, normalizePromoCode } from "@/lib/promo-codes";
import { createServerTiming } from "@/lib/server-timing";

const ORDER_ERROR = "Не удалось оформить заказ. Проверьте данные и попробуйте снова.";
const PHONE_VERIFICATION_ERROR = "Для оформления заказа подтвердите номер телефона.";
const PHONE_MISMATCH_ERROR = "Номер телефона не совпадает с подтверждённым Telegram-номером.";
const RATE_LIMIT_ERROR = "Слишком много попыток. Попробуйте позже.";

const checkoutBusinessLegacySelect = {
  id: true,
  slug: true,
  name: true,
  isActive: true,
  accessStatus: true,
  archivedAt: true,
  subscriptionStatus: true,
} as const;

const checkoutBusinessSelect = {
  ...checkoutBusinessLegacySelect,
  transferPaymentEnabled: true,
  transferBankName: true,
  transferPaymentPhone: true,
  transferRecipientName: true,
} as const;

type CheckoutBusiness = Prisma.BusinessGetPayload<{ select: typeof checkoutBusinessSelect }>;

const checkoutOrderInclude = {
  items: true,
  business: { select: { name: true, slug: true } },
} as const;

const legacyCheckoutOrderSelect = {
  id: true,
  businessId: true,
  customerId: true,
  customerName: true,
  customerPhone: true,
  customerAddress: true,
  totalPrice: true,
  status: true,
  deliveryType: true,
  comment: true,
  internalNotes: true,
  createdAt: true,
  updatedAt: true,
  items: true,
  business: { select: { name: true, slug: true } },
} as const;

const adminOrdersLegacySelect = {
  ...legacyCheckoutOrderSelect,
  customer: true,
} as const;

const paymentCheckoutLegacySelect = {
  ...legacyCheckoutOrderSelect,
  paymentMethod: true,
  paymentStatus: true,
  paymentProofUrl: true,
  paymentProofAiStatus: true,
  paymentProofAiSummary: true,
  paymentProofAiConfidence: true,
  paymentReviewedAt: true,
  paymentReviewedBy: true,
  paymentRejectReason: true,
} as const;

const paymentCheckoutOrderSelect = {
  ...paymentCheckoutLegacySelect,
  idempotencyKey: true,
  itemsSubtotal: true,
  promoCode: true,
  promoDiscountPercent: true,
  discountAmount: true,
  deliveryFee: true,
  deliveryStatus: true,
  deliveryZoneId: true,
  deliveryZoneName: true,
  deliveryCityArea: true,
  paymentProofFileName: true,
  paymentProofMimeType: true,
  paymentProofAiDetails: true,
  stockRestoredAt: true,
} as const;

const adminOrdersSelect = {
  ...paymentCheckoutOrderSelect,
  expiredAt: true,
  expireReason: true,
  customer: {
    select: {
      id: true,
      telegramUserId: true,
      name: true,
      phone: true,
    },
  },
  deliveryZone: {
    select: {
      id: true,
      name: true,
      cityArea: true,
      fee: true,
      estimatedMinutes: true,
    },
  },
  deliveryAssignment: {
    select: {
      id: true,
      status: true,
      courier: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
    },
  },
} as const;

type CurrentCheckoutOrder = Prisma.OrderGetPayload<{ include: typeof checkoutOrderInclude }>;
type LegacyCheckoutOrder = Prisma.OrderGetPayload<{ select: typeof legacyCheckoutOrderSelect }>;
type LegacyPaymentCheckoutOrder = Prisma.OrderGetPayload<{ select: typeof paymentCheckoutLegacySelect }>;
type CheckoutOrderResult = CurrentCheckoutOrder | LegacyPaymentCheckoutOrder | LegacyCheckoutOrder;

const checkoutCustomerLegacySelect = {
  id: true,
  phone: true,
  phoneVerified: true,
  verificationMethod: true,
} as const;

const checkoutCustomerSelect = {
  ...checkoutCustomerLegacySelect,
  isBlocked: true,
  blockReason: true,
} as const;

type CheckoutCustomer = Prisma.CustomerGetPayload<{ select: typeof checkoutCustomerLegacySelect }> & {
  isBlocked: boolean;
  blockReason: string | null;
};

function withCheckoutCustomerDefaults(
  customer: Prisma.CustomerGetPayload<{ select: typeof checkoutCustomerLegacySelect }>
): CheckoutCustomer {
  return { ...customer, isBlocked: false, blockReason: null };
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toPositiveInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 0;
  return parsed;
}

function orderError(code: string, error: string, status = 400) {
  return NextResponse.json({ ok: false, code, error }, { status });
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

class CheckoutConflictError extends Error {
  constructor(public readonly code: "OUT_OF_STOCK" | "PROMO_LIMIT_REACHED") {
    super(code);
  }
}

function normalizeCheckoutOrder(orderResult: CheckoutOrderResult) {
  return {
    ...orderResult,
    idempotencyKey: "idempotencyKey" in orderResult ? orderResult.idempotencyKey : null,
    paymentMethod: "paymentMethod" in orderResult ? orderResult.paymentMethod : "CASH",
    paymentStatus: "paymentStatus" in orderResult ? orderResult.paymentStatus : "PENDING",
    paymentProofUrl: "paymentProofUrl" in orderResult ? orderResult.paymentProofUrl : null,
    paymentProofFileName: "paymentProofFileName" in orderResult ? orderResult.paymentProofFileName : null,
    paymentProofMimeType: "paymentProofMimeType" in orderResult ? orderResult.paymentProofMimeType : null,
    paymentProofAiStatus: "paymentProofAiStatus" in orderResult ? orderResult.paymentProofAiStatus : null,
    paymentProofAiSummary: "paymentProofAiSummary" in orderResult ? orderResult.paymentProofAiSummary : null,
    paymentProofAiConfidence: "paymentProofAiConfidence" in orderResult ? orderResult.paymentProofAiConfidence : null,
    paymentProofAiResult: "paymentProofAiResult" in orderResult ? orderResult.paymentProofAiResult : null,
    paymentProofAiDetails: "paymentProofAiDetails" in orderResult ? orderResult.paymentProofAiDetails : null,
    paymentReviewedAt: "paymentReviewedAt" in orderResult ? orderResult.paymentReviewedAt : null,
    paymentReviewedBy: "paymentReviewedBy" in orderResult ? orderResult.paymentReviewedBy : null,
    paymentRejectReason: "paymentRejectReason" in orderResult ? orderResult.paymentRejectReason : null,
    stockRestoredAt: "stockRestoredAt" in orderResult ? orderResult.stockRestoredAt : null,
    expiredAt: "expiredAt" in orderResult ? orderResult.expiredAt : null,
    expireReason: "expireReason" in orderResult ? orderResult.expireReason : null,
    itemsSubtotal: "itemsSubtotal" in orderResult ? orderResult.itemsSubtotal : orderResult.totalPrice,
    promoCode: "promoCode" in orderResult ? orderResult.promoCode : null,
    promoDiscountPercent: "promoDiscountPercent" in orderResult ? orderResult.promoDiscountPercent : null,
    discountAmount: "discountAmount" in orderResult ? orderResult.discountAmount : 0,
    deliveryFee: "deliveryFee" in orderResult ? orderResult.deliveryFee : 0,
    deliveryStatus: "deliveryStatus" in orderResult ? orderResult.deliveryStatus : "NONE",
    deliveryZoneId: "deliveryZoneId" in orderResult ? orderResult.deliveryZoneId : null,
    deliveryZoneName: "deliveryZoneName" in orderResult ? orderResult.deliveryZoneName : null,
    deliveryCityArea: "deliveryCityArea" in orderResult ? orderResult.deliveryCityArea : null,
  };
}

async function recordOrderAttempt(input: {
  businessId?: string;
  telegramUserId: bigint;
  phone?: string | null;
  ipAddress?: string | null;
  success: boolean;
  reason?: string;
}) {
  try {
    await prisma.orderAttempt.create({
      data: {
        businessId: input.businessId,
        telegramUserId: input.telegramUserId,
        phone: input.phone || null,
        ipAddress: input.ipAddress || null,
        success: input.success,
        reason: input.reason || null,
      },
    });
  } catch (error) {
    console.warn("[ORDER RATE LIMIT] attempt log skipped:", error);
  }
}

async function enforceOrderRateLimit(input: {
  businessId: string;
  telegramUserId: bigint;
  phone: string;
  ipAddress?: string | null;
}) {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const [telegramAttempts, phoneAttempts, ipAttempts] = await Promise.all([
      prisma.orderAttempt.count({
        where: {
          telegramUserId: input.telegramUserId,
          createdAt: { gte: tenMinutesAgo },
        },
      }),
      prisma.orderAttempt.count({
        where: {
          phone: input.phone,
          createdAt: { gte: tenMinutesAgo },
        },
      }),
      input.ipAddress
        ? prisma.orderAttempt.count({
            where: {
              ipAddress: input.ipAddress,
              createdAt: { gte: tenMinutesAgo },
            },
          })
        : Promise.resolve(0),
    ]);

    if (telegramAttempts >= 5 || phoneAttempts >= 5 || ipAttempts >= 5) {
      await recordOrderAttempt({
        businessId: input.businessId,
        telegramUserId: input.telegramUserId,
        phone: input.phone,
        ipAddress: input.ipAddress,
        success: false,
        reason: "RATE_LIMITED",
      });
      return orderError("RATE_LIMITED", RATE_LIMIT_ERROR, 429);
    }
  } catch (error) {
    console.warn("[ORDER RATE LIMIT] check skipped:", error);
  }

  return null;
}

function getClientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || null;
}

function isAllowedPaymentProofUrl(value: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!supabaseUrl) return true;
  const bucket = process.env.SUPABASE_STORAGE_PAYMENT_PROOFS_BUCKET || "payment-proofs";
  return value.startsWith(`${supabaseUrl}/storage/v1/object/public/${bucket}/`);
}

export async function POST(request: NextRequest) {
  let telegramId: bigint | null = null;
  let telegramAuthenticated = false;
  let authenticatedUsername: string | null = null;
  let normalizedPhone: string | null = null;
  let resolvedBusinessId: string | undefined;
  const requestIpAddress = getClientIp(request);
  const recordAttempt = (input: Omit<Parameters<typeof recordOrderAttempt>[0], "ipAddress">) =>
    telegramAuthenticated
      ? recordOrderAttempt({ ...input, ipAddress: requestIpAddress })
      : Promise.resolve();

  try {
    const body = await request.json();
    const {
      businessId,
      businessSlug,
      customerName,
      customerPhone,
      customerAddress,
      items,
      deliveryType,
      deliveryZoneId,
      comment,
      telegramUserId,
      paymentMethod,
      paymentProofUrl,
      paymentProofFileName,
      paymentProofMimeType,
      idempotencyKey,
      promoCode,
    } = body;
    const cleanIdempotencyKey = cleanString(idempotencyKey);
    if (cleanIdempotencyKey && (cleanIdempotencyKey.length < 8 || cleanIdempotencyKey.length > 128)) {
      return orderError("INVALID_IDEMPOTENCY_KEY", "Не удалось подтвердить уникальность заказа. Обновите checkout и попробуйте снова.");
    }

    const businessValue = businessId || businessSlug;
    if (!businessValue) {
      return orderError("BUSINESS_REQUIRED", "Бизнес не выбран.");
    }

    if (!telegramUserId) {
      return orderError("TELEGRAM_REQUIRED", "Оформление заказа доступно только через Telegram Mini App.", 401);
    }

    try {
      telegramId = BigInt(telegramUserId);
    } catch {
      return orderError("INVALID_TELEGRAM_USER", "Не удалось определить Telegram-пользователя.");
    }

    const initData = request.headers.get("x-telegram-init-data") || "";
    const initUser = parseTelegramInitData(initData);
    try {
      if (!initUser || BigInt(initUser.id) !== telegramId) {
        return orderError("TELEGRAM_AUTH_INVALID", "Нужна авторизация через Telegram Mini App.", 401);
      }
    } catch {
      return orderError("TELEGRAM_AUTH_INVALID", "Нужна авторизация через Telegram Mini App.", 401);
    }

    if (!Array.isArray(items) || items.length === 0) {
      await recordAttempt({ telegramUserId: telegramId, success: false, reason: "EMPTY_CART" });
      return orderError("EMPTY_CART", "Корзина пустая. Добавьте товары перед оформлением заказа.");
    }

    const cleanCustomerName = validateCustomerName(customerName);
    if (!cleanCustomerName) {
      await recordAttempt({ telegramUserId: telegramId, success: false, reason: "INVALID_NAME" });
      return orderError("INVALID_NAME", "Введите настоящее имя без цифр и символов.");
    }

    if (!isStrictRuPhoneInput(customerPhone)) {
      await recordAttempt({ telegramUserId: telegramId, success: false, reason: "INVALID_PHONE" });
      return orderError("INVALID_PHONE", "Введите номер в формате +7XXXXXXXXXX.");
    }
    normalizedPhone = normalizeRuPhone(customerPhone);
    if (!normalizedPhone) {
      await recordAttempt({ telegramUserId: telegramId, success: false, reason: "INVALID_PHONE" });
      return orderError("INVALID_PHONE", "Введите корректный номер телефона.");
    }

    const normalizedDeliveryType: "DELIVERY" | "PICKUP" = deliveryType === "DELIVERY" ? "DELIVERY" : "PICKUP";
    const cleanAddress = cleanString(customerAddress);
    if (normalizedDeliveryType === "DELIVERY" && cleanAddress.length < 5) {
      await recordAttempt({ telegramUserId: telegramId, phone: normalizedPhone, success: false, reason: "ADDRESS_REQUIRED" });
      return orderError("ADDRESS_REQUIRED", "Укажите адрес доставки.");
    }

    let usedCheckoutSchemaFallback = false;
    let business: CheckoutBusiness | null;
    const businessWhere = {
      OR: [
        { id: businessValue },
        { slug: businessValue },
        { slug: { equals: businessValue, mode: "insensitive" as const } },
      ],
    };

    try {
      business = await prisma.business.findFirst({
        where: businessWhere,
        select: checkoutBusinessSelect,
      });
    } catch (error) {
      if (!isPrismaMissingColumnError(error)) throw error;
      usedCheckoutSchemaFallback = true;
      warnPrismaSchemaDrift("Checkout retried without transfer payment business columns", error);
      const legacyBusiness = await prisma.business.findFirst({
        where: businessWhere,
        select: checkoutBusinessLegacySelect,
      });
      business = legacyBusiness
        ? {
            ...legacyBusiness,
            transferPaymentEnabled: false,
            transferBankName: null,
            transferPaymentPhone: null,
            transferRecipientName: null,
          }
        : null;
    }

    if (
      !business ||
      !business.isActive ||
      business.accessStatus !== "ACTIVE" ||
      business.archivedAt
    ) {
      await recordAttempt({ telegramUserId: telegramId, phone: normalizedPhone, success: false, reason: "BUSINESS_NOT_FOUND" });
      return orderError("BUSINESS_NOT_FOUND", "Бизнес не найден или временно недоступен.", 404);
    }
    resolvedBusinessId = business.id;

    const telegramSession = await getTelegramSessionUser(initData, business.id);
    if (!telegramSession || BigInt(telegramSession.telegramUserId) !== telegramId) {
      return orderError("TELEGRAM_AUTH_INVALID", "Нужна авторизация через Telegram Mini App.", 401);
    }
    telegramAuthenticated = true;
    authenticatedUsername = telegramSession.username;

    if (business.subscriptionStatus === "BLOCKED" || business.subscriptionStatus === "EXPIRED") {
      await recordAttempt({ businessId: business.id, telegramUserId: telegramId, phone: normalizedPhone, success: false, reason: "BUSINESS_BLOCKED" });
      return orderError("BUSINESS_BLOCKED", "Заказы временно недоступны. Свяжитесь с продавцом.", 403);
    }

    const deliverySettings = await prisma.businessSettings.findUnique({
      where: { businessId: business.id },
      select: { deliveryEnabled: true, pickupEnabled: true, minOrderAmount: true, deliveryFee: true },
    });
    let deliveryZone: { id: string; name: string; cityArea: string; fee: number; minOrderAmount: number } | null = null;
    let legacyDeliveryFee = 0;
    if (normalizedDeliveryType === "DELIVERY") {
      if (!deliverySettings?.deliveryEnabled) {
        return orderError("DELIVERY_DISABLED", "Доставка у этого магазина выключена.");
      }
      try {
        if (cleanString(deliveryZoneId)) {
          deliveryZone = await prisma.deliveryZone.findFirst({
            where: { id: cleanString(deliveryZoneId), businessId: business.id, isActive: true, archivedAt: null },
            select: { id: true, name: true, cityArea: true, fee: true, minOrderAmount: true },
          });
          if (!deliveryZone) {
            return orderError("DELIVERY_ZONE_NOT_FOUND", "Выбранная зона доставки недоступна.");
          }
        } else {
          const activeZones = await prisma.deliveryZone.count({
            where: { businessId: business.id, isActive: true, archivedAt: null },
          });
          if (activeZones > 0) {
            return orderError("DELIVERY_ZONE_REQUIRED", "Выберите город или район доставки.");
          }
          legacyDeliveryFee = deliverySettings.deliveryFee || 0;
          usedCheckoutSchemaFallback = true;
        }
      } catch (error) {
        const deliverySchemaError = classifyDatabaseError(error);
        if (deliverySchemaError.type !== "missing_table" && deliverySchemaError.type !== "missing_column") throw error;
        usedCheckoutSchemaFallback = true;
        legacyDeliveryFee = deliverySettings.deliveryFee || 0;
        warnPrismaSchemaDrift("Checkout used legacy delivery fee because delivery zones are not installed", error);
      }
    } else if (deliverySettings?.pickupEnabled === false) {
      return orderError("PICKUP_DISABLED", "Самовывоз у этого магазина выключен.");
    }

    const requestedPaymentMethod = paymentMethod === "TRANSFER" || paymentMethod === "transfer" ? "TRANSFER" : "CASH";
    const paymentProofAiConfigured = isPaymentProofAiConfigured();
    if (requestedPaymentMethod === "TRANSFER") {
      if (!business.transferPaymentEnabled) {
        return orderError("TRANSFER_DISABLED", "Оплата переводом сейчас недоступна.");
      }
      if (!cleanString(paymentProofUrl)) {
        return orderError("PAYMENT_PROOF_REQUIRED", "Загрузите чек перевода.");
      }
      if (!isAllowedPaymentProofUrl(cleanString(paymentProofUrl))) {
        return orderError("PAYMENT_PROOF_INVALID_URL", "Загрузите чек через форму оформления заказа.");
      }
    }

    const requestedItems = new Map<string, number>();
    for (const item of items) {
      const itemId = cleanString(item.itemId);
      const quantity = toPositiveInt(item.quantity);
      if (!itemId || quantity <= 0) {
        await recordAttempt({ businessId: business.id, telegramUserId: telegramId, phone: normalizedPhone, success: false, reason: "INVALID_ITEM" });
        return orderError("INVALID_ITEM", "В корзине есть некорректная позиция.");
      }
      requestedItems.set(itemId, (requestedItems.get(itemId) || 0) + quantity);
    }

    const itemIds = Array.from(requestedItems.keys());
    let dbItems: Array<{
      id: string;
      businessId: string;
      name: string;
      price: number;
      isAvailable: boolean;
      stockMode: "SIMPLE_AVAILABILITY" | "TRACK_STOCK";
      stock: number | null;
      archivedAt: Date | null;
    }>;
    try {
      dbItems = await prisma.item.findMany({
        where: { id: { in: itemIds } },
        select: {
          id: true,
          businessId: true,
          name: true,
          price: true,
          isAvailable: true,
          stockMode: true,
          stock: true,
          archivedAt: true,
        },
      });
    } catch (error) {
      if (!isPrismaMissingColumnError(error, "Item", "stockMode") && !isPrismaMissingColumnError(error, "Item", "archivedAt")) {
        throw error;
      }
      usedCheckoutSchemaFallback = true;
      warnPrismaSchemaDrift("Checkout loaded products without stock mode/archive fields", error);
      const legacyItems = await prisma.item.findMany({
        where: { id: { in: Array.from(requestedItems.keys()) } },
        select: { id: true, businessId: true, name: true, price: true, isAvailable: true, stock: true },
      });
      dbItems = legacyItems.map((item) => ({
        ...item,
        stockMode: item.stock === null ? "SIMPLE_AVAILABILITY" as const : "TRACK_STOCK" as const,
        archivedAt: null,
      }));
    }

    if (dbItems.length !== requestedItems.size) {
      return orderError("ITEM_UNAVAILABLE", "Одна из позиций больше недоступна. Обновите корзину.");
    }

    let totalPrice = 0;
    const trackedStockItems: Array<{ id: string; quantity: number }> = [];
    const orderItems: Array<{ name: string; price: number; quantity: number; itemId: string; stock: number | null }> = [];
    for (const dbItem of dbItems) {
      const quantity = requestedItems.get(dbItem.id) || 0;
      if (dbItem.businessId !== business.id || !dbItem.isAvailable || dbItem.archivedAt) {
        await recordAttempt({ businessId: business.id, telegramUserId: telegramId, phone: normalizedPhone, success: false, reason: "ITEM_UNAVAILABLE" });
        return orderError("ITEM_UNAVAILABLE", "Одна из позиций больше недоступна. Обновите корзину.");
      }
      if (dbItem.stockMode === "TRACK_STOCK") {
        if (dbItem.stock === null || dbItem.stock < quantity) {
          return orderError("OUT_OF_STOCK", `Товара «${dbItem.name}» недостаточно на складе.`);
        }
        trackedStockItems.push({ id: dbItem.id, quantity });
      }

      totalPrice += dbItem.price * quantity;
      orderItems.push({
        name: dbItem.name,
        price: dbItem.price,
        quantity,
        itemId: dbItem.id,
        stock: dbItem.stock,
      });
    }

    const user = await ensureTelegramUser({
      telegramId,
      username: authenticatedUsername,
      firstName: cleanCustomerName,
    });

    const customerWhere = {
      businessId_telegramUserId: {
        businessId: business.id,
        telegramUserId: telegramId,
      },
    };
    const customerUpdate = {
      userId: user.id,
      name: cleanCustomerName,
      username: authenticatedUsername,
      address: cleanAddress || undefined,
    };
    const customerCreate = {
      businessId: business.id,
      userId: user.id,
      telegramUserId: telegramId,
      name: cleanCustomerName,
      phone: normalizedPhone,
      username: authenticatedUsername,
      address: cleanAddress || undefined,
    };
    let customer: CheckoutCustomer;

    try {
      customer = await prisma.customer.upsert({
        where: customerWhere,
        update: customerUpdate,
        create: customerCreate,
        select: checkoutCustomerSelect,
      });
    } catch (error) {
      if (!isPrismaMissingColumnError(error, "Customer", "isBlocked") && !isPrismaMissingColumnError(error, "Customer", "blockReason")) {
        throw error;
      }
      usedCheckoutSchemaFallback = true;
      warnPrismaSchemaDrift("Checkout customer retried without blocking columns", error);
      customer = withCheckoutCustomerDefaults(await prisma.customer.upsert({
        where: customerWhere,
        update: customerUpdate,
        create: customerCreate,
        select: checkoutCustomerLegacySelect,
      }));
    }

    const currentUser = await prisma.user.findUnique({
      where: { telegramId },
      select: {
        id: true,
        phone: true,
        phoneVerified: true,
      },
    });

    const verifiedUserPhone = currentUser?.phoneVerified ? normalizeRuPhone(currentUser.phone) : null;
    if (verifiedUserPhone) {
      const phoneUpdate = {
        phone: verifiedUserPhone,
        phoneVerified: true,
        verificationMethod: customer.verificationMethod === "telegram_contact" ? "telegram_contact" : "global_user_phone",
      };
      try {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: phoneUpdate,
          select: checkoutCustomerSelect,
        });
      } catch (error) {
        if (!isPrismaMissingColumnError(error, "Customer", "isBlocked") && !isPrismaMissingColumnError(error, "Customer", "blockReason")) {
          throw error;
        }
        usedCheckoutSchemaFallback = true;
        customer = withCheckoutCustomerDefaults(await prisma.customer.update({
          where: { id: customer.id },
          data: phoneUpdate,
          select: checkoutCustomerLegacySelect,
        }));
      }
    }

    console.log("[ORDER PHONE CHECK]", {
      businessId: business.id,
      telegramUserId: telegramId.toString(),
      customerId: customer.id,
      customerPhone: customer.phone,
      customerPhoneVerified: customer.phoneVerified,
      userPhone: currentUser?.phone || null,
      userPhoneVerified: currentUser?.phoneVerified || false,
      verificationMethod: customer.verificationMethod,
    });

    if (customer.isBlocked) {
      await recordAttempt({ businessId: business.id, telegramUserId: telegramId, phone: normalizedPhone, success: false, reason: "CUSTOMER_BLOCKED" });
      return orderError("CUSTOMER_BLOCKED", "Ваш аккаунт временно ограничен.", 403);
    }

    const verifiedCustomerPhone = customer.phoneVerified ? normalizeRuPhone(customer.phone) : null;
    if (!verifiedCustomerPhone) {
      await recordAttempt({ businessId: business.id, telegramUserId: telegramId, phone: normalizedPhone, success: false, reason: "PHONE_NOT_VERIFIED" });
      return orderError("PHONE_NOT_VERIFIED", PHONE_VERIFICATION_ERROR, 403);
    }

    if (normalizedPhone !== verifiedCustomerPhone) {
      await recordAttempt({ businessId: business.id, telegramUserId: telegramId, phone: normalizedPhone, success: false, reason: "PHONE_MISMATCH" });
      return orderError("PHONE_MISMATCH", PHONE_MISMATCH_ERROR, 403);
    }

    if (cleanIdempotencyKey) {
      try {
        const existingOrder = await prisma.order.findFirst({
          where: {
            businessId: business.id,
            customerId: customer.id,
            idempotencyKey: cleanIdempotencyKey,
          },
          include: checkoutOrderInclude,
        });
        if (existingOrder) {
          const replayedOrder = normalizeCheckoutOrder(existingOrder);
          return NextResponse.json(toJsonSafe({
            ...replayedOrder,
            ok: true,
            alreadyCreated: true,
            message: "Заказ уже создан.",
          }));
        }
      } catch (error) {
        if (!isPrismaMissingColumnError(error, "Order", "idempotencyKey")) throw error;
        usedCheckoutSchemaFallback = true;
        warnPrismaSchemaDrift("Checkout idempotency is unavailable until the commercial readiness patch is applied", error);
      }
    }

    const requestedPromoCode = normalizePromoCode(promoCode);
    let appliedPromo: { id: string; code: string; discountPercent: number; usageLimit: number | null } | null = null;
    if (requestedPromoCode) {
      try {
        const promoResult = await getApplicablePromoCode(business.id, requestedPromoCode);
        if (!promoResult.ok) return orderError("PROMO_CODE_INVALID", promoResult.error);
        appliedPromo = {
          id: promoResult.promo.id,
          code: promoResult.promo.code,
          discountPercent: promoResult.promo.discountPercent,
          usageLimit: promoResult.promo.usageLimit,
        };
      } catch (error) {
        const classification = classifyDatabaseError(error);
        if (classification.type !== "missing_table" && classification.type !== "missing_column") throw error;
        return orderError("PROMO_CODE_UNAVAILABLE", "Промокоды временно недоступны. Попробуйте оформить заказ без промокода.", 503);
      }
    }

    const rateLimited = await enforceOrderRateLimit({
      businessId: business.id,
      telegramUserId: telegramId,
      phone: verifiedCustomerPhone,
      ipAddress: requestIpAddress,
    });
    if (rateLimited) return rateLimited;

    const itemsSubtotal = totalPrice;
    const minimumDeliveryAmount = Math.max(
      deliverySettings?.minOrderAmount || 0,
      deliveryZone?.minOrderAmount || 0
    );
    if (normalizedDeliveryType === "DELIVERY" && itemsSubtotal < minimumDeliveryAmount) {
      return orderError("MIN_DELIVERY_AMOUNT", `Минимальная сумма заказа для доставки: ${minimumDeliveryAmount} ₽.`);
    }
    const discountAmount = appliedPromo
      ? Math.round(itemsSubtotal * appliedPromo.discountPercent) / 100
      : 0;
    const calculatedDeliveryFee = normalizedDeliveryType === "DELIVERY" ? deliveryZone?.fee ?? legacyDeliveryFee : 0;
    totalPrice = Math.max(0, itemsSubtotal - discountAmount) + calculatedDeliveryFee;

    const snapshotItems = orderItems.map(({ stock: _stock, ...snapshot }) => snapshot);
    const legacyBaseOrderData = {
      businessId: business.id,
      customerId: customer.id,
      customerAddress: normalizedDeliveryType === "DELIVERY" ? cleanAddress : null,
      customerName: cleanCustomerName,
      customerPhone: verifiedCustomerPhone,
      totalPrice,
      status: "NEW" as const,
      deliveryType: normalizedDeliveryType,
      comment: cleanString(comment) || null,
      items: {
        create: snapshotItems,
      },
    };
    const baseOrderData = {
      ...legacyBaseOrderData,
      idempotencyKey: cleanIdempotencyKey || null,
      itemsSubtotal,
      promoCode: appliedPromo?.code || null,
      promoDiscountPercent: appliedPromo?.discountPercent || null,
      discountAmount,
      deliveryFee: calculatedDeliveryFee,
      deliveryStatus: normalizedDeliveryType === "DELIVERY" ? "NEW" as const : "NONE" as const,
      deliveryZoneId: deliveryZone?.id || null,
      deliveryZoneName: deliveryZone?.name || null,
      deliveryCityArea: deliveryZone?.cityArea || null,
    };
    let orderResult: CheckoutOrderResult;

    const createOrderTransaction = (useCurrentSchema: boolean) =>
      prisma.$transaction(async (tx) => {
        for (const trackedItem of trackedStockItems) {
          const reservation = await tx.item.updateMany({
            where: {
              id: trackedItem.id,
              businessId: business.id,
              isAvailable: true,
              stock: { gte: trackedItem.quantity },
              ...(useCurrentSchema ? { stockMode: "TRACK_STOCK" as const, archivedAt: null } : {}),
            },
            data: { stock: { decrement: trackedItem.quantity } },
          });
          if (reservation.count !== 1) {
            throw new CheckoutConflictError("OUT_OF_STOCK");
          }
          await tx.item.updateMany({
            where: {
              id: trackedItem.id,
              stock: { lte: 0 },
              ...(useCurrentSchema ? { stockMode: "TRACK_STOCK" as const } : {}),
            },
            data: { isAvailable: false },
          });
        }

        if (appliedPromo) {
          const now = new Date();
          const updatedPromo = await tx.promoCode.updateMany({
            where: {
              id: appliedPromo.id,
              businessId: business.id,
              isActive: true,
              archivedAt: null,
              AND: [
                { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
                { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
                ...(appliedPromo.usageLimit !== null
                  ? [{ usageCount: { lt: appliedPromo.usageLimit } }]
                  : []),
              ],
            },
            data: { usageCount: { increment: 1 } },
          });
          if (updatedPromo.count !== 1) {
            throw new CheckoutConflictError("PROMO_LIMIT_REACHED");
          }
        }

        if (useCurrentSchema) {
          return tx.order.create({
            data: {
              ...baseOrderData,
              paymentMethod: requestedPaymentMethod,
              paymentStatus: requestedPaymentMethod === "TRANSFER" ? "AWAITING_REVIEW" : "PENDING",
              paymentProofUrl: requestedPaymentMethod === "TRANSFER" ? cleanString(paymentProofUrl) : null,
              paymentProofFileName: requestedPaymentMethod === "TRANSFER" ? cleanString(paymentProofFileName) || null : null,
              paymentProofMimeType: requestedPaymentMethod === "TRANSFER" ? cleanString(paymentProofMimeType) || null : null,
              paymentProofAiStatus: requestedPaymentMethod === "TRANSFER"
                ? cleanString(paymentProofMimeType).startsWith("image/") && paymentProofAiConfigured
                  ? "AI_CHECKING"
                  : "MANUAL_REVIEW"
                : null,
              paymentProofAiSummary: requestedPaymentMethod === "TRANSFER" && !paymentProofAiConfigured
                ? PAYMENT_PROOF_CONFIG_SUMMARY
                : null,
            },
            include: checkoutOrderInclude,
          });
        }

        return requestedPaymentMethod === "TRANSFER"
          ? tx.order.create({
              data: {
                ...legacyBaseOrderData,
                paymentMethod: "TRANSFER",
                paymentStatus: "AWAITING_REVIEW",
                paymentProofUrl: cleanString(paymentProofUrl),
                paymentProofAiStatus: "MANUAL_REVIEW",
                paymentProofAiSummary: paymentProofAiConfigured ? null : PAYMENT_PROOF_CONFIG_SUMMARY,
              },
              select: paymentCheckoutLegacySelect,
            })
          : tx.order.create({
              data: legacyBaseOrderData,
              select: legacyCheckoutOrderSelect,
            });
      });

    try {
      orderResult = await createOrderTransaction(true);
    } catch (error) {
      if (error instanceof CheckoutConflictError) {
        if (error.code === "OUT_OF_STOCK") {
          return orderError("OUT_OF_STOCK", "Остаток одного из товаров изменился. Обновите корзину и попробуйте снова.", 409);
        }
        return orderError("PROMO_CODE_INVALID", "Лимит использований промокода исчерпан.", 409);
      }
      if (isUniqueConstraintError(error) && cleanIdempotencyKey) {
        const existingOrder = await prisma.order.findFirst({
          where: { businessId: business.id, customerId: customer.id, idempotencyKey: cleanIdempotencyKey },
          include: checkoutOrderInclude,
        });
        if (existingOrder) {
          const replayedOrder = normalizeCheckoutOrder(existingOrder);
          return NextResponse.json(toJsonSafe({
            ...replayedOrder,
            ok: true,
            alreadyCreated: true,
            message: "Заказ уже создан.",
          }));
        }
      }
      if (!isPrismaMissingColumnError(error)) throw error;
      if (appliedPromo) {
        return orderError("PROMO_CODE_UNAVAILABLE", "Промокоды станут доступны после обновления базы данных.", 503);
      }
      usedCheckoutSchemaFallback = true;
      warnPrismaSchemaDrift("Checkout retried without courier/delivery columns", error);
      orderResult = await createOrderTransaction(false);
    }

    const order = normalizeCheckoutOrder(orderResult);

    await recordAttempt({
      businessId: business.id,
      telegramUserId: telegramId,
      phone: verifiedCustomerPhone,
      success: true,
      reason: "ORDER_CREATED",
    });

    try {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          totalOrders: { increment: 1 },
          totalSpent: { increment: totalPrice },
        },
      });
    } catch (error) {
      warnPrismaSchemaDrift("Order created, but customer counters could not be updated", error);
    }

    if (
      requestedPaymentMethod === "TRANSFER" &&
      order.paymentProofUrl &&
      order.paymentProofAiStatus === "AI_CHECKING"
    ) {
      after(async () => {
        try {
          await processPaymentProofAnalysis(order.id);
        } catch (error) {
          console.error("[PAYMENT PROOF AI] background processing failed:", error);
          await prisma.order.updateMany({
            where: {
              id: order.id,
              paymentProofAiStatus: { in: ["PENDING", "AI_CHECKING"] },
              paymentReviewedAt: null,
            },
            data: {
              paymentProofAiStatus: "MANUAL_REVIEW",
              paymentProofAiSummary: "ИИ не смог проверить чек. Проверьте оплату вручную.",
              paymentProofAiConfidence: 0,
              paymentProofAiResult: null,
              paymentProofAiDetails: null,
            },
          }).catch((updateError) => {
            console.error("[PAYMENT PROOF AI] failed to persist AI_FAILED status:", updateError);
          });
        }
      });
    }

    try {
      await NotificationService.notifyBusinessOwnerNewOrder(order.id);
    } catch (error) {
      console.error("[ORDER NOTIFICATION] Order created, but seller notification failed:", error);
    }

    return NextResponse.json(toJsonSafe({ ...order, ok: true, schemaFallback: usedCheckoutSchemaFallback }), { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    const classification = classifyDatabaseError(error);
    if (classification.type !== "database_error") {
      warnPrismaSchemaDrift("Order creation failed because production schema is behind", error);
    }
    if (telegramId) {
      await recordAttempt({
        businessId: resolvedBusinessId,
        telegramUserId: telegramId,
        phone: normalizedPhone,
        success: false,
        reason: "SERVER_ERROR",
      });
    }
    if (isBusinessIsDemoMissingColumnError(error)) {
      warnPrismaSchemaDrift("Order creation hit Business.isDemo schema drift", error);
      return NextResponse.json({ ok: false, error: "Оформление заказа временно недоступно." }, { status: 503 });
    }
    return NextResponse.json(
      { ok: false, code: classification.code, error: ORDER_ERROR },
      { status: classification.type === "database_error" ? 500 : 503 }
    );
  }
}

export async function GET(request: NextRequest) {
  const finishTiming = createServerTiming("seller_orders");
  try {
    const session = await getAdminSession(request);
    if (!session) {
      return finishTiming(NextResponse.json({ error: "Нужна авторизация." }, { status: 401 }));
    }

    const { searchParams } = new URL(request.url);
    const requestedBusinessId = searchParams.get("businessId");
    const customerId = searchParams.get("customerId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const requestedOffset = Number(searchParams.get("offset") || 0);
    const cursor = searchParams.get("cursor");

    const where: any = {};

    if (session.role === "SUPER_ADMIN") {
      if (requestedBusinessId) {
        where.businessId = requestedBusinessId;
      }
    } else {
      if (!session.businessId) {
        return finishTiming(NextResponse.json({ error: "У вас нет привязанного бизнеса." }, { status: 403 }));
      }
      where.businessId = session.businessId;
    }

    if (customerId) {
      where.customerId = customerId;
    }
    if (status && status !== "ALL") {
      where.status = status;
    }

    const take = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20;
    const skip = Number.isFinite(requestedOffset) ? Math.max(Math.floor(requestedOffset), 0) : 0;
    if (typeof where.businessId === "string") {
      await recoverStalePaymentProofChecks({
        businessId: where.businessId,
      }).catch((error) => {
        console.warn("[PAYMENT PROOF AI] stale status recovery skipped:", error);
      });
    }

    let orders;
    try {
      orders = await prisma.order.findMany({
        where,
        select: adminOrdersSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : { skip }),
      });
    } catch (error) {
      const classification = classifyDatabaseError(error);
      if (classification.type !== "missing_table" && classification.type !== "missing_column") throw error;
      warnPrismaSchemaDrift("Seller orders retried without courier/delivery relations", error);
      orders = await prisma.order.findMany({
        where,
        select: adminOrdersLegacySelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : { skip }),
      });
    }

    const hasMore = orders.length > take;
    const page = hasMore ? orders.slice(0, take) : orders;
    const response = NextResponse.json(toJsonSafe(page));
    response.headers.set("X-Has-More", hasMore ? "true" : "false");
    if (hasMore && page.length > 0) {
      response.headers.set("X-Next-Cursor", page[page.length - 1].id);
    }
    return finishTiming(response);
  } catch (error) {
    console.error("Error fetching orders:", error);
    if (isBusinessIsDemoMissingColumnError(error)) {
      warnPrismaSchemaDrift("Orders query failed while Business.isDemo is missing", error);
    }
    const classification = classifyDatabaseError(error);
    return finishTiming(NextResponse.json({ code: classification.code, error: "Не удалось загрузить заказы." }, { status: 503 }));
  }
}
