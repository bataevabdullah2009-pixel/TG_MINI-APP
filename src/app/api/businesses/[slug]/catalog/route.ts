import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyDatabaseError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";

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
  secondaryColor: true,
  backgroundColor: true,
  accentColor: true,
  phone: true,
  email: true,
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
  ownerId: true,
  createdAt: true,
  updatedAt: true,
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

function catalogRelations(search: string | undefined, includeDeliveryConfig: boolean) {
  return {
    settings: includeDeliveryConfig
      ? true
      : {
          select: {
            deliveryEnabled: true,
            pickupEnabled: true,
            bookingEnabled: true,
            reviewsEnabled: true,
            loyaltyEnabled: true,
            minOrderAmount: true,
            deliveryFee: true,
            deliveryTime: true,
            notificationsEnabled: true,
            reminderTime: true,
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
      include: {
        items: {
          where: {
            isAvailable: true,
            archivedAt: null,
            ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
          },
          orderBy: [{ isPopular: "desc" as const }, { sortOrder: "asc" as const }],
        },
      },
    },
    items: {
      where: {
        isAvailable: true,
        archivedAt: null,
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      },
      include: { category: true },
      orderBy: [{ isPopular: "desc" as const }, { sortOrder: "asc" as const }],
    },
    staff: { where: { isActive: true }, orderBy: { createdAt: "asc" as const } },
  };
}

async function findCatalogBusiness(slug: string, search: string | undefined, includeCurrentFields: boolean, includeDeliveryConfig: boolean) {
  const lookup = normalizeLookup(slug);
  return prisma.business.findFirst({
    where: {
      OR: [
        { id: lookup },
        { slug: lookup },
        { slug: { equals: lookup, mode: "insensitive" } },
      ],
    },
    select: {
      ...catalogBusinessBaseSelect,
      ...(includeCurrentFields ? currentBusinessFieldsSelect : {}),
      ...catalogRelations(search, includeDeliveryConfig),
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const search = new URL(request.url).searchParams.get("search")?.trim();
  let usedSchemaFallback = false;

  try {
    let business;
    try {
      business = await findCatalogBusiness(slug, search, true, true);
    } catch (error) {
      const classification = classifyDatabaseError(error);
      if (classification.type !== "missing_table" && classification.type !== "missing_column") throw error;
      usedSchemaFallback = true;
      warnPrismaSchemaDrift(`Catalog ${slug} retried without optional payment/delivery schema`, error);
      business = await findCatalogBusiness(slug, search, false, false);
    }

    if (!business || !business.isActive) {
      return NextResponse.json({ ok: false, code: "BUSINESS_NOT_FOUND", error: "Бизнес не найден." }, { status: 404 });
    }

    if (business.categories.length === 0) {
      try {
        const defaultCategory = await prisma.category.create({
          data: { businessId: business.id, name: "Основное", isActive: true, sortOrder: 0 },
        });
        business.categories = [{ ...defaultCategory, items: [] }];
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

    return NextResponse.json({
      ok: true,
      business: normalizedBusiness,
      categories: business.categories,
      items: business.items,
      staff: business.staff,
      schemaFallback: usedSchemaFallback,
    });
  } catch (error) {
    const classification = classifyDatabaseError(error);
    warnPrismaSchemaDrift(`Catalog ${slug} failed`, error);
    return NextResponse.json(
      {
        ok: false,
        code: classification.code,
        error: "Каталог временно недоступен из-за ошибки базы данных. Повторите попытку после проверки подключения и применения SQL-патча.",
      },
      { status: 503 }
    );
  }
}
