import { NextRequest, NextResponse } from "next/server";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { isPrismaMissingColumnError, toJsonSafe, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";
import { telegramBot } from "@/lib/telegram-bot-service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);
    if (session.role !== "SUPER_ADMIN" && session.role !== "BUSINESS_OWNER") {
      return jsonError("Нет доступа к отклонению оплат.", 403);
    }

    const { orderId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const reason = typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim().slice(0, 500)
      : "Оплата не подтверждена продавцом.";

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { business: true, customer: true, items: true },
    });

    if (!order) return jsonError("Заказ не найден.", 404);
    if (!canUseBusiness(session, order.businessId)) {
      return jsonError("Нет доступа к этому заказу.", 403);
    }
    if (order.paymentMethod !== "TRANSFER") {
      return jsonError("У заказа не выбран перевод.", 400);
    }
    if (order.paymentStatus !== "AWAITING_REVIEW") {
      return jsonError("Оплата уже была обработана продавцом.", 409);
    }

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: {
            id: order.id,
            paymentStatus: "AWAITING_REVIEW",
            stockRestoredAt: null,
          },
          data: {
            paymentStatus: "PAYMENT_REJECTED",
            status: "CANCELLED",
            paymentReviewedAt: new Date(),
            paymentReviewedBy: session.id,
            paymentRejectReason: reason,
            stockRestoredAt: new Date(),
          },
        });
        if (claimed.count !== 1) {
          throw new Error("PAYMENT_ALREADY_REVIEWED");
        }

        for (const item of order.items) {
          if (!item.itemId || item.quantity <= 0) continue;
          await tx.item.updateMany({
            where: { id: item.itemId, stock: { not: null } },
            data: { stock: { increment: item.quantity } },
          });
        }

        return tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: { items: true, business: { select: { name: true, slug: true } }, customer: true },
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message === "PAYMENT_ALREADY_REVIEWED") {
        return jsonError("Оплата уже была обработана продавцом.", 409);
      }
      if (!isPrismaMissingColumnError(error, "Order", "stockRestoredAt")) throw error;
      warnPrismaSchemaDrift("Payment rejection could not restore stock because stockRestoredAt is missing", error);
      updated = await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "PAYMENT_REJECTED",
          status: "CANCELLED",
          paymentReviewedAt: new Date(),
          paymentReviewedBy: session.id,
          paymentRejectReason: reason,
        },
        include: { items: true, business: { select: { name: true, slug: true } }, customer: true },
      });
    }

    if (order.customer?.telegramUserId) {
      telegramBot
        .sendNotification(order.customer.telegramUserId.toString(), `❌ Оплата отклонена продавцом. ${reason}`)
        .catch((error) => console.warn("[PAYMENT REJECT] customer telegram notification failed:", error));
    }

    return NextResponse.json({ ok: true, order: toJsonSafe(updated) });
  } catch (error) {
    console.error("POST /api/seller/orders/[orderId]/reject-payment failed:", error);
    return jsonError("Не удалось отклонить оплату.", 500);
  }
}
