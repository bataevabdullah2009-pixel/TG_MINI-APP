import { NextRequest, NextResponse } from "next/server";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ slug: string; zoneId: string }> }
) {
  const session = await getAdminSession(request);
  if (!session) return jsonError("Нужен вход в панель продавца.", 401);
  if (session.role === "MANAGER") return jsonError("У менеджера нет доступа к удалению зон доставки.", 403);

  const { slug: businessId, zoneId } = await context.params;
  if (!canUseBusiness(session, businessId)) {
    return jsonError("Нет доступа к зонам доставки этого бизнеса.", 403);
  }

  const zone = await prisma.deliveryZone.findUnique({
    where: { id: zoneId },
    select: { id: true, businessId: true },
  });
  if (!zone || zone.businessId !== businessId) {
    return jsonError("Зона доставки не найдена.", 404);
  }

  const archived = await prisma.deliveryZone.update({
    where: { id: zoneId },
    data: { isActive: false, archivedAt: new Date() },
  });
  return NextResponse.json({ ok: true, archived: true, deleted: false, zone: archived });
}
