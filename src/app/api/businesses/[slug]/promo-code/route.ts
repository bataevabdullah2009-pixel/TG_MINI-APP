import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApplicablePromoCode } from "@/lib/promo-codes";

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const body = await request.json();
  const business = await prisma.business.findFirst({
    where: {
      isActive: true,
      subscriptionStatus: { notIn: ["BLOCKED", "EXPIRED"] },
      OR: [{ id: slug }, { slug }, { slug: { equals: slug, mode: "insensitive" } }],
    },
    select: { id: true },
  });
  if (!business) {
    return NextResponse.json({ ok: false, error: "Магазин не найден или временно недоступен." }, { status: 404 });
  }

  const result = await getApplicablePromoCode(business.id, body.code);
  if (!result.ok) return NextResponse.json(result, { status: 400 });

  return NextResponse.json({
    ok: true,
    code: result.promo.code,
    discountPercent: result.promo.discountPercent,
    message: `Промокод применён: скидка ${result.promo.discountPercent}%.`,
  });
}
