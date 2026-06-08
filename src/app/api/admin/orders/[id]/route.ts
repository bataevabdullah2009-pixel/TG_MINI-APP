import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { NotificationService } from "@/lib/notifications/notification-service";
import {
  SELLER_BLOCKED_MESSAGE,
  canBusinessOperate,
} from "@/lib/subscriptions/business-subscription-service";

// Strict Prisma OrderStatus values
const ALLOWED_STATUSES = new Set([
  "NEW",
  "ACCEPTED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "READY_FOR_DELIVERY",
  "COURIER_ASSIGNED",
  "PICKED_UP",
  "DELIVERED",
  "READY",
  "DELIVERING",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED"
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
    if (session.role !== "SUPER_ADMIN") {
      const access = await canBusinessOperate(order.businessId);
      if (!access.canManageOrders) {
        return jsonError(access.reason || SELLER_BLOCKED_MESSAGE, 403);
      }
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

    if (status === "READY") {
      status = order.deliveryType === "DELIVERY" ? "READY_FOR_DELIVERY" : "READY_FOR_PICKUP";
    } else if (status === "DELIVERING" && order.deliveryType === "DELIVERY") {
      status = "PICKED_UP";
    }

    // Validate the target status
    if (!ALLOWED_STATUSES.has(status)) {
      return jsonError(`Недопустимый статус заказа: ${status}.`, 400);
    }

    // 4. Update order details
    const deliveryStatus =
      status === "READY_FOR_DELIVERY" ? "WAITING_COURIER" :
      status === "COURIER_ASSIGNED" ? "ASSIGNED" :
      status === "PICKED_UP" ? "PICKED_UP" :
      status === "DELIVERED" || (status === "COMPLETED" && order.deliveryType === "DELIVERY") ? "DELIVERED" :
      status === "CANCELLED" ? "CANCELLED" :
      status === "EXPIRED" ? "EXPIRED" :
      status === "READY_FOR_PICKUP" ? "NONE" :
      undefined;

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status,
        ...(deliveryStatus ? { deliveryStatus } : {}),
        ...(internalNotes !== undefined ? { internalNotes } : {}),
      },
      include: { items: true },
    });

    // 5. Notify the customer of status updates safely in the background
    try {
      await NotificationService.notifyCustomerOrderStatus(updatedOrder.customerId || "", updatedOrder.id);
      if (status === "READY_FOR_DELIVERY") {
        await NotificationService.notifyCouriersNewDelivery(updatedOrder.id);
      }
      if (status === "CANCELLED") {
        await prisma.deliveryAssignment.updateMany({
          where: { orderId: updatedOrder.id, status: { in: ["ASSIGNED", "ACCEPTED_BY_COURIER", "PICKED_UP"] } },
          data: { status: "CANCELLED", releasedAt: new Date() },
        });
        await NotificationService.notifyCourierOrderCancelled(updatedOrder.id);
      }
    } catch (notificationError) {
      console.warn("Could not dispatch customer push notification:", notificationError);
    }

    return NextResponse.json({ ok: true, data: updatedOrder });
  } catch (error: any) {
    console.error("PATCH /api/admin/orders/[id] failed:", error);
    return jsonError("Не удалось обновить статус заказа.", 500);
  }
}
