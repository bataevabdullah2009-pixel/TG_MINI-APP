import { NextRequest, NextResponse } from "next/server";
import { getCourierAccess } from "@/lib/courier-auth";
import { claimDelivery } from "@/lib/delivery/delivery-service";
import { NotificationService } from "@/lib/notifications/notification-service";
import { prisma } from "@/lib/prisma";
import { toJsonSafe } from "@/lib/prisma-schema-guard";

async function loadCourierOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      business: { select: { id: true, slug: true, name: true, address: true, phone: true } },
      items: true,
      deliveryZone: true,
      deliveryAssignment: { include: { courier: true } },
    },
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  const access = await getCourierAccess(request);
  if (!access.authenticated) {
    return NextResponse.json({ ok: false, error: "Нужна авторизация через Telegram." }, { status: 401 });
  }
  if (!access.courier) {
    return NextResponse.json({ ok: false, code: "COURIER_ACCESS_DENIED", error: "У вас нет доступа к кабинету курьера." }, { status: 403 });
  }

  const { orderId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "").toUpperCase();

  if (action === "TAKE") {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { businessId: true, deliveryCityArea: true, business: { select: { settings: { select: { courierAcceptanceMinutes: true } } } } },
    });
    if (!order || order.businessId !== access.courier.businessId) {
      return NextResponse.json({ ok: false, error: "Доставка не найдена." }, { status: 404 });
    }
    if (access.courier.cityArea && !(order.deliveryCityArea || "").toLowerCase().includes(access.courier.cityArea.toLowerCase())) {
      return NextResponse.json({ ok: false, error: "Эта доставка находится вне вашей рабочей зоны." }, { status: 403 });
    }

    const minutes = order.business.settings?.courierAcceptanceMinutes || 30;
    const assignment = await claimDelivery(orderId, access.courier.id, new Date(Date.now() + minutes * 60_000));
    if (!assignment) {
      return NextResponse.json({ ok: false, code: "DELIVERY_ALREADY_TAKEN", error: "Заказ уже взял другой курьер." }, { status: 409 });
    }

    await NotificationService.notifyCourierAssigned(orderId, access.courier.id).catch((error) =>
      console.warn(`[COURIER] Assignment notification failed for ${orderId}:`, error)
    );
    const updated = await loadCourierOrder(orderId);
    return NextResponse.json(toJsonSafe({ ok: true, order: updated }));
  }

  if (action === "PICKED_UP") {
    const changed = await prisma.$transaction(async (tx) => {
      const assignment = await tx.deliveryAssignment.updateMany({
        where: { orderId, courierId: access.courier!.id, status: "ASSIGNED" },
        data: { status: "PICKED_UP", pickedUpAt: new Date() },
      });
      if (assignment.count !== 1) return false;
      await tx.order.update({
        where: { id: orderId },
        data: { status: "PICKED_UP", deliveryStatus: "PICKED_UP", courierPickupDeadline: null },
      });
      return true;
    });
    if (!changed) return NextResponse.json({ ok: false, error: "Нельзя отметить заказ забранным." }, { status: 409 });

    await NotificationService.notifyCourierPickedUp(orderId, access.courier.id).catch((error) =>
      console.warn(`[COURIER] Pickup notification failed for ${orderId}:`, error)
    );
    return NextResponse.json(toJsonSafe({ ok: true, order: await loadCourierOrder(orderId) }));
  }

  if (action === "DELIVERED") {
    const changed = await prisma.$transaction(async (tx) => {
      const assignment = await tx.deliveryAssignment.updateMany({
        where: { orderId, courierId: access.courier!.id, status: "PICKED_UP" },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      });
      if (assignment.count !== 1) return false;
      await tx.order.update({
        where: { id: orderId },
        data: { status: "DELIVERED", deliveryStatus: "DELIVERED", courierPickupDeadline: null },
      });
      return true;
    });
    if (!changed) return NextResponse.json({ ok: false, error: "Сначала отметьте, что забрали заказ." }, { status: 409 });

    await NotificationService.notifyCourierDelivered(orderId, access.courier.id).catch((error) =>
      console.warn(`[COURIER] Delivery notification failed for ${orderId}:`, error)
    );
    return NextResponse.json(toJsonSafe({ ok: true, order: await loadCourierOrder(orderId) }));
  }

  return NextResponse.json({ ok: false, error: "Неизвестное действие курьера." }, { status: 400 });
}
