import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { NotificationService } from "@/lib/notifications/notification-service";
import { isPrismaMissingColumnError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";
import { restoreTrackedStockForOrder } from "@/lib/orders/order-stock";

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
    let order;
    try {
      order = await prisma.order.findUnique({
        where: { id },
        include: { items: { select: { itemId: true, quantity: true } } },
      });
    } catch (error) {
      if (!isPrismaMissingColumnError(error, "Order", "stockRestoredAt")) throw error;
      warnPrismaSchemaDrift("Order status update retried without stockRestoredAt", error);
      const legacyOrder = await prisma.order.findUnique({
        where: { id },
        select: {
          id: true,
          businessId: true,
          deliveryType: true,
          status: true,
          customerId: true,
          items: { select: { itemId: true, quantity: true } },
        },
      });
      order = legacyOrder ? { ...legacyOrder, stockRestoredAt: null } : null;
    }

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

    let updatedOrder;
    const shouldRestoreStock =
      status === "CANCELLED" &&
      order.status !== "CANCELLED" &&
      !order.stockRestoredAt;

    if (shouldRestoreStock) {
      try {
        updatedOrder = await prisma.$transaction(async (tx) => {
          const claimed = await tx.order.updateMany({
            where: { id, stockRestoredAt: null, status: { not: "CANCELLED" } },
            data: {
              status: "CANCELLED",
              deliveryStatus: "CANCELLED",
              ...(internalNotes !== undefined ? { internalNotes } : {}),
            },
          });

          if (claimed.count === 1) {
            await restoreTrackedStockForOrder(tx, id);
          }

          return tx.order.findUniqueOrThrow({
            where: { id },
            include: { items: true },
          });
        });
      } catch (error) {
        if (!isPrismaMissingColumnError(error)) throw error;
        warnPrismaSchemaDrift("Order cancelled without automatic stock restore because stock lifecycle columns are missing", error);
        const claimed = await prisma.order.updateMany({
          where: { id, status: { not: "CANCELLED" } },
          data: {
            status,
            ...(deliveryStatus ? { deliveryStatus } : {}),
            ...(internalNotes !== undefined ? { internalNotes } : {}),
          },
        });
        if (claimed.count !== 1) {
          return jsonError("Заказ уже отменён.", 409);
        }
        updatedOrder = await prisma.order.findUniqueOrThrow({
          where: { id },
          include: { items: true },
        });
      }
    } else {
      updatedOrder = await prisma.order.update({
        where: { id },
        data: {
          status,
          ...(deliveryStatus ? { deliveryStatus } : {}),
          ...(internalNotes !== undefined ? { internalNotes } : {}),
        },
        include: { items: true },
      });
    }

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
