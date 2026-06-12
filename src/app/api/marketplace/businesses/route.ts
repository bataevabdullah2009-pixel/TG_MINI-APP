import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyDatabaseError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";

const typeLabels: Record<string, string> = {
  CAFE: "Еда",
  BARBERSHOP: "Барбершоп",
  SHOP: "Магазин",
  GROCERY: "Продукты",
  HARDWARE_STORE: "Хозмаг",
  CARWASH: "Автомойка",
};

const marketplaceBusinessSelect = {
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
  isOpen: true,
  _count: { select: { orders: true, bookings: true } },
} as const;

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

    const businesses = await prisma.business.findMany({
      where: {
        isActive: true,
        accessStatus: "ACTIVE",
        archivedAt: null,
      },
      select: marketplaceBusinessSelect,
      orderBy: { createdAt: "desc" },
    });

    const isDbEmpty = businesses.length === 0;
    if (businesses.length < 3) {
      console.warn("[Marketplace] Fewer than 3 active businesses returned.", {
        count: businesses.length,
        slugs: businesses.map((business) => business.slug),
      });
    }

    return NextResponse.json({
      isSuperAdmin: superAdmin,
      isDbEmpty,
      businesses: businesses.map((business) => ({
        ...business,
        typeLabel: typeLabels[business.type] || "Бизнес",
        rating: 4.8,
        isOpen: business.isOpen,
      })),
      message: isDbEmpty ? "База подключена, но данные не загружены" : undefined,
    });
  } catch (error) {
    const classification = classifyDatabaseError(error);
    warnPrismaSchemaDrift("Marketplace businesses query failed", error);
    return NextResponse.json(
      {
        ok: false,
        code: classification.code,
        error: "Каталог временно недоступен из-за ошибки базы данных.",
      },
      { status: 503 }
    );
  }
}
