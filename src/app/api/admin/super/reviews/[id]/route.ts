import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, jsonError, requireRole } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession(request);
    if (!session || !requireRole(session, ["SUPER_ADMIN"])) {
      return jsonError("Недостаточно прав.", 403);
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "").toUpperCase();
    if (action !== "HIDE" && action !== "PUBLISH") {
      return jsonError("Неизвестное действие модерации.", 400);
    }

    const existing = await prisma.review.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return jsonError("Отзыв не найден.", 404);

    const review = await prisma.review.update({
      where: { id },
      data: action === "HIDE"
        ? {
            status: "HIDDEN",
            hiddenAt: new Date(),
            hiddenByUserId: session.id,
          }
        : {
            status: "PUBLISHED",
            hiddenAt: null,
            hiddenByUserId: null,
          },
      select: {
        id: true,
        status: true,
        hiddenAt: true,
      },
    });

    return NextResponse.json({ ok: true, review });
  } catch (error) {
    console.error("[SUPER ADMIN REVIEWS] Failed to moderate review:", error);
    return jsonError("Не удалось изменить статус отзыва.", 503);
  }
}
