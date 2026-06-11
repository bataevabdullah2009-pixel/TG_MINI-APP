import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, jsonError, requireRole } from "@/lib/admin-auth";

const ACCESS_ACTIONS = new Set(["ACTIVE", "BLOCKED", "ARCHIVED", "MARK_PAID"]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession(request);
  if (!session || !requireRole(session, ["SUPER_ADMIN"])) {
    return jsonError("Недостаточно прав.", 403);
  }

  const { id } = await context.params;
  const body = await request.json();
  const action = String(body.action || "").toUpperCase();
  if (!ACCESS_ACTIONS.has(action)) {
    return jsonError("Неизвестное действие с доступом бизнеса.", 400);
  }

  const existing = await prisma.business.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return jsonError("Бизнес не найден.", 404);

  if (action === "MARK_PAID") {
    const paidAmount = Number(body.paidAmount ?? 50000);
    if (!Number.isFinite(paidAmount) || paidAmount < 0) {
      return jsonError("Укажите корректную сумму оплаты.", 400);
    }
    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) {
      return jsonError("Укажите корректную дату оплаты.", 400);
    }

    const business = await prisma.business.update({
      where: { id },
      data: {
        planType: "LIFETIME",
        paidAmount,
        paidAt,
      },
      select: {
        id: true,
        accessStatus: true,
        planType: true,
        paidAmount: true,
        paidAt: true,
        blockedReason: true,
        isActive: true,
        subscriptionStatus: true,
      },
    });
    return NextResponse.json({ ok: true, data: business });
  }

  if (action === "ARCHIVED") {
    const activeOrders = await prisma.order.count({
      where: {
        businessId: id,
        status: {
          notIn: ["COMPLETED", "CANCELLED", "EXPIRED"],
        },
      },
    });
    if (activeOrders > 0) {
      return jsonError(
        `Нельзя архивировать бизнес: сначала завершите или отмените активные заказы (${activeOrders}).`,
        409
      );
    }
  }

  const reason = String(body.reason || "").trim() || null;
  const business = await prisma.business.update({
    where: { id },
    data:
      action === "ACTIVE"
        ? {
            accessStatus: "ACTIVE",
            isActive: true,
            subscriptionStatus: "ACTIVE",
            archivedAt: null,
            blockedReason: null,
          }
        : action === "BLOCKED"
          ? {
              accessStatus: "BLOCKED",
              isActive: false,
              subscriptionStatus: "BLOCKED",
              archivedAt: null,
              blockedReason: reason || "Доступ заблокирован Super Admin.",
            }
          : {
              accessStatus: "ARCHIVED",
              isActive: false,
              archivedAt: new Date(),
              blockedReason: reason,
            },
    select: {
      id: true,
      accessStatus: true,
      planType: true,
      paidAmount: true,
      paidAt: true,
      blockedReason: true,
      archivedAt: true,
      isActive: true,
      subscriptionStatus: true,
    },
  });

  return NextResponse.json({ ok: true, data: business });
}
