import { NextRequest, NextResponse } from "next/server";
import { getTelegramSessionUser } from "@/lib/auth-telegram";
import { prisma } from "@/lib/prisma";
import { toJsonSafe } from "@/lib/prisma-schema-guard";

export async function GET(request: NextRequest) {
  try {
    const initData = request.headers.get("x-telegram-init-data") || "";
    if (!initData) {
      return NextResponse.json({ ok: false, error: "Нужна авторизация через Telegram." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const businessSlug = searchParams.get("businessSlug") || "";

    let businessId: string | undefined;
    if (businessSlug) {
      const business = await prisma.business.findFirst({
        where: { OR: [{ id: businessSlug }, { slug: businessSlug }] },
        select: { id: true },
      });
      businessId = business?.id;
    }

    const session = await getTelegramSessionUser(initData, businessId);
    if (!session) {
      return NextResponse.json({ ok: false, error: "Нужна авторизация через Telegram." }, { status: 401 });
    }

    const telegramUserId = BigInt(session.telegramUserId);
    const customers = await prisma.customer.findMany({
      where: {
        telegramUserId,
        ...(businessId ? { businessId } : {}),
      },
      select: { id: true },
    });

    if (customers.length === 0) {
      return NextResponse.json({ ok: true, orders: [] });
    }

    const orders = await prisma.order.findMany({
      where: {
        customerId: { in: customers.map((customer) => customer.id) },
      },
      include: {
        business: { select: { id: true, slug: true, name: true, primaryColor: true, accentColor: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, orders: toJsonSafe(orders) });
  } catch (error) {
    console.error("GET /api/customer/orders failed:", error);
    return NextResponse.json({ ok: true, orders: [] });
  }
}
