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

function parseOptionalStock(value: unknown) {
  if (value === "" || value === null) return null;
  const stock = Number(value);
  if (!Number.isInteger(stock) || stock < 0) return undefined;
  return stock;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const loaded = await loadItem(request, id);
    if ("error" in loaded) return loaded.error;

    const body = await request.json();
    let categoryId = undefined;
    if (body.categoryId !== undefined) {
      const rawCategoryId = body.categoryId;
      categoryId = (rawCategoryId === "" || rawCategoryId === "none" || rawCategoryId === "null" || !rawCategoryId) ? null : rawCategoryId;
      if (categoryId) {
        const category = await prisma.category.findFirst({
          where: { id: categoryId, businessId: loaded.item.businessId },
          select: { id: true },
        });
        if (!category) {
          return jsonError("Категория не найдена в текущем бизнесе.", 400);
        }
      }
    }
    const nextName = body.name !== undefined || body.title !== undefined ? String(body.name || body.title || "").trim() : undefined;
    if (nextName !== undefined && !nextName) {
      return jsonError("Укажите название.", 400);
    }

    const nextPrice = body.price !== undefined ? Number(body.price) : undefined;
    if (nextPrice !== undefined && (!Number.isFinite(nextPrice) || nextPrice < 0)) {
      return jsonError("Укажите корректную цену.", 400);
    }

    const nextStock = body.stock !== undefined ? parseOptionalStock(body.stock) : undefined;
    if (body.stock !== undefined && nextStock === undefined) {
      return jsonError("Количество должно быть целым числом не меньше нуля.", 400);
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
        ...(body.stock !== undefined ? { stock: nextStock } : {}),
        ...(nextAvailability !== undefined ? { isAvailable: nextAvailability } : {}),
        ...(body.isPopular !== undefined ? { isPopular: Boolean(body.isPopular) } : {}),
        ...(body.archived === false ? { archivedAt: null } : {}),
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
    const item = await prisma.item.update({
      where: { id },
      data: { archivedAt: new Date(), isAvailable: false },
      include: { category: true, business: { select: { id: true, name: true, slug: true } } },
    });
    return NextResponse.json({ ok: true, archived: true, data: item });
  } catch (error) {
    console.error("DELETE /api/admin/items/[id] failed:", error);
    return jsonError("Не удалось архивировать товар или услугу.", 500);
  }
}
