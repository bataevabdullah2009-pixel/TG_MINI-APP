import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyDatabaseError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";
import { createServerTiming } from "@/lib/server-timing";

const catalogBusinessBaseSelect = {
  id: true,
  slug: true,
  name: true,
  type: true,
  templateKey: true,
  description: true,
  logoUrl: true,
  coverImageUrl: true,
  primaryColor: true,
  accentColor: true,
  phone: true,
  address: true,
  latitude: true,
  longitude: true,
  telegramUrl: true,
  whatsappUrl: true,
  instagramUrl: true,
  telegramBotUsername: true,
  telegramUsername: true,
  currency: true,
  language: true,
  timezone: true,
  subscriptionStatus: true,
  subscriptionPlanId: true,
  subscriptionStartDate: true,
  subscriptionEndDate: true,
  modulesEnabled: true,
  aiProvider: true,
  aiModel: true,
  aiEnabled: true,
  aiDailyLimit: true,
  aiMonthlyLimit: true,
  isActive: true,
} as const;

const currentBusinessFieldsSelect = {
  isOpen: true,
  transferPaymentEnabled: true,
  transferBankName: true,
  transferPaymentPhone: true,
  transferRecipientName: true,
  transferPaymentCommentRequired: true,
  transferPaymentInstructions: true,
} as const;

function normalizeLookup(value: string) {
  try {
    return decodeURIComponent(value).trim().replace(/^\/+|\/+$/g, "");
  } catch {
    return value.trim().replace(/^\/+|\/+$/g, "");
  }
}

function catalogRelations(search: string | undefined, includeDeliveryConfig: boolean, limit: number) {
  return {
    settings: includeDeliveryConfig
      ? {
          select: {
            deliveryEnabled: true,
            pickupEnabled: true,
            bookingEnabled: true,
            minOrderAmount: true,
            deliveryFee: true,
            deliveryTime: true,
            pickupWaitHours: true,
            courierAcceptanceMinutes: true,
          },
        }
      : {
          select: {
            deliveryEnabled: true,
            pickupEnabled: true,
            bookingEnabled: true,
            minOrderAmount: true,
            deliveryFee: true,
            deliveryTime: true,
            pickupWaitHours: true,
            courierAcceptanceMinutes: true,
          },
        },
    ...(includeDeliveryConfig
      ? {
          deliveryZones: {
            where: { isActive: true, archivedAt: null },
            orderBy: [{ sortOrder: "asc" as const }, { name: "asc" as const }],
          },
        }
      : {}),
    categories: {
      where: { isActive: true },
      orderBy: { sortOrder: "asc" as const },
      select: { id: true, name: true, description: true, imageUrl: true, sortOrder: true, isActive: true },
    },
    items: {
      where: {
        isAvailable: true,
        archivedAt: null,
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        imageUrl: true,
        type: true,
        durationMinutes: true,
        stockMode: true,
        stock: true,
        isAvailable: true,
        isPopular: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ isPopular: "desc" as const }, { sortOrder: "asc" as const }],
      take: limit,
    },
    staff: {
      where: { isActive: true },
      orderBy: { createdAt: "asc" as const },
      select: { id: true, name: true, role: true },
    },
  };
}

async function findCatalogBusiness(slug: string, search: string | undefined, limit: number, includeCurrentFields: boolean, includeDeliveryConfig: boolean) {
  const lookup = normalizeLookup(slug);
  return prisma.business.findFirst({
    where: {
      AND: [
        {
          OR: [
            { id: lookup },
            { slug: lookup },
            { slug: { equals: lookup, mode: "insensitive" } },
          ],
        },
        {
          isActive: true,
          accessStatus: "ACTIVE",
          archivedAt: null,
        },
      ],
    },
    select: {
      ...catalogBusinessBaseSelect,
      ...(includeCurrentFields ? currentBusinessFieldsSelect : {}),
      ...catalogRelations(search, includeDeliveryConfig, limit),
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const finishTiming = createServerTiming("business_catalog", { slug });
  const searchParams = new URL(request.url).searchParams;
  const search = searchParams.get("search")?.trim();
  const requestedLimit = Number(searchParams.get("limit") || 50);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100) : 50;
  let usedSchemaFallback = false;

  try {
    let business;
    try {
      business = await findCatalogBusiness(slug, search, limit, true, true);
    } catch (error) {
      const classification = classifyDatabaseError(error);
      if (classification.type !== "missing_table" && classification.type !== "missing_column") throw error;
      usedSchemaFallback = true;
      warnPrismaSchemaDrift(`Catalog ${slug} retried without optional payment/delivery schema`, error);
      business = await findCatalogBusiness(slug, search, limit, false, false);
    }

    if (!business) {
      const lookup = normalizeLookup(slug);
      const unavailableBusiness = await prisma.business.findFirst({
        where: {
          OR: [
            { id: lookup },
            { slug: lookup },
            { slug: { equals: lookup, mode: "insensitive" } },
          ],
        },
        select: { accessStatus: true, archivedAt: true },
      });
      if (unavailableBusiness?.accessStatus === "ARCHIVED" || unavailableBusiness?.archivedAt) {
        return finishTiming(NextResponse.json(
          { ok: false, code: "BUSINESS_ARCHIVED", error: "Витрина временно недоступна." },
          { status: 410 }
        ));
      }
      return finishTiming(NextResponse.json({ ok: false, code: "BUSINESS_NOT_FOUND", error: "Бизнес не найден." }, { status: 404 }));
    }

    if (business.categories.length === 0) {
      try {
        const defaultCategory = await prisma.category.create({
          data: { businessId: business.id, name: "Основное", isActive: true, sortOrder: 0 },
        });
        business.categories = [defaultCategory];
      } catch (error) {
        console.error("[CATALOG] Default category creation skipped:", error);
      }
    }

    const normalizedBusiness = {
      ...business,
      isOpen: "isOpen" in business ? business.isOpen : true,
      transferPaymentEnabled: "transferPaymentEnabled" in business ? business.transferPaymentEnabled : false,
      transferBankName: "transferBankName" in business ? business.transferBankName : null,
      transferPaymentPhone: "transferPaymentPhone" in business ? business.transferPaymentPhone : null,
      transferRecipientName: "transferRecipientName" in business ? business.transferRecipientName : null,
      transferPaymentCommentRequired: "transferPaymentCommentRequired" in business ? business.transferPaymentCommentRequired : false,
      transferPaymentInstructions: "transferPaymentInstructions" in business ? business.transferPaymentInstructions : null,
    };

    return finishTiming(NextResponse.json({
      ok: true,
      business: normalizedBusiness,
      categories: business.categories,
      items: business.items,
      staff: business.staff,
      schemaFallback: usedSchemaFallback,
    }));
  } catch (error) {
    const classification = classifyDatabaseError(error);
    warnPrismaSchemaDrift(`Catalog ${slug} failed`, error);
    return finishTiming(NextResponse.json(
      {
        ok: false,
        code: classification.code,
        error: "Каталог временно недоступен из-за ошибки базы данных. Повторите попытку после проверки подключения и применения SQL-патча.",
      },
      { status: 503 }
    ));
  }
}
