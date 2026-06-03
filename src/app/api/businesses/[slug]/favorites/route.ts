import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const body = await request.json();
  const telegramUserId = body.telegramUserId ? BigInt(body.telegramUserId) : null;

  if (!telegramUserId) {
    return NextResponse.json({ ok: true, storage: "local" });
  }

  const business = await prisma.business.findUnique({ where: { slug }, select: { id: true } });
  if (!business) {
    return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
  }

  if (body.itemId) {
    await prisma.favoriteItem.upsert({
      where: { itemId_telegramUserId: { itemId: body.itemId, telegramUserId } },
      update: {},
      create: { businessId: business.id, itemId: body.itemId, telegramUserId },
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.favoriteBusiness.upsert({
    where: { businessId_telegramUserId: { businessId: business.id, telegramUserId } },
    update: {},
    create: { businessId: business.id, telegramUserId },
  });

  return NextResponse.json({ ok: true });
}
