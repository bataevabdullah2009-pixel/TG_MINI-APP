import { NextRequest, NextResponse } from "next/server";
import { getCourierAccess } from "@/lib/courier-auth";
import { claimDelivery } from "@/lib/delivery/delivery-service";
import { NotificationService } from "@/lib/notifications/notification-service";
import { prisma } from "@/lib/prisma";
import { toJsonSafe } from "@/lib/prisma-schema-guard";

const courierOrderSelect = {
  id: true,
  status: true,
  deliveryStatus: true,
  paymentMethod: true,
  paymentStatus: true,
  customerName: true,
  customerPhone: true,
  customerAddress: true,
  deliveryCityArea: true,
  deliveryZoneName: true,
  itemsSubtotal: true,
  deliveryFee: true,
  totalPrice: true,
  comment: true,
  createdAt: true,
  updatedAt: true,
  business: { select: { id: true, slug: true, name: true, address: true, phone: true } },
  items: { select: { id: true, name: true, quantity: true, price: true } },
  deliveryAssignment: {
    select: {
      status: true,
      deliveredAt: true,
      courier: { select: { id: true, name: true, phone: true, cityArea: true } },
    },
  },
} as const;

async function loadCourierOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: courierOrderSelect,
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

    await prisma.$transaction([
      prisma.deliveryAssignment.update({
        where: { orderId },
        data: { status: "ACCEPTED_BY_COURIER" },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: { deliveryStatus: "ACCEPTED_BY_COURIER" },
      }),
    ]);
    await NotificationService.notifyCourierAssigned(orderId, access.courier.id).catch((error) =>
      console.warn(`[COURIER] Assignment notification failed for ${orderId}:`, error)
    );
    const updated = await loadCourierOrder(orderId);
    return NextResponse.json(toJsonSafe({ ok: true, order: updated }));
  }

  if (action === "ACCEPT") {
    const changed = await prisma.$transaction(async (tx) => {
      const assignment = await tx.deliveryAssignment.updateMany({
        where: { orderId, courierId: access.courier!.id, status: "ASSIGNED" },
        data: { status: "ACCEPTED_BY_COURIER" },
      });
      if (assignment.count !== 1) return false;
      await tx.order.update({
        where: { id: orderId },
        data: { deliveryStatus: "ACCEPTED_BY_COURIER" },
      });
      return true;
    });
    if (!changed) return NextResponse.json({ ok: false, error: "Доставка уже принята или недоступна." }, { status: 409 });
    return NextResponse.json(toJsonSafe({ ok: true, order: await loadCourierOrder(orderId) }));
  }

  if (action === "PICKED_UP") {
    const changed = await prisma.$transaction(async (tx) => {
      const assignment = await tx.deliveryAssignment.updateMany({
        where: { orderId, courierId: access.courier!.id, status: "ACCEPTED_BY_COURIER" },
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

  if (action === "DELIVERING") {
    const changed = await prisma.$transaction(async (tx) => {
      const assignment = await tx.deliveryAssignment.findFirst({
        where: { orderId, courierId: access.courier!.id, status: "PICKED_UP" },
        select: { id: true },
      });
      if (!assignment) return false;

      const order = await tx.order.updateMany({
        where: { id: orderId, status: "PICKED_UP" },
        data: { status: "DELIVERING" },
      });
      return order.count === 1;
    });
    if (!changed) {
      return NextResponse.json(
        { ok: false, error: "Сначала отметьте, что забрали заказ." },
        { status: 409 }
      );
    }
    return NextResponse.json(toJsonSafe({ ok: true, order: await loadCourierOrder(orderId) }));
  }

  if (action === "DELIVERED") {
    const changed = await prisma.$transaction(async (tx) => {
      const assignment = await tx.deliveryAssignment.findFirst({
        where: { orderId, courierId: access.courier!.id, status: "PICKED_UP" },
        select: { id: true },
      });
      if (!assignment) return false;

      const order = await tx.order.updateMany({
        where: { id: orderId, status: "DELIVERING" },
        data: { status: "DELIVERED", deliveryStatus: "DELIVERED", courierPickupDeadline: null },
      });
      if (order.count !== 1) return false;

      await tx.deliveryAssignment.update({
        where: { id: assignment.id },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      });
      return true;
    });
    if (!changed) return NextResponse.json({ ok: false, error: "Сначала отметьте доставку как «В пути»." }, { status: 409 });

    await NotificationService.notifyCourierDelivered(orderId, access.courier.id).catch((error) =>
      console.warn(`[COURIER] Delivery notification failed for ${orderId}:`, error)
    );
    return NextResponse.json(toJsonSafe({ ok: true, order: await loadCourierOrder(orderId) }));
  }

  return NextResponse.json({ ok: false, error: "Неизвестное действие курьера." }, { status: 400 });
}
