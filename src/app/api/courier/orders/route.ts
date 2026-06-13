import { NextRequest, NextResponse } from "next/server";
import { getCourierAccess } from "@/lib/courier-auth";
import { releaseExpiredCourierAssignments } from "@/lib/delivery/delivery-service";
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

export async function GET(request: NextRequest) {
  const access = await getCourierAccess(request);
  if (!access.authenticated) {
    return NextResponse.json({ ok: false, error: "Нужна авторизация через Telegram." }, { status: 401 });
  }
  if (!access.courier) {
    return NextResponse.json({ ok: false, code: "COURIER_ACCESS_DENIED", error: "У вас нет доступа к кабинету курьера." }, { status: 403 });
  }

  await releaseExpiredCourierAssignments().catch((error) =>
    console.warn("[COURIER] Could not release expired assignments before listing:", error)
  );

  const [availableRaw, assigned, completed] = await Promise.all([
    prisma.order.findMany({
      where: {
        businessId: access.courier.businessId,
        status: "READY_FOR_DELIVERY",
        deliveryStatus: { in: ["NEW", "WAITING_COURIER"] },
        deliveryType: "DELIVERY",
      },
      select: courierOrderSelect,
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
    prisma.order.findMany({
      where: {
        deliveryAssignment: {
          is: {
            courierId: access.courier.id,
            status: { in: ["ASSIGNED", "ACCEPTED_BY_COURIER", "PICKED_UP"] },
          },
        },
      },
      select: courierOrderSelect,
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.order.findMany({
      where: {
        deliveryAssignment: {
          is: {
            courierId: access.courier.id,
            status: { in: ["DELIVERED", "CANCELLED"] },
          },
        },
      },
      select: courierOrderSelect,
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  const courierArea = access.courier.cityArea?.trim().toLowerCase();
  const available = courierArea
    ? availableRaw.filter((order) => (order.deliveryCityArea || "").toLowerCase().includes(courierArea))
    : availableRaw;

  return NextResponse.json(toJsonSafe({ ok: true, courier: access.courier, available, assigned, completed }));
}
