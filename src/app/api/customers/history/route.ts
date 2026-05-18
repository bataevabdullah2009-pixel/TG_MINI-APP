import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
        business: true,
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
        business: true,
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
    console.error("[customer history GET error]", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
