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
  try {
    const { searchParams } = new URL(request.url);
    const telegramUserId = searchParams.get("telegramUserId");
    const superAdmin = isSuperAdmin(telegramUserId);
    const hideDemo = process.env.NODE_ENV === "production" && !superAdmin;

    const businesses = await prisma.business.findMany({
      where: { isActive: true, ...(hideDemo ? { isDemo: false } : {}) },
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
        isDemo: true,
        _count: { select: { orders: true, bookings: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const isDbEmpty = businesses.length === 0;

    return NextResponse.json({
      isSuperAdmin: superAdmin,
      isDbEmpty,
      businesses: businesses.map((business) => ({
        ...business,
        typeLabel: typeLabels[business.type] || "Бизнес",
        rating: 4.8,
        isOpen: true,
      })),
      message: isDbEmpty ? "База подключена, но данные не загружены" : undefined,
    });
  } catch (error: any) {
    console.error("Database Connection Error in Marketplace:", error);
    return NextResponse.json(
      {
        error: "Не удалось подключиться к базе данных. Проверьте настройки подключения в Vercel.",
        businesses: [],
        isDbEmpty: true,
      },
      { status: 500 }
    );
  }
}
