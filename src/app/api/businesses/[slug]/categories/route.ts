import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { canBusinessOperate } from "@/lib/subscriptions/business-subscription-service";

async function resolveBusiness(slugOrId: string) {
  return prisma.business.findFirst({
    where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
    select: { id: true, slug: true, name: true },
  });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const business = await resolveBusiness(slug);
    if (!business) return jsonError("Бизнес не найден.", 404);

    const categories = await prisma.category.findMany({
      where: { businessId: business.id },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { items: true } } },
    });

    return NextResponse.json({ ok: true, data: categories, categories });
  } catch (error) {
    console.error("GET /api/businesses/[slug]/categories failed:", error);
    return jsonError("Не удалось загрузить категории.", 500);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);

    const { slug } = await context.params;
    const business = await resolveBusiness(slug);
    if (!business) return jsonError("Бизнес не найден.", 404);
    if (!canUseBusiness(session, business.id)) return jsonError("Нет доступа к этому бизнесу.", 403);
    if (session.role !== "SUPER_ADMIN") {
      const access = await canBusinessOperate(business.id);
      if (!access.canManageProducts) {
        return jsonError(access.reason || "Категории временно недоступны.", 403);
      }
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) return jsonError("Укажите название категории.", 400);

    const category = await prisma.category.create({
      data: {
        businessId: business.id,
        name,
        isActive: body.isActive ?? true,
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
      },
      include: { _count: { select: { items: true } } },
    });

    return NextResponse.json({ ok: true, data: category, category }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/businesses/[slug]/categories failed:", error);
    if (error?.code === "P2002") {
      return jsonError("Такая категория уже есть.", 400);
    }
    return jsonError("Не удалось создать категорию.", 500);
  }
}
