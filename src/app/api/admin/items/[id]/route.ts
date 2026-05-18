import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";

async function loadItem(request: NextRequest, id: string) {
  const session = await getAdminSession(request);
  if (!session) return { error: jsonError("Нужен вход в админку.", 401) as Response };
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return { error: jsonError("Товар или услуга не найдены.", 404) as Response };
  if (!canUseBusiness(session, item.businessId)) return { error: jsonError("Нет доступа к этому бизнесу.", 403) as Response };
  return { session, item };
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const loaded = await loadItem(request, id);
    if ("error" in loaded) return loaded.error;

    const body = await request.json();
    const item = await prisma.item.update({
      where: { id },
      data: {
        ...(body.type !== undefined ? { type: body.type === "SERVICE" ? "SERVICE" : "PRODUCT" } : {}),
        ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
        ...(body.description !== undefined ? { description: body.description || "" } : {}),
        ...(body.price !== undefined ? { price: Number(body.price || 0) } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId || null } : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl || null } : {}),
        ...(body.durationMinutes !== undefined ? { durationMinutes: body.durationMinutes ? Number(body.durationMinutes) : null } : {}),
        ...(body.stock !== undefined ? { stock: body.stock !== "" && body.stock !== null ? Number(body.stock) : null } : {}),
        ...(body.isAvailable !== undefined ? { isAvailable: Boolean(body.isAvailable) } : {}),
        ...(body.isPopular !== undefined ? { isPopular: Boolean(body.isPopular) } : {}),
      },
      include: { category: true, business: { select: { id: true, name: true, slug: true } } },
    });

    return NextResponse.json({ ok: true, data: item });
  } catch (error) {
    console.error("PATCH /api/admin/items/[id] failed:", error);
    return jsonError("Не удалось обновить товар или услугу.", 500);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const loaded = await loadItem(request, id);
    if ("error" in loaded) return loaded.error;
    await prisma.item.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/items/[id] failed:", error);
    return jsonError("Не удалось удалить товар или услугу.", 500);
  }
}
