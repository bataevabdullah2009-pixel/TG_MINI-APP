import { NextRequest, NextResponse } from "next/server";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getPublishedReviewSummary } from "@/lib/reviews";

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужна авторизация продавца.", 401);

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId") || session.businessId || "";
    if (!businessId || !canUseBusiness(session, businessId)) {
      return jsonError("Нет доступа к отзывам этого бизнеса.", 403);
    }

    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
    const [reviews, rating] = await Promise.all([
      prisma.review.findMany({
        where: { businessId },
        select: {
          id: true,
          rating: true,
          comment: true,
          authorName: true,
          status: true,
          createdAt: true,
          orderId: true,
          bookingId: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      getPublishedReviewSummary(businessId),
    ]);

    return NextResponse.json({ ok: true, reviews, rating });
  } catch (error) {
    console.error("[ADMIN REVIEWS] Failed to load reviews:", error);
    return jsonError("Отзывы временно недоступны. Проверьте SQL-патч отзывов.", 503);
  }
}
