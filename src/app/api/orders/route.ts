import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { NotificationService } from "@/lib/notifications/notification-service";
import { ensureTelegramUser } from "@/lib/auth/telegram-user-service";
import { isBusinessIsDemoMissingColumnError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";

const ORDER_ERROR = "Не удалось оформить заказ. Проверьте данные и попробуйте снова.";
const PHONE_VERIFICATION_ERROR = "Для оформления заказа подтвердите номер телефона.";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toPositiveInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.floor(parsed);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      businessId,
      customerName,
      customerPhone,
      customerAddress,
      items,
      deliveryType,
      comment,
      telegramUserId,
      username,
    } = body;

    if (!businessId) {
      return NextResponse.json({ error: "Бизнес не выбран." }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Корзина пустая. Добавьте товары перед оформлением заказа." }, { status: 400 });
    }

    const cleanCustomerName = cleanString(customerName);
    const cleanCustomerPhone = cleanString(customerPhone);
    if (cleanCustomerName.length < 2 || cleanCustomerPhone.length < 10) {
      return NextResponse.json({ error: "Укажите имя и корректный номер телефона." }, { status: 400 });
    }

    const business = await prisma.business.findFirst({
      where: { OR: [{ id: businessId }, { slug: businessId }] },
      select: { id: true, isActive: true, subscriptionStatus: true },
    });

    if (!business || !business.isActive) {
      return NextResponse.json({ error: "Бизнес не найден или временно недоступен." }, { status: 404 });
    }

    if (business.subscriptionStatus === "BLOCKED" || business.subscriptionStatus === "EXPIRED") {
      return NextResponse.json({ error: "Заказы временно недоступны. Свяжитесь с продавцом." }, { status: 403 });
    }

    let totalPrice = 0;
    const orderItems: Array<{ name: string; price: number; quantity: number; itemId: string }> = [];

    for (const item of items) {
      const quantity = toPositiveInt(item.quantity);
      if (!item.itemId || quantity <= 0) {
        return NextResponse.json({ error: "В корзине есть некорректная позиция." }, { status: 400 });
      }

      const dbItem = await prisma.item.findUnique({ where: { id: item.itemId } });
      if (!dbItem || dbItem.businessId !== business.id || !dbItem.isAvailable) {
        return NextResponse.json({ error: "Одна из позиций больше недоступна. Обновите корзину." }, { status: 400 });
      }

      totalPrice += dbItem.price * quantity;
      orderItems.push({
        name: dbItem.name,
        price: dbItem.price,
        quantity,
        itemId: dbItem.id,
      });
    }

    let customerId: string | undefined;
    if (telegramUserId) {
      let telegramId: bigint;
      try {
        telegramId = BigInt(telegramUserId);
      } catch {
        return NextResponse.json({ error: "Не удалось определить Telegram-пользователя." }, { status: 400 });
      }

      const existingCustomer = await prisma.customer.findUnique({
        where: {
          businessId_telegramUserId: {
            businessId: business.id,
            telegramUserId: telegramId,
          },
        },
      });

      const isDevBypass = process.env.ALLOW_UNVERIFIED_PHONE_IN_DEV === "true" || process.env.NODE_ENV !== "production";
      if (existingCustomer && !existingCustomer.phoneVerified && !isDevBypass) {
        return NextResponse.json({ error: PHONE_VERIFICATION_ERROR }, { status: 403 });
      }

      const user = await ensureTelegramUser({
        telegramId,
        username: username || null,
        firstName: cleanCustomerName || null,
      });

      const customer = await prisma.customer.upsert({
        where: {
          businessId_telegramUserId: {
            businessId: business.id,
            telegramUserId: telegramId,
          },
        },
        update: {
          userId: user.id,
          name: cleanCustomerName,
          phone: cleanCustomerPhone,
          username,
          address: customerAddress,
          totalOrders: { increment: 1 },
          totalSpent: { increment: totalPrice },
        },
        create: {
          businessId: business.id,
          userId: user.id,
          telegramUserId: telegramId,
          name: cleanCustomerName,
          phone: cleanCustomerPhone,
          username,
          address: customerAddress,
          totalOrders: 1,
          totalSpent: totalPrice,
        },
      });
      customerId = customer.id;
    }

    const order = await prisma.order.create({
      data: {
        businessId: business.id,
        customerId,
        customerAddress,
        customerName: cleanCustomerName,
        customerPhone: cleanCustomerPhone,
        totalPrice,
        status: "NEW",
        deliveryType: deliveryType === "DELIVERY" ? "DELIVERY" : "PICKUP",
        comment,
        items: {
          create: orderItems,
        },
      },
      include: { items: true },
    });

    await NotificationService.notifyBusinessOwnerNewOrder(order.id);

    return NextResponse.json({ ...order, ok: true }, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    if (isBusinessIsDemoMissingColumnError(error)) {
      warnPrismaSchemaDrift("Order creation hit Business.isDemo schema drift", error);
      return NextResponse.json({ error: "Оформление заказа временно недоступно." }, { status: 503 });
    }
    return NextResponse.json({ error: ORDER_ERROR }, { status: 500 });
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
      include: { items: true, business: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20,
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    if (isBusinessIsDemoMissingColumnError(error)) {
      warnPrismaSchemaDrift("Orders loaded as an empty list while Business.isDemo is missing", error);
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: "Не удалось загрузить заказы." }, { status: 500 });
  }
}
