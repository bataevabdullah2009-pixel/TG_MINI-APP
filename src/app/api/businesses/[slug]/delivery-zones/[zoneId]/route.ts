import { NextRequest, NextResponse } from "next/server";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

async function resolveBusiness(value: string) {
  return prisma.business.findFirst({
    where: { OR: [{ id: value }, { slug: value }, { slug: { equals: value, mode: "insensitive" } }] },
    select: { id: true },
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ slug: string; zoneId: string }> }
) {
  const session = await getAdminSession(request);
  if (!session) return jsonError("Нужен вход в панель продавца.", 401);
  if (session.role === "MANAGER") return jsonError("У менеджера нет доступа к изменению зон доставки.", 403);

  const { slug, zoneId } = await context.params;
  const business = await resolveBusiness(slug);
  if (!business || !canUseBusiness(session, business.id)) {
    return jsonError("Нет доступа к зонам доставки этого бизнеса.", 403);
  }

  const zone = await prisma.deliveryZone.findFirst({
    where: { id: zoneId, businessId: business.id },
    select: { id: true },
  });
  if (!zone) return jsonError("Зона доставки не найдена.", 404);

  const body = await request.json();
  const name = body.name === undefined ? undefined : String(body.name).trim();
  const cityArea = body.cityArea === undefined ? undefined : String(body.cityArea).trim();
  if (name !== undefined && !name) return jsonError("Укажите название зоны.", 400);
  if (cityArea !== undefined && !cityArea) return jsonError("Укажите город или район.", 400);

  const updated = await prisma.deliveryZone.update({
    where: { id: zoneId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(cityArea !== undefined ? { cityArea } : {}),
      ...(body.fee !== undefined ? { fee: Math.max(0, Number(body.fee) || 0) } : {}),
      ...(body.estimatedMinutes !== undefined
        ? { estimatedMinutes: body.estimatedMinutes ? Math.max(1, Math.round(Number(body.estimatedMinutes))) : null }
        : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
    },
  });

  return NextResponse.json({ ok: true, zone: updated });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ slug: string; zoneId: string }> }
) {
  const session = await getAdminSession(request);
  if (!session) return jsonError("Нужен вход в панель продавца.", 401);
  if (session.role === "MANAGER") return jsonError("У менеджера нет доступа к удалению зон доставки.", 403);

  const { slug, zoneId } = await context.params;
  const business = await resolveBusiness(slug);
  if (!business || !canUseBusiness(session, business.id)) {
    return jsonError("Нет доступа к зонам доставки этого бизнеса.", 403);
  }
  const businessId = business.id;

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
