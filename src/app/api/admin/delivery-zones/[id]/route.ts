import { NextRequest, NextResponse } from "next/server";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  SELLER_BLOCKED_MESSAGE,
  canBusinessOperate,
} from "@/lib/subscriptions/business-subscription-service";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession(request);
  if (!session) return jsonError("Нужен вход в панель продавца.", 401);
  if (session.role === "MANAGER") return jsonError("У менеджера нет доступа к зонам доставки.", 403);

  const { id } = await context.params;
  const existing = await prisma.deliveryZone.findUnique({ where: { id }, select: { businessId: true } });
  if (!existing) return jsonError("Зона доставки не найдена.", 404);
  if (!canUseBusiness(session, existing.businessId)) return jsonError("Нет доступа к зоне доставки.", 403);
  if (session.role !== "SUPER_ADMIN") {
    const access = await canBusinessOperate(existing.businessId);
    if (!access.canUseDelivery) {
      return jsonError(access.reason || SELLER_BLOCKED_MESSAGE, 403);
    }
  }

  const body = await request.json();
  const zone = await prisma.deliveryZone.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.cityArea !== undefined ? { cityArea: String(body.cityArea).trim() } : {}),
      ...(body.fee !== undefined ? { fee: Math.max(0, Number(body.fee) || 0) } : {}),
      ...(body.estimatedMinutes !== undefined ? { estimatedMinutes: body.estimatedMinutes ? Math.max(1, Math.round(Number(body.estimatedMinutes))) : null } : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
    },
  });
  return NextResponse.json({ ok: true, zone });
}
