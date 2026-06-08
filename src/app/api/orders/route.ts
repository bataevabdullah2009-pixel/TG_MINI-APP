import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { NotificationService } from "@/lib/notifications/notification-service";
import { ensureTelegramUser } from "@/lib/auth/telegram-user-service";
import { analyzePaymentProof } from "@/lib/ai/payment-proof-analyzer";
import { getTelegramSessionUser, parseTelegramInitData } from "@/lib/auth-telegram";
import { classifyDatabaseError, isBusinessIsDemoMissingColumnError, isPrismaMissingColumnError, warnPrismaSchemaDrift, toJsonSafe } from "@/lib/prisma-schema-guard";
import { isStrictRuPhoneInput, normalizeRuPhone, validateCustomerName } from "@/lib/phone/phone-utils";

const ORDER_ERROR = "Не удалось оформить заказ. Проверьте данные и попробуйте снова.";
const PHONE_VERIFICATION_ERROR = "Для оформления заказа подтвердите номер телефона.";
const PHONE_MISMATCH_ERROR = "Номер телефона не совпадает с подтверждённым Telegram-номером.";
const RATE_LIMIT_ERROR = "Слишком много попыток. Попробуйте позже.";

const checkoutBusinessLegacySelect = {
  id: true,
  slug: true,
  name: true,
  isActive: true,
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

const adminOrdersInclude = {
  items: true,
  business: { select: { name: true, slug: true } },
  customer: true,
  deliveryZone: true,
  deliveryAssignment: { include: { courier: true } },
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

const paymentCheckoutOrderSelect = {
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

type CurrentCheckoutOrder = Prisma.OrderGetPayload<{ include: typeof checkoutOrderInclude }>;
type LegacyCheckoutOrder = Prisma.OrderGetPayload<{ select: typeof legacyCheckoutOrderSelect }>;
type PaymentCheckoutOrder = Prisma.OrderGetPayload<{ select: typeof paymentCheckoutOrderSelect }>;

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
  if (!Number.isFinite(parsed)) return 0;
  return Math.floor(parsed);
}

function orderError(code: string, error: string, status = 400) {
  return NextResponse.json({ ok: false, code, error }, { status });
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
    } = body;

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

    if (!business || !business.isActive) {
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
    let deliveryZone: { id: string; name: string; cityArea: string; fee: number } | null = null;
    let legacyDeliveryFee = 0;
    if (normalizedDeliveryType === "DELIVERY") {
      if (!deliverySettings?.deliveryEnabled) {
        return orderError("DELIVERY_DISABLED", "Доставка у этого магазина выключена.");
      }
      try {
        if (cleanString(deliveryZoneId)) {
          deliveryZone = await prisma.deliveryZone.findFirst({
            where: { id: cleanString(deliveryZoneId), businessId: business.id, isActive: true },
            select: { id: true, name: true, cityArea: true, fee: true },
          });
          if (!deliveryZone) {
            return orderError("DELIVERY_ZONE_NOT_FOUND", "Выбранная зона доставки недоступна.");
          }
        } else {
          const activeZones = await prisma.deliveryZone.count({ where: { businessId: business.id, isActive: true } });
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

    let totalPrice = 0;
    const orderItems: Array<{ name: string; price: number; quantity: number; itemId: string }> = [];

    for (const item of items) {
      const quantity = toPositiveInt(item.quantity);
      if (!item.itemId || quantity <= 0) {
        await recordAttempt({ businessId: business.id, telegramUserId: telegramId, phone: normalizedPhone, success: false, reason: "INVALID_ITEM" });
        return orderError("INVALID_ITEM", "В корзине есть некорректная позиция.");
      }

      const dbItem = await prisma.item.findUnique({
        where: { id: item.itemId },
        select: { id: true, businessId: true, name: true, price: true, isAvailable: true },
      });
      if (!dbItem || dbItem.businessId !== business.id || !dbItem.isAvailable) {
        await recordAttempt({ businessId: business.id, telegramUserId: telegramId, phone: normalizedPhone, success: false, reason: "ITEM_UNAVAILABLE" });
        return orderError("ITEM_UNAVAILABLE", "Одна из позиций больше недоступна. Обновите корзину.");
      }

      totalPrice += dbItem.price * quantity;
      orderItems.push({
        name: dbItem.name,
        price: dbItem.price,
        quantity,
        itemId: dbItem.id,
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

    const rateLimited = await enforceOrderRateLimit({
      businessId: business.id,
      telegramUserId: telegramId,
      phone: verifiedCustomerPhone,
      ipAddress: requestIpAddress,
    });
    if (rateLimited) return rateLimited;

    const itemsSubtotal = totalPrice;
    if (normalizedDeliveryType === "DELIVERY" && itemsSubtotal < (deliverySettings?.minOrderAmount || 0)) {
      return orderError("MIN_DELIVERY_AMOUNT", `Минимальная сумма заказа для доставки: ${deliverySettings?.minOrderAmount || 0} ₽.`);
    }
    const calculatedDeliveryFee = normalizedDeliveryType === "DELIVERY" ? deliveryZone?.fee ?? legacyDeliveryFee : 0;
    totalPrice = itemsSubtotal + calculatedDeliveryFee;

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
        create: orderItems,
      },
    };
    const baseOrderData = {
      ...legacyBaseOrderData,
      itemsSubtotal,
      deliveryFee: calculatedDeliveryFee,
      deliveryStatus: normalizedDeliveryType === "DELIVERY" ? "NEW" as const : "NONE" as const,
      deliveryZoneId: deliveryZone?.id || null,
      deliveryZoneName: deliveryZone?.name || null,
      deliveryCityArea: deliveryZone?.cityArea || null,
    };
    let orderResult: CurrentCheckoutOrder | PaymentCheckoutOrder | LegacyCheckoutOrder;

    try {
      orderResult = await prisma.order.create({
        data: {
          ...baseOrderData,
          paymentMethod: requestedPaymentMethod,
          paymentStatus: requestedPaymentMethod === "TRANSFER" ? "AWAITING_REVIEW" : "PENDING",
          paymentProofUrl: requestedPaymentMethod === "TRANSFER" ? cleanString(paymentProofUrl) : null,
          paymentProofFileName: requestedPaymentMethod === "TRANSFER" ? cleanString(paymentProofFileName) || null : null,
          paymentProofMimeType: requestedPaymentMethod === "TRANSFER" ? cleanString(paymentProofMimeType) || null : null,
          paymentProofAiStatus: requestedPaymentMethod === "TRANSFER"
            ? cleanString(paymentProofMimeType).startsWith("image/") ? "PENDING" : "MANUAL_REVIEW"
            : null,
        },
        include: checkoutOrderInclude,
      });
    } catch (error) {
      if (!isPrismaMissingColumnError(error)) throw error;
      usedCheckoutSchemaFallback = true;
      warnPrismaSchemaDrift("Checkout retried without courier/delivery columns", error);
      orderResult = requestedPaymentMethod === "TRANSFER"
        ? await prisma.order.create({
            data: {
              ...legacyBaseOrderData,
              paymentMethod: "TRANSFER",
              paymentStatus: "AWAITING_REVIEW",
              paymentProofUrl: cleanString(paymentProofUrl),
              paymentProofAiStatus: null,
            },
            select: paymentCheckoutOrderSelect,
          })
        : await prisma.order.create({
            data: legacyBaseOrderData,
            select: legacyCheckoutOrderSelect,
          });
    }

    const order = {
      ...orderResult,
      paymentMethod: "paymentMethod" in orderResult ? orderResult.paymentMethod : "CASH",
      paymentStatus: "paymentStatus" in orderResult ? orderResult.paymentStatus : "PENDING",
      paymentProofUrl: "paymentProofUrl" in orderResult ? orderResult.paymentProofUrl : null,
      paymentProofFileName: "paymentProofFileName" in orderResult ? orderResult.paymentProofFileName : null,
      paymentProofMimeType: "paymentProofMimeType" in orderResult ? orderResult.paymentProofMimeType : null,
      paymentProofAiStatus: "paymentProofAiStatus" in orderResult ? orderResult.paymentProofAiStatus : null,
      paymentProofAiSummary: "paymentProofAiSummary" in orderResult ? orderResult.paymentProofAiSummary : null,
      paymentProofAiConfidence: "paymentProofAiConfidence" in orderResult ? orderResult.paymentProofAiConfidence : null,
      paymentReviewedAt: "paymentReviewedAt" in orderResult ? orderResult.paymentReviewedAt : null,
      paymentReviewedBy: "paymentReviewedBy" in orderResult ? orderResult.paymentReviewedBy : null,
      paymentRejectReason: "paymentRejectReason" in orderResult ? orderResult.paymentRejectReason : null,
      expiredAt: "expiredAt" in orderResult ? orderResult.expiredAt : null,
      expireReason: "expireReason" in orderResult ? orderResult.expireReason : null,
      itemsSubtotal: "itemsSubtotal" in orderResult ? orderResult.itemsSubtotal : orderResult.totalPrice,
      deliveryFee: "deliveryFee" in orderResult ? orderResult.deliveryFee : 0,
      deliveryStatus: "deliveryStatus" in orderResult ? orderResult.deliveryStatus : "NONE",
      deliveryZoneId: "deliveryZoneId" in orderResult ? orderResult.deliveryZoneId : null,
      deliveryZoneName: "deliveryZoneName" in orderResult ? orderResult.deliveryZoneName : null,
      deliveryCityArea: "deliveryCityArea" in orderResult ? orderResult.deliveryCityArea : null,
    };

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

    if (requestedPaymentMethod === "TRANSFER" && order.paymentProofUrl && order.paymentProofMimeType?.startsWith("image/")) {
      analyzePaymentProof({
        imageUrl: order.paymentProofUrl,
        orderTotal: order.totalPrice,
        businessName: business.name,
        recipientName: business.transferRecipientName,
        paymentPhone: business.transferPaymentPhone,
        bankName: business.transferBankName,
        orderCreatedAt: order.createdAt,
      })
        .then((analysis) =>
          prisma.order.update({
            where: { id: order.id },
            data: {
              paymentProofAiStatus: analysis.status,
              paymentProofAiSummary: analysis.summary,
              paymentProofAiConfidence: analysis.confidence,
            },
            select: { id: true },
          })
        )
        .catch((error) => console.warn("[PAYMENT PROOF AI] background update failed:", error));
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
  try {
    const session = await getAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: "Нужна авторизация." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedBusinessId = searchParams.get("businessId");
    const customerId = searchParams.get("customerId");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const where: any = {};

    if (session.role === "SUPER_ADMIN") {
      if (requestedBusinessId) {
        where.businessId = requestedBusinessId;
      }
    } else {
      if (!session.businessId) {
        return NextResponse.json({ error: "У вас нет привязанного бизнеса." }, { status: 403 });
      }
      where.businessId = session.businessId;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    const take = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20;
    let orders;
    try {
      orders = await prisma.order.findMany({
        where,
        include: adminOrdersInclude,
        orderBy: { createdAt: "desc" },
        take,
      });
    } catch (error) {
      const classification = classifyDatabaseError(error);
      if (classification.type !== "missing_table" && classification.type !== "missing_column") throw error;
      warnPrismaSchemaDrift("Seller orders retried without courier/delivery relations", error);
      orders = await prisma.order.findMany({
        where,
        select: adminOrdersLegacySelect,
        orderBy: { createdAt: "desc" },
        take,
      });
    }

    return NextResponse.json(toJsonSafe(orders));
  } catch (error) {
    console.error("Error fetching orders:", error);
    if (isBusinessIsDemoMissingColumnError(error)) {
      warnPrismaSchemaDrift("Orders query failed while Business.isDemo is missing", error);
    }
    const classification = classifyDatabaseError(error);
    return NextResponse.json({ code: classification.code, error: "Не удалось загрузить заказы." }, { status: 503 });
  }
}
