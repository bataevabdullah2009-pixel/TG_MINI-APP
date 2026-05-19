import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/lib/notifications/notification-service";
import { ensureTelegramUser } from "@/lib/auth/telegram-user-service";

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

    const business = await prisma.business.findFirst({
      where: { OR: [{ id: businessId }, { slug: businessId }] },
    });

    if (!business || !business.isActive) {
      return NextResponse.json({ error: "Business not found or inactive" }, { status: 404 });
    }

    if (business.subscriptionStatus === "BLOCKED" || business.subscriptionStatus === "EXPIRED") {
      return NextResponse.json({ error: "Business subscription is not active" }, { status: 403 });
    }

    let totalPrice = 0;
    const orderItems: any[] = [];

    for (const item of items) {
      const dbItem = await prisma.item.findUnique({
        where: { id: item.itemId },
      });

      if (!dbItem || !dbItem.isAvailable) {
        return NextResponse.json(
          { error: `Item ${item.itemId} not available` },
          { status: 400 }
        );
      }

      totalPrice += dbItem.price * item.quantity;
      orderItems.push({
        name: dbItem.name,
        price: dbItem.price,
        quantity: item.quantity,
        itemId: dbItem.id,
      });
    }

    let customerId: string | undefined;
    if (telegramUserId) {
      const existingCustomer = await prisma.customer.findUnique({
        where: {
          businessId_telegramUserId: {
            businessId: business.id,
            telegramUserId: BigInt(telegramUserId),
          },
        },
      });

      const isDevBypass = process.env.ALLOW_UNVERIFIED_PHONE_IN_DEV === "true" || process.env.NODE_ENV !== "production";
      if (existingCustomer && !existingCustomer.phoneVerified && !isDevBypass) {
        return NextResponse.json({ error: "Телефону требуется подтверждение." }, { status: 403 });
      }

      const user = await ensureTelegramUser({
        telegramId: BigInt(telegramUserId),
        username: username || null,
        firstName: customerName || null,
      });

      const customer = await prisma.customer.upsert({
        where: {
          businessId_telegramUserId: {
            businessId: business.id,
            telegramUserId: BigInt(telegramUserId),
          },
        },
        update: {
          userId: user.id,
          name: customerName,
          phone: customerPhone,
          username,
          address: customerAddress,
          totalOrders: { increment: 1 },
          totalSpent: { increment: totalPrice },
        },
        create: {
          businessId: business.id,
          userId: user.id,
          telegramUserId: BigInt(telegramUserId),
          name: customerName,
          phone: customerPhone,
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
        customerName,
        customerPhone,
        totalPrice,
        status: "NEW",
        deliveryType,
        comment,
        items: {
          create: orderItems,
        },
      },
      include: { items: true },
    });

    await NotificationService.notifyBusinessOwnerNewOrder(order.id);

    // TODO: Create payment record

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const customerId = searchParams.get("customerId");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: any = {};

    if (businessId) {
      where.businessId = businessId;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    const orders = await prisma.order.findMany({
      where,
      include: { items: true, business: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
