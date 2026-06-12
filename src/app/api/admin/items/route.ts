import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";

const adminItemBusinessSelect = {
  id: true,
  slug: true,
  name: true,
  type: true,
  templateKey: true,
} as const;

async function resolveBusiness(request: NextRequest, value?: string | null) {
  const session = await getAdminSession(request);
  if (!session) return { error: jsonError("Нужен вход в админку.", 401) as Response };

  const business =
    value
      ? await prisma.business.findFirst({ where: { OR: [{ id: value }, { slug: value }] }, select: adminItemBusinessSelect })
      : session.businessId
        ? await prisma.business.findUnique({ where: { id: session.businessId }, select: adminItemBusinessSelect })
        : await prisma.business.findFirst({ where: { isActive: true }, select: adminItemBusinessSelect });

  if (!business) return { error: jsonError("Бизнес не найден.", 404) as Response };
  if (!canUseBusiness(session, business.id)) return { error: jsonError("Нет доступа к этому бизнесу.", 403) as Response };
  return { session, business };
}

function parseOptionalStock(value: unknown) {
  if (value === undefined || value === "" || value === null) return null;
  const stock = Number(value);
  if (!Number.isInteger(stock) || stock < 0) return undefined;
  return stock;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resolved = await resolveBusiness(request, searchParams.get("businessId") || searchParams.get("businessSlug"));
    if ("error" in resolved) return resolved.error;
    const filter = searchParams.get("filter") || "ACTIVE";
    const query = searchParams.get("query")?.trim();
    const requestedLimit = Number(searchParams.get("limit") || 50);
    const take = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100) : 50;

    const items = await prisma.item.findMany({
      where: {
        businessId: resolved.business.id,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { description: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(filter === "ALL"
          ? {}
          : filter === "ARCHIVED"
          ? { archivedAt: { not: null } }
          : {
              archivedAt: null,
              ...(filter === "AVAILABLE" ? { isAvailable: true } : {}),
              ...(filter === "UNAVAILABLE" ? { isAvailable: false } : {}),
            }),
      },
      include: {
        category: { select: { id: true, name: true } },
        business: { select: { id: true, name: true, slug: true, type: true, templateKey: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take,
    });

    return NextResponse.json({ ok: true, data: items, business: resolved.business });
  } catch (error) {
    console.error("GET /api/admin/items failed:", error);
    return jsonError("Не удалось загрузить товары и услуги.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const resolved = await resolveBusiness(request, body.businessId || body.businessSlug);
    if ("error" in resolved) return resolved.error;

    const itemName = String(body.name || body.title || "").trim();
    if (!itemName || body.price === undefined || body.price === "") {
      return jsonError("Укажите название и цену.", 400);
    }

    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) {
      return jsonError("Укажите корректную цену.", 400);
    }
    const type = body.type === "SERVICE" ? "SERVICE" : "PRODUCT";
    const stock = parseOptionalStock(body.stock);
    if (body.stock !== undefined && stock === undefined) {
      return jsonError("Количество должно быть целым числом не меньше нуля.", 400);
    }
    const stockMode =
      type === "PRODUCT" &&
      (body.stockMode === "TRACK_STOCK" || (body.stockMode === undefined && stock !== null))
        ? "TRACK_STOCK"
        : "SIMPLE_AVAILABILITY";
    if (stockMode === "TRACK_STOCK" && stock === null) {
      return jsonError("Для учёта остатков укажите целое количество от 0.", 400);
    }

    const rawCategoryId = body.categoryId;
    let categoryId = (rawCategoryId === "" || rawCategoryId === "none" || rawCategoryId === "null" || !rawCategoryId) ? null : rawCategoryId;

    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, businessId: resolved.business.id },
        select: { id: true },
      });
      if (!category) {
        return jsonError("Категория не найдена в текущем бизнесе.", 400);
      }
    }

    if (!categoryId) {
      // Look up first active category
      let firstCategory = await prisma.category.findFirst({
        where: { businessId: resolved.business.id, isActive: true },
        orderBy: { sortOrder: "asc" }
      });
      // Create a default category if none exist
      if (!firstCategory) {
        firstCategory = await prisma.category.create({
          data: {
            businessId: resolved.business.id,
            name: "Основное",
            isActive: true,
            sortOrder: 0
          }
        });
      }
      categoryId = firstCategory.id;
    }

    const item = await prisma.item.create({
      data: {
        businessId: resolved.business.id,
        categoryId: categoryId,
        type,
        name: itemName,
        description: body.description ? String(body.description).trim() : "",
        price,
        imageUrl: body.imageUrl || undefined,
        durationMinutes: body.durationMinutes ? Number(body.durationMinutes) : undefined,
        stockMode,
        stock: stockMode === "TRACK_STOCK" ? stock : null,
        isAvailable: stockMode === "TRACK_STOCK" && stock === 0 ? false : body.isAvailable ?? true,
        isPopular: body.isPopular ?? false,
      },
      include: { category: true, business: { select: { id: true, name: true, slug: true } } },
    });

    return NextResponse.json({ ok: true, data: item }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/items failed:", error);
    return jsonError("Не удалось сохранить товар или услугу.", 500);
  }
}
