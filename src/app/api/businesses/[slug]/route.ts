import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, jsonError } from "@/lib/admin-auth";
import { classifyDatabaseError, isBusinessIsDemoMissingColumnError, isPrismaMissingColumnError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";

const businessDetailLegacySelect = {
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
  categories: { where: { isActive: true } },
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

const businessDetailSelect = {
  ...businessDetailLegacySelect,
  ...currentBusinessFieldsSelect,
  settings: true,
  deliveryZones: {
    where: { isActive: true, archivedAt: null },
    orderBy: { sortOrder: "asc" },
  },
} as const;

function normalizeLookup(value: string) {
  try {
    return decodeURIComponent(value).trim().replace(/^\/+|\/+$/g, "");
  } catch {
    return value.trim().replace(/^\/+|\/+$/g, "");
  }
}

function businessLookupWhere(value: string) {
  const lookup = normalizeLookup(value);
  return {
    OR: [
      { id: lookup },
      { slug: lookup },
      { slug: { equals: lookup, mode: "insensitive" as const } },
    ],
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    let schemaFallback = false;
    let business;

    try {
      business = await prisma.business.findFirst({
        where: {
          AND: [
            businessLookupWhere(slug),
            { isActive: true, accessStatus: "ACTIVE", archivedAt: null },
          ],
        },
        select: businessDetailSelect,
      });
    } catch (error) {
      const classification = classifyDatabaseError(error);
      if (classification.type !== "missing_table" && classification.type !== "missing_column") throw error;
      schemaFallback = true;
      warnPrismaSchemaDrift(`Business detail ${slug} retried without optional payment/delivery schema`, error);
      business = await prisma.business.findFirst({
        where: {
          AND: [
            businessLookupWhere(slug),
            { isActive: true, accessStatus: "ACTIVE", archivedAt: null },
          ],
        },
        select: businessDetailLegacySelect,
      });
    }

    if (!business) {
      const unavailableBusiness = await prisma.business.findFirst({
        where: businessLookupWhere(slug),
        select: { accessStatus: true, archivedAt: true },
      });
      if (unavailableBusiness?.accessStatus === "ARCHIVED" || unavailableBusiness?.archivedAt) {
        return NextResponse.json(
          { ok: false, code: "BUSINESS_ARCHIVED", error: "Витрина временно недоступна." },
          { status: 410 }
        );
      }
      return NextResponse.json({ ok: false, code: "BUSINESS_NOT_FOUND", error: "Бизнес не найден." }, { status: 404 });
    }

    return NextResponse.json({
      ...business,
      isOpen: "isOpen" in business ? business.isOpen : true,
      transferPaymentEnabled: "transferPaymentEnabled" in business ? business.transferPaymentEnabled : false,
      transferBankName: "transferBankName" in business ? business.transferBankName : null,
      transferPaymentPhone: "transferPaymentPhone" in business ? business.transferPaymentPhone : null,
      transferRecipientName: "transferRecipientName" in business ? business.transferRecipientName : null,
      transferPaymentCommentRequired: "transferPaymentCommentRequired" in business ? business.transferPaymentCommentRequired : false,
      transferPaymentInstructions: "transferPaymentInstructions" in business ? business.transferPaymentInstructions : null,
      schemaFallback,
    });
  } catch (error) {
    const classification = classifyDatabaseError(error);
    warnPrismaSchemaDrift("Business detail failed", error);
    return NextResponse.json(
      { ok: false, code: classification.code, error: "Не удалось загрузить бизнес из базы данных." },
      { status: 503 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);
    if (session.role !== "SUPER_ADMIN") return jsonError("Недостаточно прав.", 403);

    const { slug } = await context.params;
    const body = await request.json();
    const business = await prisma.business.findFirst({
      where: businessLookupWhere(slug),
      select: { id: true },
    });

    if (!business) return jsonError("Бизнес не найден.", 404);

    const updated = await prisma.business.update({
      where: { id: business.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.primaryColor !== undefined ? { primaryColor: body.primaryColor } : {}),
        ...(body.accentColor !== undefined ? { accentColor: body.accentColor } : {}),
        ...(body.subscriptionStatus !== undefined ? { subscriptionStatus: body.subscriptionStatus } : {}),
        ...(body.subscriptionPlanId !== undefined ? { subscriptionPlanId: body.subscriptionPlanId } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        ...(body.isOpen !== undefined ? { isOpen: Boolean(body.isOpen) } : {}),
        ...(body.isDemo !== undefined ? { isDemo: Boolean(body.isDemo) } : {}),
        ...(body.transferPaymentEnabled !== undefined ? { transferPaymentEnabled: Boolean(body.transferPaymentEnabled) } : {}),
        ...(body.transferBankName !== undefined ? { transferBankName: body.transferBankName || null } : {}),
        ...(body.transferPaymentPhone !== undefined ? { transferPaymentPhone: body.transferPaymentPhone || null } : {}),
        ...(body.transferRecipientName !== undefined ? { transferRecipientName: body.transferRecipientName || null } : {}),
        ...(body.transferPaymentCommentRequired !== undefined ? { transferPaymentCommentRequired: Boolean(body.transferPaymentCommentRequired) } : {}),
        ...(body.transferPaymentInstructions !== undefined ? { transferPaymentInstructions: body.transferPaymentInstructions || null } : {}),
        ...(body.ownerId !== undefined ? { ownerId: body.ownerId || null } : {}),
      },
      select: {
        ...businessDetailSelect,
        _count: { select: { orders: true, customers: true, items: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      data: updated,
    });
  } catch (error) {
    console.error("PATCH /api/businesses/[slug] failed:", error);
    if (isBusinessIsDemoMissingColumnError(error) || isPrismaMissingColumnError(error)) {
      warnPrismaSchemaDrift("Business detail update failed because production schema is behind", error);
    }
    return jsonError("Не удалось обновить бизнес.", 500);
  }
}
