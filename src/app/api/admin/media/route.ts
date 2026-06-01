import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";

const adminMediaBusinessSelect = {
  id: true,
  slug: true,
  name: true,
  logoUrl: true,
  coverImageUrl: true,
  primaryColor: true,
} as const;

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);

    const { searchParams } = new URL(request.url);
    const businessValue = searchParams.get("businessId") || searchParams.get("businessSlug") || session.businessId;
    const business = businessValue
      ? await prisma.business.findFirst({ where: { OR: [{ id: businessValue }, { slug: businessValue }] }, select: adminMediaBusinessSelect })
      : await prisma.business.findFirst({ where: { isActive: true }, select: adminMediaBusinessSelect });

    if (!business) return jsonError("Бизнес не найден.", 404);
    if (!canUseBusiness(session, business.id)) return jsonError("Нет доступа к этому бизнесу.", 403);

    const assets = await prisma.mediaAsset.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, data: assets, business });
  } catch (error) {
    console.error("GET /api/admin/media failed:", error);
    return jsonError("Не удалось загрузить медиа.", 500);
  }
}
