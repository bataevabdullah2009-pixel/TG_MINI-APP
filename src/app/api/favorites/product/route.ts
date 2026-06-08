import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  favoriteItemInclude,
  identityValuesFromSearch,
  resolveFavoriteTelegramUserId,
} from "@/lib/favorites-api";
import { toJsonSafe } from "@/lib/prisma-schema-guard";

type FavoriteProductBody = {
  productId?: string;
  itemId?: string;
  telegramUserId?: string;
  tgId?: string;
  userId?: string;
};

async function readBody(request: NextRequest): Promise<FavoriteProductBody> {
  return request.json().catch(() => ({}));
}

async function resolveProduct(body: FavoriteProductBody, searchParams: URLSearchParams) {
  const productId = body.productId || body.itemId || searchParams.get("productId") || searchParams.get("itemId");
  if (!productId) return null;

  return prisma.item.findUnique({
    where: { id: productId },
    select: {
      id: true,
      businessId: true,
      isAvailable: true,
      business: {
        select: {
          isActive: true,
          isArchived: true,
          isDeleted: true,
          subscriptionStatus: true,
        },
      },
    },
  });
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Не удалось определить Telegram пользователя." }, { status: 401 });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const telegramUserId = await resolveFavoriteTelegramUserId(request, identityValuesFromSearch(searchParams));
    if (!telegramUserId) return unauthorized();

    const targetProduct = await resolveProduct({}, searchParams);
    if (targetProduct) {
      const favorite = await prisma.favoriteItem.findUnique({
        where: {
          itemId_telegramUserId: {
            itemId: targetProduct.id,
            telegramUserId,
          },
        },
        select: { id: true },
      });

      return NextResponse.json({
        ok: true,
        data: { favorited: Boolean(favorite), productId: targetProduct.id, itemId: targetProduct.id },
      });
    }

    const favoriteProducts = await prisma.favoriteItem.findMany({
      where: {
        telegramUserId,
        item: { isAvailable: true },
        business: {
          isActive: true,
          isArchived: false,
          isDeleted: false,
          subscriptionStatus: { not: "ARCHIVED" },
        },
      },
      include: favoriteItemInclude,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      data: toJsonSafe({
        favoriteProducts,
        favoriteItems: favoriteProducts,
        productIds: favoriteProducts.map((favorite) => favorite.itemId),
      }),
    });
  } catch (error) {
    console.error("[favorites/product GET error]", error);
    return NextResponse.json({ ok: false, error: "Избранные товары временно недоступны." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);
    const { searchParams } = new URL(request.url);
    const telegramUserId = await resolveFavoriteTelegramUserId(request, { ...identityValuesFromSearch(searchParams), ...body });
    if (!telegramUserId) return unauthorized();

    const product = await resolveProduct(body, searchParams);
    if (!product) {
      return NextResponse.json({ ok: false, error: "Товар не найден." }, { status: 404 });
    }
    if (
      !product.isAvailable ||
      !product.business.isActive ||
      product.business.isArchived ||
      product.business.isDeleted ||
      product.business.subscriptionStatus === "ARCHIVED"
    ) {
      return NextResponse.json(
        { ok: false, error: "Товар временно недоступен." },
        { status: 409 }
      );
    }

    await prisma.favoriteItem.upsert({
      where: {
        itemId_telegramUserId: {
          itemId: product.id,
          telegramUserId,
        },
      },
      update: {},
      create: {
        businessId: product.businessId,
        itemId: product.id,
        telegramUserId,
      },
    });

    return NextResponse.json({ ok: true, data: { favorited: true, productId: product.id, itemId: product.id } });
  } catch (error) {
    console.error("[favorites/product POST error]", error);
    return NextResponse.json({ ok: false, error: "Не удалось добавить товар в избранное." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await readBody(request);
    const { searchParams } = new URL(request.url);
    const telegramUserId = await resolveFavoriteTelegramUserId(request, { ...identityValuesFromSearch(searchParams), ...body });
    if (!telegramUserId) return unauthorized();

    const product = await resolveProduct(body, searchParams);
    if (!product) {
      return NextResponse.json({ ok: false, error: "Товар не найден." }, { status: 404 });
    }

    await prisma.favoriteItem.deleteMany({
      where: {
        itemId: product.id,
        telegramUserId,
      },
    });

    return NextResponse.json({ ok: true, data: { favorited: false, productId: product.id, itemId: product.id } });
  } catch (error) {
    console.error("[favorites/product DELETE error]", error);
    return NextResponse.json({ ok: false, error: "Не удалось удалить товар из избранного." }, { status: 500 });
  }
}
