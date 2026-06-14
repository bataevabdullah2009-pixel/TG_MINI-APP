import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, jsonError, requireRole } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session || !requireRole(session, ["SUPER_ADMIN"])) {
      return jsonError("Недостаточно прав.", 403);
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
    const reviews = await prisma.review.findMany({
      select: {
        id: true,
        rating: true,
        comment: true,
        authorName: true,
        status: true,
        hiddenAt: true,
        createdAt: true,
        orderId: true,
        bookingId: true,
        business: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ ok: true, reviews });
  } catch (error) {
    console.error("[SUPER ADMIN REVIEWS] Failed to load reviews:", error);
    return jsonError("Отзывы временно недоступны. Проверьте SQL-патч отзывов.", 503);
  }
}
