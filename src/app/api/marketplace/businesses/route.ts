import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const typeLabels: Record<string, string> = {
  CAFE: "Еда",
  BARBERSHOP: "Барбершоп",
  SHOP: "Магазин",
  GROCERY: "Продукты",
  HARDWARE_STORE: "Хозмаг",
  CARWASH: "Автомойка",
};

function isSuperAdmin(telegramUserId: string | null) {
  if (!telegramUserId) return false;
  const ids = (process.env.TELEGRAM_SUPER_ADMIN_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.includes(telegramUserId);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const telegramUserId = searchParams.get("telegramUserId");

  const businesses = await prisma.business.findMany({
    where: { isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      templateKey: true,
      description: true,
      logoUrl: true,
      address: true,
      primaryColor: true,
      accentColor: true,
      _count: { select: { orders: true, bookings: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    isSuperAdmin: isSuperAdmin(telegramUserId),
    businesses: businesses.map((business) => ({
      ...business,
      typeLabel: typeLabels[business.type] || "Бизнес",
      rating: 4.8,
      isOpen: true,
    })),
  });
}
