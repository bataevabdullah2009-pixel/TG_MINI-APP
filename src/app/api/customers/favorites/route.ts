import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBusinessIsDemoMissingColumnError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";

const favoriteBusinessSelect = {
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
} as const;

// GET: Получить все избранные бизнесы и товары пользователя
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramUserIdStr = searchParams.get("telegramUserId");

    if (!telegramUserIdStr) {
      return NextResponse.json({ ok: false, error: "Параметр telegramUserId обязателен." }, { status: 400 });
    }

    const telegramUserId = BigInt(telegramUserIdStr);

    const favoriteBusinesses = await prisma.favoriteBusiness.findMany({
      where: {
        telegramUserId,
        business: {
          is: {
            isActive: true,
            accessStatus: "ACTIVE",
            archivedAt: null,
          },
        },
      },
      include: {
        business: { select: favoriteBusinessSelect },
      },
    });

    const favoriteItems = await prisma.favoriteItem.findMany({
      where: {
        telegramUserId,
        item: { is: { isAvailable: true, archivedAt: null } },
        business: {
          is: {
            isActive: true,
            accessStatus: "ACTIVE",
            archivedAt: null,
          },
        },
      },
      include: {
        item: true,
        business: { select: favoriteBusinessSelect },
      },
    });

    // Safely serialize BigInt to String in JSON
    const safeData = JSON.parse(
      JSON.stringify({ favoriteBusinesses, favoriteItems }, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return NextResponse.json({ ok: true, data: safeData });
  } catch (e: any) {
    console.error("[favorites GET error]", e);
    if (isBusinessIsDemoMissingColumnError(e)) {
      warnPrismaSchemaDrift("Favorites loaded as an empty list while Business.isDemo is missing", e);
      return NextResponse.json({ ok: true, data: { favoriteBusinesses: [], favoriteItems: [] } });
    }
    return NextResponse.json({ ok: false, error: "Favorites are temporarily unavailable." }, { status: 500 });
  }
}

// POST: Переключить (Добавить/Удалить) избранное
export async function POST(req: Request) {
  try {
    const { telegramUserId: tgId, businessId, itemId, action } = await req.json();

    if (!tgId || !businessId) {
      return NextResponse.json({ ok: false, error: "Не все параметры переданы." }, { status: 400 });
    }

    const telegramUserId = BigInt(tgId);
    const business = await prisma.business.findFirst({
      where: {
        id: businessId,
        isActive: true,
        accessStatus: "ACTIVE",
        archivedAt: null,
      },
      select: { id: true },
    });
    if (!business) {
      return NextResponse.json({ ok: false, error: "Бизнес временно недоступен." }, { status: 404 });
    }

    if (itemId) {
      const item = await prisma.item.findFirst({
        where: {
          id: itemId,
          businessId,
          isAvailable: true,
          archivedAt: null,
        },
        select: { id: true },
      });
      if (!item && action !== "remove") {
        return NextResponse.json({ ok: false, error: "Товар недоступен." }, { status: 404 });
      }
      // Toggle Favorite Item
      const existing = await prisma.favoriteItem.findUnique({
        where: {
          itemId_telegramUserId: {
            itemId,
            telegramUserId,
          },
        },
      });

      if (existing || action === "remove") {
        await prisma.favoriteItem.delete({
          where: {
            itemId_telegramUserId: {
              itemId,
              telegramUserId,
            },
          },
        });
        return NextResponse.json({ ok: true, favorited: false });
      } else {
        await prisma.favoriteItem.create({
          data: {
            businessId,
            itemId,
            telegramUserId,
          },
        });
        return NextResponse.json({ ok: true, favorited: true });
      }
    } else {
      // Toggle Favorite Business
      const existing = await prisma.favoriteBusiness.findUnique({
        where: {
          businessId_telegramUserId: {
            businessId,
            telegramUserId,
          },
        },
      });

      if (existing || action === "remove") {
        await prisma.favoriteBusiness.delete({
          where: {
            businessId_telegramUserId: {
              businessId,
              telegramUserId,
            },
          },
        });
        return NextResponse.json({ ok: true, favorited: false });
      } else {
        await prisma.favoriteBusiness.create({
          data: {
            businessId,
            telegramUserId,
          },
        });
        return NextResponse.json({ ok: true, favorited: true });
      }
    }
  } catch (e: any) {
    console.error("[favorites POST error]", e);
    return NextResponse.json({ ok: false, error: "Could not update favorites right now." }, { status: 500 });
  }
}
