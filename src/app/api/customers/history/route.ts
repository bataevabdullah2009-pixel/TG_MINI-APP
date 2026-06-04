import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyDatabaseError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";

const historyBusinessSelect = {
  id: true,
  slug: true,
  name: true,
  primaryColor: true,
  accentColor: true,
} as const;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramUserIdStr = searchParams.get("telegramUserId");

    if (!telegramUserIdStr) {
      return NextResponse.json({ ok: false, error: "Параметр telegramUserId обязателен." }, { status: 400 });
    }

    const telegramUserId = BigInt(telegramUserIdStr);

    // 1. Find all customer records associated with this telegramId
    const customers = await prisma.customer.findMany({
      where: { telegramUserId },
      select: { id: true },
    });

    const customerIds = customers.map((c) => c.id);

    // 2. Fetch orders
    const orders = await prisma.order.findMany({
      where: {
        customerId: { in: customerIds },
      },
      include: {
        business: { select: historyBusinessSelect },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // 3. Fetch bookings
    const bookings = await prisma.booking.findMany({
      where: {
        customerId: { in: customerIds },
      },
      include: {
        business: { select: historyBusinessSelect },
        service: true,
        staff: true,
      },
      orderBy: { startTime: "desc" },
    });

    // Safely serialize BigInt to String in JSON
    const safeData = JSON.parse(
      JSON.stringify({ orders, bookings }, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return NextResponse.json({ ok: true, data: safeData });
  } catch (e: any) {
    const classification = classifyDatabaseError(e);
    warnPrismaSchemaDrift("Customer history query failed", e);
    return NextResponse.json(
      { ok: false, code: classification.code, error: "Order history is temporarily unavailable." },
      { status: 503 }
    );
  }
}
