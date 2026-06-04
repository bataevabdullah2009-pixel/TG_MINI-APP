import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { NotificationService } from "@/lib/notifications/notification-service";
import { ensureTelegramUser } from "@/lib/auth/telegram-user-service";
import { analyzePaymentProof } from "@/lib/ai/payment-proof-analyzer";
import { isBusinessIsDemoMissingColumnError, warnPrismaSchemaDrift, toJsonSafe } from "@/lib/prisma-schema-guard";
import { normalizeRuPhone, validateCustomerName } from "@/lib/phone/phone-utils";

const ORDER_ERROR = "Не удалось оформить заказ. Проверьте данные и попробуйте снова.";
const PHONE_VERIFICATION_ERROR = "Для оформления заказа подтвердите номер телефона.";
const PHONE_MISMATCH_ERROR = "Номер телефона не совпадает с подтверждённым Telegram-номером.";
const RATE_LIMIT_ERROR = "Слишком много попыток. Попробуйте позже.";

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
  success: boolean;
  reason?: string;
}) {
  try {
    await prisma.orderAttempt.create({
      data: {
        businessId: input.businessId,
        telegramUserId: input.telegramUserId,
        phone: input.phone || null,
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
}) {
  try {
    const now = Date.now();
    const tenMinutesAgo = new Date(now - 10 * 60 * 1000);
    const hourAgo = new Date(now - 60 * 60 * 1000);

    const [checkoutAttempts, recentTelegramOrders, recentPhoneOrders] = await Promise.all([
      prisma.orderAttempt.count({
        where: {
          telegramUserId: input.telegramUserId,
          createdAt: { gte: tenMinutesAgo },
        },
      }),
      prisma.orderAttempt.count({
        where: {
          telegramUserId: input.telegramUserId,
          success: true,
          createdAt: { gte: tenMinutesAgo },
        },
      }),
      prisma.orderAttempt.count({
        where: {
          phone: input.phone,
          success: true,
          createdAt: { gte: hourAgo },
        },
      }),
    ]);

    if (checkoutAttempts >= 10 || recentTelegramOrders >= 3 || recentPhoneOrders >= 5) {
      await recordOrderAttempt({
        businessId: input.businessId,
        telegramUserId: input.telegramUserId,
        phone: input.phone,
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

export async function POST(request: NextRequest) {
  let telegramId: bigint | null = null;
  let normalizedPhone: string | null = null;
  let resolvedBusinessId: string | undefined;

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
      comment,
      telegramUserId,
      username,
      paymentMethod,
      paymentProofUrl,
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

    if (!Array.isArray(items) || items.length === 0) {
      await recordOrderAttempt({ telegramUserId: telegramId, success: false, reason: "EMPTY_CART" });
      return orderError("EMPTY_CART", "Корзина пустая. Добавьте товары перед оформлением заказа.");
    }

    const cleanCustomerName = validateCustomerName(customerName);
    if (!cleanCustomerName) {
      await recordOrderAttempt({ telegramUserId: telegramId, success: false, reason: "INVALID_NAME" });
      return orderError("INVALID_NAME", "Введите настоящее имя без цифр и символов.");
    }

    normalizedPhone = normalizeRuPhone(customerPhone);
    if (!normalizedPhone) {
      await recordOrderAttempt({ telegramUserId: telegramId, success: false, reason: "INVALID_PHONE" });
      return orderError("INVALID_PHONE", "Введите корректный номер телефона.");
    }

    const normalizedDeliveryType = deliveryType === "DELIVERY" ? "DELIVERY" : "PICKUP";
    const cleanAddress = cleanString(customerAddress);
    if (normalizedDeliveryType === "DELIVERY" && cleanAddress.length < 5) {
      await recordOrderAttempt({ telegramUserId: telegramId, phone: normalizedPhone, success: false, reason: "ADDRESS_REQUIRED" });
      return orderError("ADDRESS_REQUIRED", "Укажите адрес доставки.");
    }

    const business = await prisma.business.findFirst({
      where: { OR: [{ id: businessValue }, { slug: businessValue }] },
      select: {
        id: true,
        slug: true,
        name: true,
        isActive: true,
        subscriptionStatus: true,
        transferPaymentEnabled: true,
        transferBankName: true,
        transferPaymentPhone: true,
        transferRecipientName: true,
      },
    });

    if (!business || !business.isActive) {
      await recordOrderAttempt({ telegramUserId: telegramId, phone: normalizedPhone, success: false, reason: "BUSINESS_NOT_FOUND" });
      return orderError("BUSINESS_NOT_FOUND", "Бизнес не найден или временно недоступен.", 404);
    }
    resolvedBusinessId = business.id;

    if (business.subscriptionStatus === "BLOCKED" || business.subscriptionStatus === "EXPIRED") {
      await recordOrderAttempt({ businessId: business.id, telegramUserId: telegramId, phone: normalizedPhone, success: false, reason: "BUSINESS_BLOCKED" });
      return orderError("BUSINESS_BLOCKED", "Заказы временно недоступны. Свяжитесь с продавцом.", 403);
    }

    const requestedPaymentMethod = paymentMethod === "TRANSFER" || paymentMethod === "transfer" ? "TRANSFER" : "CASH";
    if (requestedPaymentMethod === "TRANSFER") {
      if (!business.transferPaymentEnabled) {
        return orderError("TRANSFER_DISABLED", "Оплата переводом сейчас недоступна.");
      }
      if (!cleanString(paymentProofUrl)) {
        return orderError("PAYMENT_PROOF_REQUIRED", "Загрузите чек перевода.");
      }
    }

    let totalPrice = 0;
    const orderItems: Array<{ name: string; price: number; quantity: number; itemId: string }> = [];

    for (const item of items) {
      const quantity = toPositiveInt(item.quantity);
      if (!item.itemId || quantity <= 0) {
        await recordOrderAttempt({ businessId: business.id, telegramUserId: telegramId, phone: normalizedPhone, success: false, reason: "INVALID_ITEM" });
        return orderError("INVALID_ITEM", "В корзине есть некорректная позиция.");
      }

      const dbItem = await prisma.item.findUnique({ where: { id: item.itemId } });
      if (!dbItem || dbItem.businessId !== business.id || !dbItem.isAvailable) {
        await recordOrderAttempt({ businessId: business.id, telegramUserId: telegramId, phone: normalizedPhone, success: false, reason: "ITEM_UNAVAILABLE" });
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
      username: username || null,
      firstName: cleanCustomerName,
    });

    let customer = await prisma.customer.upsert({
      where: {
        businessId_telegramUserId: {
          businessId: business.id,
          telegramUserId: telegramId,
        },
      },
      update: {
        userId: user.id,
        name: cleanCustomerName,
        username,
        address: cleanAddress || undefined,
      },
      create: {
        businessId: business.id,
        userId: user.id,
        telegramUserId: telegramId,
        name: cleanCustomerName,
        phone: normalizedPhone,
        username,
        address: cleanAddress || undefined,
      },
    });

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
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          phone: verifiedUserPhone,
          phoneVerified: true,
          verificationMethod: customer.verificationMethod === "telegram_contact" ? "telegram_contact" : "global_user_phone",
        },
      });
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
      await recordOrderAttempt({ businessId: business.id, telegramUserId: telegramId, phone: normalizedPhone, success: false, reason: "CUSTOMER_BLOCKED" });
      return orderError("CUSTOMER_BLOCKED", "Ваш аккаунт временно ограничен.", 403);
    }

    const verifiedCustomerPhone = customer.phoneVerified ? normalizeRuPhone(customer.phone) : null;
    if (!verifiedCustomerPhone) {
      await recordOrderAttempt({ businessId: business.id, telegramUserId: telegramId, phone: normalizedPhone, success: false, reason: "PHONE_NOT_VERIFIED" });
      return orderError("PHONE_NOT_VERIFIED", PHONE_VERIFICATION_ERROR, 403);
    }

    if (normalizedPhone !== verifiedCustomerPhone) {
      await recordOrderAttempt({ businessId: business.id, telegramUserId: telegramId, phone: normalizedPhone, success: false, reason: "PHONE_MISMATCH" });
      return orderError("PHONE_MISMATCH", PHONE_MISMATCH_ERROR, 403);
    }

    const rateLimited = await enforceOrderRateLimit({
      businessId: business.id,
      telegramUserId: telegramId,
      phone: verifiedCustomerPhone,
    });
    if (rateLimited) return rateLimited;

    const order = await prisma.order.create({
      data: {
        businessId: business.id,
        customerId: customer.id,
        customerAddress: normalizedDeliveryType === "DELIVERY" ? cleanAddress : null,
        customerName: cleanCustomerName,
        customerPhone: verifiedCustomerPhone,
        totalPrice,
        status: "NEW",
        deliveryType: normalizedDeliveryType,
        paymentMethod: requestedPaymentMethod,
        paymentStatus: requestedPaymentMethod === "TRANSFER" ? "AWAITING_REVIEW" : "PENDING",
        paymentProofUrl: requestedPaymentMethod === "TRANSFER" ? cleanString(paymentProofUrl) : null,
        paymentProofAiStatus: requestedPaymentMethod === "TRANSFER" ? "PENDING" : null,
        comment: cleanString(comment) || null,
        items: {
          create: orderItems,
        },
      },
      include: { items: true, business: { select: { name: true, slug: true } } },
    });

    await recordOrderAttempt({
      businessId: business.id,
      telegramUserId: telegramId,
      phone: verifiedCustomerPhone,
      success: true,
      reason: "ORDER_CREATED",
    });

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        totalOrders: { increment: 1 },
        totalSpent: { increment: totalPrice },
      },
    });

    if (requestedPaymentMethod === "TRANSFER" && order.paymentProofUrl) {
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

    await NotificationService.notifyBusinessOwnerNewOrder(order.id);

    return NextResponse.json(toJsonSafe({ ...order, ok: true }), { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    if (telegramId) {
      await recordOrderAttempt({
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
    return NextResponse.json({ ok: false, error: ORDER_ERROR }, { status: 500 });
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

    const orders = await prisma.order.findMany({
      where,
      include: { items: true, business: { select: { name: true, slug: true } }, customer: true },
      orderBy: { createdAt: "desc" },
      take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20,
    });

    return NextResponse.json(toJsonSafe(orders));
  } catch (error) {
    console.error("Error fetching orders:", error);
    if (isBusinessIsDemoMissingColumnError(error)) {
      warnPrismaSchemaDrift("Orders loaded as an empty list while Business.isDemo is missing", error);
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: "Не удалось загрузить заказы." }, { status: 500 });
  }
}
