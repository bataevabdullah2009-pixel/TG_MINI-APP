import { NextRequest, NextResponse } from "next/server";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { toJsonSafe } from "@/lib/prisma-schema-guard";
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
      include: { business: true, customer: true },
    });

    if (!order) return jsonError("Заказ не найден.", 404);
    if (!canUseBusiness(session, order.businessId)) {
      return jsonError("Нет доступа к этому заказу.", 403);
    }
    if (order.paymentMethod !== "TRANSFER") {
      return jsonError("У заказа не выбран перевод.", 400);
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "REJECTED",
        status: "CANCELLED",
        paymentReviewedAt: new Date(),
        paymentReviewedBy: session.id,
        paymentRejectReason: reason,
      },
      include: { items: true, business: { select: { name: true, slug: true } }, customer: true },
    });

    if (order.customer?.telegramUserId) {
      telegramBot
        .sendNotification(order.customer.telegramUserId.toString(), "❌ Оплата не подтверждена. Свяжитесь с продавцом.")
        .catch((error) => console.warn("[PAYMENT REJECT] customer telegram notification failed:", error));
    }

    return NextResponse.json({ ok: true, order: toJsonSafe(updated) });
  } catch (error) {
    console.error("POST /api/seller/orders/[orderId]/reject-payment failed:", error);
    return jsonError("Не удалось отклонить оплату.", 500);
  }
}
