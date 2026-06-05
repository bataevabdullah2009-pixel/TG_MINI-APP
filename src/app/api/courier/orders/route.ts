import { NextRequest, NextResponse } from "next/server";
import { getCourierAccess } from "@/lib/courier-auth";
import { releaseExpiredCourierAssignments } from "@/lib/delivery/delivery-service";
import { prisma } from "@/lib/prisma";
import { toJsonSafe } from "@/lib/prisma-schema-guard";

const courierOrderInclude = {
  business: { select: { id: true, slug: true, name: true, address: true, phone: true } },
  items: true,
  deliveryZone: true,
  deliveryAssignment: { include: { courier: true } },
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
      include: courierOrderInclude,
      orderBy: { createdAt: "asc" },
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
      include: courierOrderInclude,
      orderBy: { updatedAt: "desc" },
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
      include: courierOrderInclude,
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);

  const courierArea = access.courier.cityArea?.trim().toLowerCase();
  const available = courierArea
    ? availableRaw.filter((order) => (order.deliveryCityArea || "").toLowerCase().includes(courierArea))
    : availableRaw;

  return NextResponse.json(toJsonSafe({ ok: true, courier: access.courier, available, assigned, completed }));
}
