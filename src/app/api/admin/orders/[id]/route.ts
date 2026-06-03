import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { NotificationService } from "@/lib/notifications/notification-service";

// Strict Prisma OrderStatus values
const ALLOWED_STATUSES = new Set([
  "NEW",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "DELIVERING",
  "COMPLETED",
  "CANCELLED"
]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    // 1. Authenticate administrator session
    const session = await getAdminSession(request);
    if (!session) {
      return jsonError("Нужен вход в админку.", 401);
    }

    // 2. Fetch the target order
    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return jsonError("Заказ не найден.", 404);
    }

    // 3. Verify administrative rights for the order's business
    if (!canUseBusiness(session, order.businessId)) {
      return jsonError("Нет доступа к управлению заказами этого бизнеса.", 403);
    }

    const body = await request.json();
    let { status, internalNotes } = body;

    if (!status) {
      return jsonError("Укажите статус для обновления.", 400);
    }

    status = String(status).toUpperCase();

    // Map PROCESSING status to ACCEPTED
    if (status === "PROCESSING") {
      status = "ACCEPTED";
    }

    // Validate the target status
    if (!ALLOWED_STATUSES.has(status)) {
      return jsonError(`Недопустимый статус заказа: ${status}. Разрешены только: NEW, ACCEPTED, PREPARING, READY, DELIVERING, COMPLETED, CANCELLED.`, 400);
    }

    // 4. Update order details
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status,
        ...(internalNotes !== undefined ? { internalNotes } : {}),
      },
      include: { items: true },
    });

    // 5. Notify the customer of status updates safely in the background
    try {
      await NotificationService.notifyCustomerOrderStatus(updatedOrder.customerId || "", updatedOrder.id);
    } catch (notificationError) {
      console.warn("Could not dispatch customer push notification:", notificationError);
    }

    return NextResponse.json({ ok: true, data: updatedOrder });
  } catch (error: any) {
    console.error("PATCH /api/admin/orders/[id] failed:", error);
    return jsonError("Не удалось обновить статус заказа.", 500);
  }
}
