import {
  BusinessPaymentMethod,
  BusinessPaymentType,
} from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAdminSession,
  jsonError,
  requireRole,
} from "@/lib/admin-auth";
import {
  archiveBusiness,
  blockBusinessManually,
  recordBusinessPayment,
  restoreBusiness,
  softDeleteBusiness,
  unblockBusinessManually,
  COMMERCIAL_MONTHLY_FEE_RUB,
} from "@/lib/subscriptions/business-subscription-service";
import { toJsonSafe } from "@/lib/prisma-schema-guard";

const allowedPaymentTypes = new Set<BusinessPaymentType>([
  "SETUP",
  "MANUAL",
  "REFUND",
  "BONUS",
]);
const allowedPaymentMethods = new Set<BusinessPaymentMethod>([
  "CASH",
  "TRANSFER",
  "CARD",
  "MANUAL",
]);

export async function POST(
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
    const existing = await prisma.business.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) return jsonError("Бизнес не найден.", 404);

    if (
      action === "PAY_SETUP" ||
      action === "PAYMENT" ||
      action === "RENEW_1M" ||
      action === "RENEW_3M" ||
      action === "RENEW_6M" ||
      action === "RENEW_12M"
    ) {
      if (action === "PAY_SETUP") {
        const existingSetupPayment = await prisma.businessPayment.findFirst({
          where: { businessId: id, type: "SETUP" },
          select: { id: true },
        });
        if (existingSetupPayment) {
          return jsonError("Разовая оплата 50 000 ₽ уже отмечена.", 409);
        }
      }

      const renewalMonthsMap: Record<string, number> = {
        RENEW_1M: 1,
        RENEW_3M: 3,
        RENEW_6M: 6,
        RENEW_12M: 12,
      };
      const renewalMonths = renewalMonthsMap[action] || 0;

      const requestedType = String(
        body.type ||
          (action === "PAY_SETUP"
            ? "SETUP"
            : renewalMonths > 0
              ? "MONTHLY"
              : "MANUAL")
      ).toUpperCase() as BusinessPaymentType;
      const requestedMethod = String(
        body.method || "MANUAL"
      ).toUpperCase() as BusinessPaymentMethod;
      if (!allowedPaymentTypes.has(requestedType)) {
        return jsonError("Неизвестный тип платежа.", 400);
      }
      if (!allowedPaymentMethods.has(requestedMethod)) {
        return jsonError("Неизвестный способ оплаты.", 400);
      }
      const requestedAmount =
        body.amount === undefined || body.amount === ""
          ? renewalMonths > 0
            ? COMMERCIAL_MONTHLY_FEE_RUB * renewalMonths
            : undefined
          : Number(body.amount);
      if (
        requestedAmount !== undefined &&
        (!Number.isFinite(requestedAmount) ||
          requestedAmount === 0 ||
          (requestedType !== "REFUND" && requestedAmount < 0))
      ) {
        return jsonError("Сумма платежа должна быть ненулевым числом.", 400);
      }

      const commentText = renewalMonths > 0
        ? `Продление на ${renewalMonths} мес. (${(COMMERCIAL_MONTHLY_FEE_RUB * renewalMonths).toLocaleString("ru-RU")} ₽)`
        : typeof body.comment === "string"
          ? body.comment.slice(0, 1000)
          : null;

      const result = await recordBusinessPayment({
        businessId: id,
        amount: requestedAmount,
        type: requestedType,
        monthsAdded: renewalMonths,
        method: requestedMethod,
        comment: commentText,
        createdByAdminId: session.id,
      });
      return NextResponse.json({ ok: true, data: toJsonSafe(result) });
    }

    if (action === "BLOCK") {
      const business = await blockBusinessManually(
        id,
        String(body.reason || "Бизнес заблокирован администратором")
      );
      return NextResponse.json({ ok: true, data: toJsonSafe(business) });
    }

    if (action === "UNBLOCK") {
      const business = await unblockBusinessManually(id);
      return NextResponse.json({ ok: true, data: toJsonSafe(business) });
    }

    if (action === "ARCHIVE") {
      const business = await archiveBusiness(id);
      return NextResponse.json({ ok: true, data: toJsonSafe(business) });
    }

    if (action === "DELETE") {
      const business = await softDeleteBusiness(id);
      return NextResponse.json({ ok: true, data: toJsonSafe(business) });
    }

    if (action === "RESTORE") {
      const business = await restoreBusiness(id);
      return NextResponse.json({ ok: true, data: toJsonSafe(business) });
    }

    if (action === "EDIT") {
      const ownerTelegramId =
        body.ownerTelegramId === undefined || body.ownerTelegramId === ""
          ? undefined
          : BigInt(String(body.ownerTelegramId));
      const business = await prisma.business.update({
        where: { id },
        data: {
          ...(body.name !== undefined
            ? { name: String(body.name).trim() }
            : {}),
          ...(body.phone !== undefined
            ? { phone: String(body.phone).trim() || null }
            : {}),
          ...(body.isOpen !== undefined
            ? { isOpen: Boolean(body.isOpen) }
            : {}),
          ...(body.paymentComment !== undefined
            ? {
                paymentComment:
                  String(body.paymentComment).trim() || null,
              }
            : {}),
          ...(body.ownerName !== undefined ||
          body.ownerPhone !== undefined ||
          ownerTelegramId !== undefined
            ? {
                owner: {
                  update: {
                    ...(body.ownerName !== undefined
                      ? { name: String(body.ownerName).trim() || null }
                      : {}),
                    ...(body.ownerPhone !== undefined
                      ? { phone: String(body.ownerPhone).trim() || null }
                      : {}),
                    ...(ownerTelegramId !== undefined
                      ? { telegramId: ownerTelegramId }
                      : {}),
                  },
                },
              }
            : {}),
        },
      });
      return NextResponse.json({ ok: true, data: toJsonSafe(business) });
    }

    return jsonError("Неизвестное действие.", 400);
  } catch (error) {
    console.error(
      "POST /api/admin/super/businesses/[id]/actions failed:",
      error
    );
    return jsonError("Не удалось выполнить действие с бизнесом.", 500);
  }
}
