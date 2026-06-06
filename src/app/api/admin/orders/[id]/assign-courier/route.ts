import { NextRequest, NextResponse } from "next/server";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { claimDelivery } from "@/lib/delivery/delivery-service";
import { NotificationService } from "@/lib/notifications/notification-service";
import { prisma } from "@/lib/prisma";
import { toJsonSafe } from "@/lib/prisma-schema-guard";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession(request);
  if (!session) return jsonError("Нужен вход в панель продавца.", 401);
  if (session.role === "MANAGER") return jsonError("У менеджера нет доступа к назначению курьеров.", 403);

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const courierId = String(body.courierId || "");
  if (!courierId) return jsonError("Выберите курьера.", 400);

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      businessId: true,
      deliveryType: true,
      status: true,
      business: { select: { settings: { select: { courierAcceptanceMinutes: true } } } },
    },
  });
  if (!order) return jsonError("Заказ не найден.", 404);
  if (!canUseBusiness(session, order.businessId)) return jsonError("Нет доступа к этому заказу.", 403);
  if (order.deliveryType !== "DELIVERY" || order.status !== "READY_FOR_DELIVERY") {
    return jsonError("Назначить курьера можно только на готовый заказ с доставкой.", 409);
  }

  const courier = await prisma.courier.findFirst({
    where: { id: courierId, businessId: order.businessId, isActive: true },
    select: { id: true },
  });
  if (!courier) return jsonError("Активный курьер не найден.", 404);

  const minutes = order.business.settings?.courierAcceptanceMinutes || 30;
  const assignment = await claimDelivery(order.id, courier.id, new Date(Date.now() + minutes * 60_000));
  if (!assignment) return jsonError("Заказ уже назначен другому курьеру.", 409);

  let notificationSent = true;
  await NotificationService.notifyCourierAssigned(order.id, courier.id).catch((error) => {
    notificationSent = false;
    console.warn(`[DELIVERY] Could not notify assigned courier for order ${order.id}:`, error);
  });

  const updatedOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: {
      items: true,
      business: { select: { name: true, slug: true } },
      customer: true,
      deliveryZone: true,
      deliveryAssignment: { include: { courier: true } },
    },
  });

  return NextResponse.json(toJsonSafe({ ok: true, assignment, order: updatedOrder, notificationSent }), { status: 201 });
}
