import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
      where: { telegramUserId },
      include: {
        business: true,
      },
    });

    const favoriteItems = await prisma.favoriteItem.findMany({
      where: { telegramUserId },
      include: {
        item: true,
        business: true,
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
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
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

    if (itemId) {
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
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
