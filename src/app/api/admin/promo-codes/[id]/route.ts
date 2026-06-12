import { NextRequest, NextResponse } from "next/server";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { isValidPromoCodeFormat, normalizePromoCode } from "@/lib/promo-codes";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession(request);
  if (!session) return jsonError("Нужен вход в панель продавца.", 401);
  if (session.role === "MANAGER") return jsonError("У менеджера нет доступа к управлению промокодами.", 403);

  const { id } = await context.params;
  const existing = await prisma.promoCode.findUnique({ where: { id }, select: { businessId: true } });
  if (!existing) return jsonError("Промокод не найден.", 404);
  if (!canUseBusiness(session, existing.businessId)) return jsonError("Нет доступа к этому промокоду.", 403);

  const body = await request.json();
  const code = body.code === undefined ? undefined : normalizePromoCode(body.code);
  if (code !== undefined && !isValidPromoCodeFormat(code)) {
    return jsonError("Промокод должен содержать 3–32 латинских символа, цифры, _ или -.", 400);
  }

  const discountPercent = body.discountPercent === undefined ? undefined : Math.round(Number(body.discountPercent));
  if (discountPercent !== undefined && (!Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 90)) {
    return jsonError("Укажите скидку от 1 до 90 процентов.", 400);
  }

  const startsAt = body.startsAt === undefined ? undefined : body.startsAt ? new Date(String(body.startsAt)) : null;
  const expiresAt = body.expiresAt === undefined ? undefined : body.expiresAt ? new Date(String(body.expiresAt)) : null;
  if (startsAt instanceof Date && Number.isNaN(startsAt.getTime())) return jsonError("Проверьте дату начала.", 400);
  if (expiresAt instanceof Date && Number.isNaN(expiresAt.getTime())) return jsonError("Проверьте дату окончания.", 400);

  const usageLimit = body.usageLimit === undefined
    ? undefined
    : body.usageLimit === "" || body.usageLimit === null
      ? null
      : Math.max(1, Math.round(Number(body.usageLimit)));

  try {
    const promoCode = await prisma.promoCode.update({
      where: { id },
      data: {
        ...(code !== undefined ? { code } : {}),
        ...(discountPercent !== undefined ? { discountPercent } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        ...(startsAt !== undefined ? { startsAt } : {}),
        ...(expiresAt !== undefined ? { expiresAt } : {}),
        ...(usageLimit !== undefined ? { usageLimit } : {}),
      },
    });
    return NextResponse.json({ ok: true, promoCode });
  } catch (error: any) {
    if (error?.code === "P2002") return jsonError("Такой промокод уже существует.", 409);
    throw error;
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession(request);
  if (!session) return jsonError("Нужен вход в панель продавца.", 401);
  if (session.role === "MANAGER") return jsonError("У менеджера нет доступа к управлению промокодами.", 403);

  const { id } = await context.params;
  const existing = await prisma.promoCode.findUnique({ where: { id }, select: { businessId: true } });
  if (!existing) return jsonError("Промокод не найден.", 404);
  if (!canUseBusiness(session, existing.businessId)) return jsonError("Нет доступа к этому промокоду.", 403);

  const promoCode = await prisma.promoCode.update({
    where: { id },
    data: { isActive: false, archivedAt: new Date() },
  });
  return NextResponse.json({ ok: true, promoCode, archived: true });
}
