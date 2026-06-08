import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/lib/notifications/notification-service";
import {
  canUseBusiness,
  getAdminSession,
  jsonError,
} from "@/lib/admin-auth";
import {
  SELLER_BLOCKED_MESSAGE,
  canBusinessOperate,
} from "@/lib/subscriptions/business-subscription-service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в панель продавца.", 401);

    const { id } = await context.params;
    const body = await request.json();
    const { status, internalNotes } = body;

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return NextResponse.json({ error: "Запись не найдена." }, { status: 404 });
    }
    if (!canUseBusiness(session, booking.businessId)) {
      return jsonError("Нет доступа к этой записи.", 403);
    }
    if (session.role !== "SUPER_ADMIN") {
      const access = await canBusinessOperate(booking.businessId);
      if (!access.canManageOrders) {
        return jsonError(access.reason || SELLER_BLOCKED_MESSAGE, 403);
      }
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(internalNotes !== undefined && { internalNotes }),
      },
      include: {
        service: { select: { name: true, price: true } },
        staff: { select: { name: true } },
      },
    });

    await NotificationService.notifyCustomerBookingStatus(updated.customerId, updated.id);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating booking:", error);
    return NextResponse.json({ error: "Не удалось обновить запись." }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        service: true,
        staff: true,
        customer: true,
        business: { select: { name: true, slug: true, phone: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Запись не найдена." }, { status: 404 });
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error("Error fetching booking:", error);
    return NextResponse.json({ error: "Не удалось загрузить запись." }, { status: 500 });
  }
}
