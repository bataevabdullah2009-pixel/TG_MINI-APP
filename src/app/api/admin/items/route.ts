import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";

async function resolveBusiness(request: NextRequest, value?: string | null) {
  const session = await getAdminSession(request);
  if (!session) return { error: jsonError("Нужен вход в админку.", 401) as Response };

  const business =
    value
      ? await prisma.business.findFirst({ where: { OR: [{ id: value }, { slug: value }] } })
      : session.businessId
        ? await prisma.business.findUnique({ where: { id: session.businessId } })
        : await prisma.business.findFirst({ where: { isActive: true } });

  if (!business) return { error: jsonError("Бизнес не найден.", 404) as Response };
  if (!canUseBusiness(session, business.id)) return { error: jsonError("Нет доступа к этому бизнесу.", 403) as Response };
  return { session, business };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resolved = await resolveBusiness(request, searchParams.get("businessId") || searchParams.get("businessSlug"));
    if ("error" in resolved) return resolved.error;

    const items = await prisma.item.findMany({
      where: { businessId: resolved.business.id },
      include: {
        category: { select: { id: true, name: true } },
        business: { select: { id: true, name: true, slug: true, type: true, templateKey: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
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

    if (!body.name || body.price === undefined || body.price === "") {
      return jsonError("Укажите название и цену.", 400);
    }

    const rawCategoryId = body.categoryId;
    let categoryId = (rawCategoryId === "" || rawCategoryId === "none" || rawCategoryId === "null" || !rawCategoryId) ? null : rawCategoryId;

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
        type: body.type === "SERVICE" ? "SERVICE" : "PRODUCT",
        name: String(body.name).trim(),
        description: body.description ? String(body.description).trim() : "",
        price: Number(body.price || 0),
        imageUrl: body.imageUrl || undefined,
        durationMinutes: body.durationMinutes ? Number(body.durationMinutes) : undefined,
        stock: body.stock !== undefined && body.stock !== "" ? Number(body.stock) : undefined,
        isAvailable: body.isAvailable ?? true,
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
