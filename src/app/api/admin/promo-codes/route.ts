import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { isValidPromoCodeFormat, normalizePromoCode } from "@/lib/promo-codes";

function parseOptionalDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function generatedCode() {
  return `SALE-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function GET(request: NextRequest) {
  const session = await getAdminSession(request);
  if (!session) return jsonError("Нужен вход в панель продавца.", 401);
  if (session.role === "MANAGER") return jsonError("У менеджера нет доступа к управлению промокодами.", 403);

  const businessId = new URL(request.url).searchParams.get("businessId") || session.businessId;
  if (!businessId || !canUseBusiness(session, businessId)) {
    return jsonError("Нет доступа к промокодам этого бизнеса.", 403);
  }

  const promoCodes = await prisma.promoCode.findMany({
    where: { businessId },
    orderBy: [{ archivedAt: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  return NextResponse.json({ ok: true, promoCodes });
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession(request);
  if (!session) return jsonError("Нужен вход в панель продавца.", 401);
  if (session.role === "MANAGER") return jsonError("У менеджера нет доступа к управлению промокодами.", 403);

  const body = await request.json();
  const businessId = body.businessId || session.businessId;
  if (!businessId || !canUseBusiness(session, businessId)) {
    return jsonError("Нет доступа к промокодам этого бизнеса.", 403);
  }

  const discountPercent = Math.round(Number(body.discountPercent));
  if (!Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 90) {
    return jsonError("Укажите скидку от 1 до 90 процентов.", 400);
  }

  const startsAt = parseOptionalDate(body.startsAt);
  const expiresAt = parseOptionalDate(body.expiresAt);
  if (startsAt === undefined || expiresAt === undefined) return jsonError("Проверьте даты действия промокода.", 400);
  if (startsAt && expiresAt && startsAt >= expiresAt) return jsonError("Дата окончания должна быть позже даты начала.", 400);

  const usageLimit = body.usageLimit === "" || body.usageLimit === null || body.usageLimit === undefined
    ? null
    : Math.max(1, Math.round(Number(body.usageLimit)));
  if (usageLimit !== null && !Number.isFinite(usageLimit)) return jsonError("Укажите корректный лимит использований.", 400);

  let code = normalizePromoCode(body.code);
  if (code && !isValidPromoCodeFormat(code)) {
    return jsonError("Промокод должен содержать 3–32 латинских символа, цифры, _ или -.", 400);
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      if (!code) code = generatedCode();
      const promoCode = await prisma.promoCode.create({
        data: {
          businessId,
          code,
          discountPercent,
          startsAt,
          expiresAt,
          usageLimit,
          isActive: body.isActive === undefined ? true : Boolean(body.isActive),
        },
      });
      return NextResponse.json({ ok: true, promoCode }, { status: 201 });
    } catch (error: any) {
      if (error?.code !== "P2002") throw error;
      if (body.code) return jsonError("Такой промокод уже существует.", 409);
      code = "";
    }
  }

  return jsonError("Не удалось сгенерировать уникальный промокод. Попробуйте снова.", 500);
}
