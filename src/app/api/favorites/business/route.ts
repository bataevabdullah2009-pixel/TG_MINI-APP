import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  favoriteBusinessSelect,
  identityValuesFromSearch,
  resolveFavoriteTelegramUserId,
} from "@/lib/favorites-api";
import { toJsonSafe } from "@/lib/prisma-schema-guard";

type FavoriteBusinessBody = {
  businessId?: string;
  slug?: string;
  telegramUserId?: string;
  tgId?: string;
  userId?: string;
};

async function readBody(request: NextRequest): Promise<FavoriteBusinessBody> {
  return request.json().catch(() => ({}));
}

async function resolveBusiness(body: FavoriteBusinessBody, searchParams: URLSearchParams) {
  const businessId = body.businessId || searchParams.get("businessId") || undefined;
  const slug = body.slug || searchParams.get("slug") || undefined;

  if (businessId) {
    return prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, slug: true },
    });
  }

  if (slug) {
    return prisma.business.findUnique({
      where: { slug },
      select: { id: true, slug: true },
    });
  }

  return null;
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Не удалось определить Telegram пользователя." }, { status: 401 });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const telegramUserId = resolveFavoriteTelegramUserId(request, identityValuesFromSearch(searchParams));
    if (!telegramUserId) return unauthorized();

    const targetBusiness = await resolveBusiness({}, searchParams);
    if (targetBusiness) {
      const favorite = await prisma.favoriteBusiness.findUnique({
        where: {
          businessId_telegramUserId: {
            businessId: targetBusiness.id,
            telegramUserId,
          },
        },
        select: { id: true },
      });

      return NextResponse.json({
        ok: true,
        data: { favorited: Boolean(favorite), businessId: targetBusiness.id, slug: targetBusiness.slug },
      });
    }

    const favoriteBusinesses = await prisma.favoriteBusiness.findMany({
      where: { telegramUserId },
      include: { business: { select: favoriteBusinessSelect } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      data: toJsonSafe({
        favoriteBusinesses,
        businessIds: favoriteBusinesses.map((favorite) => favorite.businessId),
        businessSlugs: favoriteBusinesses.map((favorite) => favorite.business.slug),
      }),
    });
  } catch (error) {
    console.error("[favorites/business GET error]", error);
    return NextResponse.json({ ok: false, error: "Избранное временно недоступно." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);
    const { searchParams } = new URL(request.url);
    const telegramUserId = resolveFavoriteTelegramUserId(request, { ...identityValuesFromSearch(searchParams), ...body });
    if (!telegramUserId) return unauthorized();

    const business = await resolveBusiness(body, searchParams);
    if (!business) {
      return NextResponse.json({ ok: false, error: "Бизнес не найден." }, { status: 404 });
    }

    await prisma.favoriteBusiness.upsert({
      where: {
        businessId_telegramUserId: {
          businessId: business.id,
          telegramUserId,
        },
      },
      update: {},
      create: {
        businessId: business.id,
        telegramUserId,
      },
    });

    return NextResponse.json({ ok: true, data: { favorited: true, businessId: business.id, slug: business.slug } });
  } catch (error) {
    console.error("[favorites/business POST error]", error);
    return NextResponse.json({ ok: false, error: "Не удалось добавить бизнес в избранное." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await readBody(request);
    const { searchParams } = new URL(request.url);
    const telegramUserId = resolveFavoriteTelegramUserId(request, { ...identityValuesFromSearch(searchParams), ...body });
    if (!telegramUserId) return unauthorized();

    const business = await resolveBusiness(body, searchParams);
    if (!business) {
      return NextResponse.json({ ok: false, error: "Бизнес не найден." }, { status: 404 });
    }

    await prisma.favoriteBusiness.deleteMany({
      where: {
        businessId: business.id,
        telegramUserId,
      },
    });

    return NextResponse.json({ ok: true, data: { favorited: false, businessId: business.id, slug: business.slug } });
  } catch (error) {
    console.error("[favorites/business DELETE error]", error);
    return NextResponse.json({ ok: false, error: "Не удалось удалить бизнес из избранного." }, { status: 500 });
  }
}
