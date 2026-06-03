import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const defaultTimes = ["10:00", "11:00", "12:00", "13:00", "15:00", "16:00", "17:00", "18:00"];

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const staffId = searchParams.get("staffId") || undefined;

  const business = await prisma.business.findUnique({ where: { slug }, select: { id: true, isActive: true } });
  if (!business || !business.isActive) {
    return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
  }

  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59`);
  const bookings = await prisma.booking.findMany({
    where: {
      businessId: business.id,
      ...(staffId ? { staffId } : {}),
      startTime: { gte: start, lte: end },
      status: { notIn: ["CANCELLED", "EXPIRED", "NO_SHOW"] },
    },
    select: { startTime: true },
  });

  const busy = new Set(bookings.map((booking) => booking.startTime.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })));
  const slots = defaultTimes.filter((time) => !busy.has(time));

  return NextResponse.json({ date, slots });
}
