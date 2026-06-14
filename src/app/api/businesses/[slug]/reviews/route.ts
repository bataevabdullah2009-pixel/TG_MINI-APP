import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getTelegramSessionUser } from "@/lib/auth-telegram";
import { prisma } from "@/lib/prisma";
import { classifyDatabaseError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";
import { getPublishedReviewSummary } from "@/lib/reviews";

const MAX_COMMENT_LENGTH = 1000;
const CREATE_LIMIT_PER_HOUR = 5;

function errorResponse(error: string, status = 400, code?: string) {
  return NextResponse.json({ ok: false, error, code }, { status });
}

function cleanComment(value: unknown) {
  if (typeof value !== "string") return null;
  const comment = value.trim();
  return comment ? comment.slice(0, MAX_COMMENT_LENGTH) : null;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const business = await prisma.business.findFirst({
      where: {
        slug,
        isActive: true,
        accessStatus: "ACTIVE",
        archivedAt: null,
      },
      select: { id: true, slug: true, name: true },
    });
    if (!business) return errorResponse("Бизнес не найден.", 404, "BUSINESS_NOT_FOUND");

    const { searchParams } = new URL(request.url);
    const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit")) || 10));
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

    const [reviews, summary] = await Promise.all([
      prisma.review.findMany({
        where: { businessId: business.id, status: "PUBLISHED" },
        select: {
          id: true,
          rating: true,
          comment: true,
          authorName: true,
          createdAt: true,
          orderId: true,
          bookingId: true,
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      getPublishedReviewSummary(business.id),
    ]);

    return NextResponse.json({
      ok: true,
      business,
      reviews,
      rating: summary,
      pagination: {
        offset,
        limit,
        hasMore: offset + reviews.length < summary.count,
        nextOffset: offset + reviews.length < summary.count ? offset + limit : null,
      },
    });
  } catch (error) {
    const classification = classifyDatabaseError(error);
    warnPrismaSchemaDrift("GET business reviews failed", error);
    return errorResponse(
      "Отзывы временно недоступны. Проверьте, что SQL-патч отзывов применён.",
      503,
      classification.code
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const initData = request.headers.get("x-telegram-init-data") || "";
    if (!initData) return errorResponse("Нужна авторизация через Telegram.", 401);

    const { slug } = await context.params;
    const business = await prisma.business.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true },
    });
    if (!business) return errorResponse("Бизнес не найден.", 404, "BUSINESS_NOT_FOUND");

    const session = await getTelegramSessionUser(initData, business.id);
    if (!session) return errorResponse("Нужна авторизация через Telegram.", 401);

    const body = await request.json().catch(() => ({}));
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return errorResponse("Оценка должна быть целым числом от 1 до 5.", 400, "INVALID_RATING");
    }

    const orderId = typeof body.orderId === "string" && body.orderId.trim() ? body.orderId.trim() : null;
    const bookingId = typeof body.bookingId === "string" && body.bookingId.trim() ? body.bookingId.trim() : null;
    if ((orderId ? 1 : 0) + (bookingId ? 1 : 0) !== 1) {
      return errorResponse("Выберите один завершённый заказ или одну запись.", 400, "INVALID_REVIEW_SOURCE");
    }

    const user = session.adminUser || await prisma.user.findUnique({
      where: { telegramId: BigInt(session.telegramUserId) },
      select: { id: true, name: true, username: true },
    });
    if (!user) return errorResponse("Не удалось определить пользователя.", 401);

    const recentReviews = await prisma.review.count({
      where: {
        userId: user.id,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });
    if (recentReviews >= CREATE_LIMIT_PER_HOUR) {
      return errorResponse("Слишком много отзывов за короткое время. Попробуйте позже.", 429, "REVIEW_RATE_LIMIT");
    }

    if (orderId) {
      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          businessId: business.id,
          status: { in: ["COMPLETED", "DELIVERED"] },
          customer: { telegramUserId: BigInt(session.telegramUserId) },
        },
        select: { id: true, review: { select: { id: true } } },
      });
      if (!order) {
        return errorResponse("Отзыв доступен только после завершённого собственного заказа.", 403, "REVIEW_NOT_ALLOWED");
      }
      if (order.review) {
        return errorResponse("Для этого заказа отзыв уже оставлен.", 409, "REVIEW_ALREADY_EXISTS");
      }
    }

    if (bookingId) {
      const booking = await prisma.booking.findFirst({
        where: {
          id: bookingId,
          businessId: business.id,
          status: "COMPLETED",
          customer: { telegramUserId: BigInt(session.telegramUserId) },
        },
        select: { id: true, review: { select: { id: true } } },
      });
      if (!booking) {
        return errorResponse("Отзыв доступен только после завершённой собственной записи.", 403, "REVIEW_NOT_ALLOWED");
      }
      if (booking.review) {
        return errorResponse("Для этой записи отзыв уже оставлен.", 409, "REVIEW_ALREADY_EXISTS");
      }
    }

    const authorName = String(session.name || user.name || session.username || user.username || "Клиент")
      .trim()
      .split(/\s+/)[0]
      .slice(0, 80) || "Клиент";
    const review = await prisma.review.create({
      data: {
        businessId: business.id,
        userId: user.id,
        orderId,
        bookingId,
        rating,
        comment: cleanComment(body.comment),
        authorName,
      },
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
    });

    return NextResponse.json({ ok: true, review }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return errorResponse("Для этой операции отзыв уже оставлен.", 409, "REVIEW_ALREADY_EXISTS");
    }
    const classification = classifyDatabaseError(error);
    warnPrismaSchemaDrift("POST business review failed", error);
    return errorResponse(
      "Не удалось сохранить отзыв. Проверьте, что SQL-патч отзывов применён.",
      503,
      classification.code
    );
  }
}
