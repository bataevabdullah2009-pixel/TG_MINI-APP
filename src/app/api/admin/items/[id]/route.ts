import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import {
  SELLER_BLOCKED_MESSAGE,
  canBusinessOperate,
} from "@/lib/subscriptions/business-subscription-service";

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
    if (loaded.session.role !== "SUPER_ADMIN") {
      const access = await canBusinessOperate(loaded.item.businessId);
      if (!access.canManageProducts) {
        return jsonError(access.reason || SELLER_BLOCKED_MESSAGE, 403);
      }
    }

    const body = await request.json();
    let categoryId = undefined;
    if (body.categoryId !== undefined) {
      const rawCategoryId = body.categoryId;
      categoryId = (rawCategoryId === "" || rawCategoryId === "none" || rawCategoryId === "null" || !rawCategoryId) ? null : rawCategoryId;
    }
    const nextName = body.name !== undefined || body.title !== undefined ? String(body.name || body.title || "").trim() : undefined;
    if (nextName !== undefined && !nextName) {
      return jsonError("Укажите название.", 400);
    }

    const nextPrice = body.price !== undefined ? Number(body.price) : undefined;
    if (nextPrice !== undefined && (!Number.isFinite(nextPrice) || nextPrice < 0)) {
      return jsonError("Укажите корректную цену.", 400);
    }

    const nextAvailability =
      body.isAvailable !== undefined
        ? Boolean(body.isAvailable)
        : body.status !== undefined
          ? body.status !== "HIDDEN" && body.status !== "INACTIVE"
          : undefined;

    const item = await prisma.item.update({
      where: { id },
      data: {
        ...(body.type !== undefined ? { type: body.type === "SERVICE" ? "SERVICE" : "PRODUCT" } : {}),
        ...(nextName !== undefined ? { name: nextName } : {}),
        ...(body.description !== undefined ? { description: body.description || "" } : {}),
        ...(nextPrice !== undefined ? { price: nextPrice } : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl || null } : {}),
        ...(body.durationMinutes !== undefined ? { durationMinutes: body.durationMinutes ? Number(body.durationMinutes) : null } : {}),
        ...(body.stock !== undefined ? { stock: body.stock !== "" && body.stock !== null ? Number(body.stock) : null } : {}),
        ...(nextAvailability !== undefined ? { isAvailable: nextAvailability } : {}),
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
    if (loaded.session.role !== "SUPER_ADMIN") {
      const access = await canBusinessOperate(loaded.item.businessId);
      if (!access.canManageProducts) {
        return jsonError(access.reason || SELLER_BLOCKED_MESSAGE, 403);
      }
    }
    await prisma.item.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/items/[id] failed:", error);
    return jsonError("Не удалось удалить товар или услугу.", 500);
  }
}
