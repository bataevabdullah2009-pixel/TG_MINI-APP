import { NextRequest, NextResponse } from "next/server";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { toJsonSafe } from "@/lib/prisma-schema-guard";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession(request);
  if (!session) return jsonError("Нужен вход в панель продавца.", 401);
  if (session.role === "MANAGER") return jsonError("У менеджера нет доступа к курьерам.", 403);

  const { id } = await context.params;
  const existing = await prisma.courier.findUnique({ where: { id }, select: { businessId: true, userId: true } });
  if (!existing) return jsonError("Курьер не найден.", 404);
  if (!canUseBusiness(session, existing.businessId)) return jsonError("Нет доступа к курьеру.", 403);

  const body = await request.json();
  const courier = await prisma.$transaction(async (tx) => {
    const updated = await tx.courier.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
        ...(body.phone !== undefined ? { phone: String(body.phone).trim() } : {}),
        ...(body.cityArea !== undefined ? { cityArea: body.cityArea || null } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
      },
    });

    if (existing.userId) {
      await tx.user.update({
        where: { id: existing.userId },
        data: {
          ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
          ...(body.phone !== undefined ? { phone: String(body.phone).trim() } : {}),
          ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        },
      });
    }
    return updated;
  });

  return NextResponse.json(toJsonSafe({ ok: true, courier }));
}
