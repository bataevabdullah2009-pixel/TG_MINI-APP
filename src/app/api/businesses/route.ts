import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, requireRole, canUseBusiness, jsonError } from "@/lib/admin-auth";
import { classifyDatabaseError, isBusinessIsDemoMissingColumnError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";
import { normalizeBusinessSlug } from "@/lib/business-slug";

const businessListSelect = {
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
  telegramUrl: true,
  whatsappUrl: true,
  instagramUrl: true,
  telegramBotUsername: true,
  telegramUsername: true,
  telegramAdminChatId: true,
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
  isOpen: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  settings: {
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
  _count: {
    select: {
      orders: true,
      customers: true,
      items: true,
    },
  },
} as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const limit = parseInt(searchParams.get("limit") || "20");

    const businesses = await prisma.business.findMany({
      where: {
        isActive: true,
        accessStatus: "ACTIVE",
        archivedAt: null,
        ...(businessId ? { id: businessId } : {}),
      },
      select: businessListSelect,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(
      businesses.map((business) => ({
        ...business,
        telegramAdminChatId: business.telegramAdminChatId?.toString() || null,
      }))
    );
  } catch (error) {
    console.error("Error fetching businesses:", error);
    if (isBusinessIsDemoMissingColumnError(error)) {
      warnPrismaSchemaDrift("Businesses query failed while Business.isDemo is missing", error);
    }
    const classification = classifyDatabaseError(error);
    return NextResponse.json({ code: classification.code, error: "Не удалось загрузить список бизнесов." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session || !requireRole(session, ["SUPER_ADMIN"])) {
      return jsonError("Недостаточно прав", 403);
    }

    const body = await request.json();
    const { slug, name, type, description, primaryColor, accentColor } = body;
    if (!name) {
      return NextResponse.json({ error: "Укажите название бизнеса." }, { status: 400 });
    }

    const normalizedSlug = normalizeBusinessSlug(String(slug || name));
    if (!normalizedSlug) {
      return NextResponse.json({ error: "Не удалось сформировать slug. Укажите короткую ссылку латиницей." }, { status: 400 });
    }

    const existing = await prisma.business.findUnique({ where: { slug: normalizedSlug }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: "Такой slug уже занят." }, { status: 400 });
    }

    const business = await prisma.business.create({
      data: {
        slug: normalizedSlug,
        name,
        type: type || "CUSTOM",
        description,
        primaryColor: primaryColor || "#3B82F6",
        accentColor: accentColor || "#FF6347",
      },
      select: businessListSelect,
    });

    return NextResponse.json(
      { ...business, telegramAdminChatId: business.telegramAdminChatId?.toString() || null },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating business:", error);
    if (isBusinessIsDemoMissingColumnError(error)) {
      warnPrismaSchemaDrift("Business create failed while Business.isDemo is missing", error);
    }
    return NextResponse.json({ error: "Не удалось создать бизнес." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) {
      return jsonError("Нужен вход в админку.", 401);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return jsonError("Не передан ID бизнеса.", 400);
    }

    if (!canUseBusiness(session, id)) {
      return jsonError("Нет доступа к этому бизнесу.", 403);
    }

    const body = await request.json();
    const {
      name,
      description,
      phone,
      email,
      primaryColor,
      accentColor,
      telegramUsername,
      telegramAdminChatId,
      isActive,
      isOpen,
      deliveryFee,
      minOrderAmount,
    } = body;

    const updated = await prisma.business.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(primaryColor !== undefined ? { primaryColor } : {}),
        ...(accentColor !== undefined ? { accentColor } : {}),
        ...(telegramUsername !== undefined ? { telegramUsername } : {}),
        ...(telegramAdminChatId !== undefined ? { telegramAdminChatId } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(isOpen !== undefined ? { isOpen: Boolean(isOpen) } : {}),
        ...(deliveryFee !== undefined || minOrderAmount !== undefined
          ? {
              settings: {
                update: {
                  ...(deliveryFee !== undefined ? { deliveryFee: parseFloat(deliveryFee || "0") } : {}),
                  ...(minOrderAmount !== undefined ? { minOrderAmount: parseFloat(minOrderAmount || "0") } : {}),
                },
              },
            }
          : {}),
      },
      select: businessListSelect,
    });

    return NextResponse.json({ ...updated, telegramAdminChatId: updated.telegramAdminChatId?.toString() || null });
  } catch (error) {
    console.error("PATCH Business error:", error);
    if (isBusinessIsDemoMissingColumnError(error)) {
      warnPrismaSchemaDrift("Business update failed while Business.isDemo is missing", error);
    }
    return NextResponse.json({ error: "Не удалось обновить бизнес." }, { status: 500 });
  }
}
