import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/lib/notifications/notification-service";
import { ensureTelegramUser } from "@/lib/auth/telegram-user-service";
import { classifyDatabaseError, isBusinessIsDemoMissingColumnError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";

import { getAdminSession } from "@/lib/admin-auth";
import {
  BUSINESS_BLOCKED_MESSAGE,
  canBusinessOperate,
} from "@/lib/subscriptions/business-subscription-service";

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: "Нужна авторизация." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedBusinessId = searchParams.get("businessId");
    const staffId = searchParams.get("staffId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: any = {};

    if (session.role === "SUPER_ADMIN") {
      if (requestedBusinessId) {
        where.businessId = requestedBusinessId;
      }
    } else {
      // Regular seller / manager is isolated strictly to their own business
      if (!session.businessId) {
        return NextResponse.json({ error: "У вас нет привязанного бизнеса." }, { status: 403 });
      }
      where.businessId = session.businessId;
    }

    if (staffId) {
      where.staffId = staffId;
    }

    if (status) {
      where.status = status as any;
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        service: { select: { id: true, name: true, price: true, durationMinutes: true } },
        staff: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, phone: true } },
        business: { select: { name: true, slug: true } },
      },
      orderBy: { startTime: "asc" },
      take: limit,
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    if (isBusinessIsDemoMissingColumnError(error)) {
      warnPrismaSchemaDrift("Bookings query failed while Business.isDemo is missing", error);
    }
    const classification = classifyDatabaseError(error);
    return NextResponse.json({ code: classification.code, error: "Не удалось загрузить записи." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      businessId,
      serviceId,
      staffId,
      customerName,
      customerPhone,
      startTime,
      endTime,
      comment,
      telegramUserId,
      username,
    } = body;

    if (!businessId || !customerName || !customerPhone || !startTime) {
      return NextResponse.json({ error: "Заполните обязательные поля для записи." }, { status: 400 });
    }

    const business = await prisma.business.findFirst({
      where: { OR: [{ id: businessId }, { slug: businessId }] },
      select: { id: true, isActive: true },
    });
    if (!business || !business.isActive) {
      return NextResponse.json({ error: "Бизнес не найден или временно недоступен." }, { status: 404 });
    }
    const operationAccess = await canBusinessOperate(business.id);
    if (!operationAccess.canCreateOrder) {
      return NextResponse.json(
        {
          ok: false,
          code: "BUSINESS_BLOCKED",
          error: operationAccess.reason || BUSINESS_BLOCKED_MESSAGE,
        },
        { status: 403 }
      );
    }

    // Calculate endTime from service duration if not provided
    let calculatedEndTime = endTime;
    if (!calculatedEndTime && serviceId) {
      const service = await prisma.item.findUnique({ where: { id: serviceId } });
      if (service?.durationMinutes) {
        const start = new Date(startTime);
        calculatedEndTime = new Date(start.getTime() + service.durationMinutes * 60000).toISOString();
      }
    }

    if (!calculatedEndTime) {
      const start = new Date(startTime);
      calculatedEndTime = new Date(start.getTime() + 60 * 60000).toISOString();
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
        },
        create: {
          businessId: business.id,
          userId: user.id,
          telegramUserId: BigInt(telegramUserId),
          name: customerName,
          phone: customerPhone,
          username,
        },
      });
      customerId = customer.id;
    }

    const booking = await prisma.booking.create({
      data: {
        businessId: business.id,
        customerId,
        serviceId: serviceId || undefined,
        staffId: staffId || undefined,
        customerName,
        customerPhone,
        startTime: new Date(startTime),
        endTime: new Date(calculatedEndTime),
        status: "NEW",
        comment,
      },
      include: {
        service: { select: { name: true, price: true } },
        staff: { select: { name: true } },
      },
    });

    await NotificationService.notifyBusinessOwnerNewBooking(booking.id);

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error("Error creating booking:", error);
    if (isBusinessIsDemoMissingColumnError(error)) {
      warnPrismaSchemaDrift("Booking creation hit Business.isDemo schema drift", error);
      return NextResponse.json({ error: "Создание записи временно недоступно." }, { status: 503 });
    }
    return NextResponse.json({ error: "Не удалось создать запись. Проверьте данные и попробуйте снова." }, { status: 500 });
  }
}
