import bcrypt from "bcryptjs";
import { addDays } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAdminSession,
  jsonError,
  requireRole,
} from "@/lib/admin-auth";
import {
  BUSINESS_TEMPLATES,
  templateKeyFromBusinessType,
  type TemplateKey,
} from "@/lib/business-templates";
import { normalizeBusinessSlug } from "@/lib/business-slug";
import {
  COMMERCIAL_MONTHLY_FEE_RUB,
  COMMERCIAL_PLAN_ID,
  COMMERCIAL_SETUP_FEE_RUB,
  TRIAL_DAYS,
  ensureCommercialPlan,
  subscriptionDaysRemaining,
} from "@/lib/subscriptions/business-subscription-service";
import {
  buildSellerDeepLink,
  generateSellerLinkCode,
} from "@/lib/seller-link";
import { buildBusinessUrl } from "@/lib/production-url";
import { toJsonSafe } from "@/lib/prisma-schema-guard";

type BusinessTypeValue =
  | "CAFE"
  | "BARBERSHOP"
  | "CARWASH"
  | "SHOP"
  | "GROCERY"
  | "HARDWARE_STORE"
  | "COURSES"
  | "CUSTOM";

function resolveTemplateKey(
  type?: string,
  templateKey?: string
): TemplateKey {
  const requested = String(templateKey || "").toLowerCase();
  if (requested && requested in BUSINESS_TEMPLATES) {
    return requested as TemplateKey;
  }

  const normalizedType = String(type || "").toUpperCase();
  if (normalizedType === "CUSTOM" || normalizedType === "COURSES") {
    return "shop";
  }
  return templateKeyFromBusinessType(normalizedType);
}

function resolveBusinessType(
  requestedType: string,
  templateBusinessType: BusinessTypeValue
): BusinessTypeValue {
  if (requestedType === "CUSTOM" || requestedType === "COURSES") {
    return requestedType;
  }
  return templateBusinessType;
}

async function createUniqueSellerLinkCode(tx: any) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateSellerLinkCode();
    const existing = await tx.user.findUnique({
      where: { telegramLinkCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }

  throw new Error("Could not generate unique seller link code.");
}

async function seedTemplateContent(
  tx: any,
  businessId: string,
  templateKey: TemplateKey
) {
  const template = BUSINESS_TEMPLATES[templateKey];
  const categoryIds = new Map<string, string>();

  for (const [index, categoryName] of template.categories.entries()) {
    const category = await tx.category.create({
      data: {
        businessId,
        name: categoryName,
        sortOrder: index + 1,
        isActive: true,
      },
    });
    categoryIds.set(categoryName, category.id);
  }

  await tx.item.createMany({
    data: template.items.map((item, index) => ({
      businessId,
      categoryId: categoryIds.get(item.category),
      type: item.type,
      name: item.name,
      description: item.description,
      price: item.price,
      durationMinutes: item.durationMinutes,
      stock: item.stock,
      isAvailable: true,
      isPopular: item.isPopular || false,
      sortOrder: index + 1,
    })),
  });
}

function parseTelegramId(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  try {
    return BigInt(String(value));
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session || !requireRole(session, ["SUPER_ADMIN"])) {
      return jsonError("Недостаточно прав.", 403);
    }

    const businesses = await prisma.business.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        templateKey: true,
        phone: true,
        isActive: true,
        isOpen: true,
        isBlocked: true,
        blockedReason: true,
        isArchived: true,
        isDeleted: true,
        archivedAt: true,
        deletedAt: true,
        subscriptionStatus: true,
        subscriptionPlanId: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
        gracePeriodUntil: true,
        setupFeeAmount: true,
        monthlyFeeAmount: true,
        lastPaidAt: true,
        nextPaymentAt: true,
        paymentComment: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            telegramId: true,
          },
        },
        subscriptionPlan: {
          select: {
            id: true,
            name: true,
            setupFeeAmount: true,
            monthlyFeeAmount: true,
            billingPeriodMonths: true,
          },
        },
        saasPayments: {
          orderBy: { paidAt: "desc" },
          take: 5,
        },
        _count: {
          select: {
            orders: true,
            bookings: true,
            customers: true,
            items: true,
            saasPayments: true,
          },
        },
      },
      orderBy: [{ isDeleted: "asc" }, { isArchived: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      ok: true,
      data: toJsonSafe(
        businesses.map((business) => ({
          ...business,
          planName:
            business.subscriptionPlan?.name ||
            (business.subscriptionPlanId === COMMERCIAL_PLAN_ID
              ? "Commercial"
              : "Без тарифа"),
          daysRemaining: subscriptionDaysRemaining(
            business.subscriptionEndDate
          ),
          businessUrl: buildBusinessUrl(business.slug),
          setupPaid: business.saasPayments.some(
            (payment) => payment.type === "SETUP"
          ),
        }))
      ),
    });
  } catch (error) {
    console.error("GET /api/admin/super/businesses failed:", error);
    return jsonError("Не удалось загрузить бизнесы.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session || !requireRole(session, ["SUPER_ADMIN"])) {
      return jsonError("Недостаточно прав.", 403);
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const ownerEmail = String(body.ownerEmail || "").trim().toLowerCase();
    const ownerPassword = String(body.ownerPassword || "");
    const ownerName = String(body.ownerName || "").trim() || `${name} владелец`;
    const ownerPhone = String(body.ownerPhone || "").trim() || null;
    const ownerTelegramId = parseTelegramId(body.ownerTelegramId);
    const requestedType = String(body.type || "CUSTOM").toUpperCase();

    if (!name || !ownerEmail || !ownerPassword) {
      return jsonError(
        "Заполните название бизнеса, email и пароль владельца.",
        400
      );
    }
    if (ownerPassword.length < 6) {
      return jsonError(
        "Пароль владельца должен быть не короче 6 символов.",
        400
      );
    }
    if (body.ownerTelegramId && !ownerTelegramId) {
      return jsonError("Telegram ID владельца должен быть числом.", 400);
    }

    const slug = normalizeBusinessSlug(String(body.slug || name));
    if (!slug) {
      return jsonError(
        "Не удалось сформировать slug. Укажите короткую ссылку латиницей.",
        400
      );
    }

    const templateKey = resolveTemplateKey(requestedType, body.templateKey);
    const template = BUSINESS_TEMPLATES[templateKey];
    const businessType = resolveBusinessType(
      requestedType,
      template.businessType
    );
    const subscriptionStatus = "TRIAL";
    const now = new Date();
    const subscriptionEndDate = addDays(now, TRIAL_DAYS);

    const [existingSlug, existingEmail, existingTelegram] = await Promise.all([
      prisma.business.findUnique({ where: { slug }, select: { id: true } }),
      prisma.user.findUnique({
        where: { email: ownerEmail },
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          businessId: true,
          ownedBusinesses: { select: { id: true }, take: 1 },
        },
      }),
      ownerTelegramId
        ? prisma.user.findUnique({
            where: { telegramId: ownerTelegramId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (existingSlug) {
      return jsonError("Такой slug уже занят.", 400);
    }
    if (
      existingEmail?.businessId ||
      (existingEmail?.ownedBusinesses.length || 0) > 0
    ) {
      return jsonError(
        "Этот email уже привязан к другому бизнесу.",
        400
      );
    }
    if (
      existingEmail &&
      (existingEmail.role === "SUPER_ADMIN" ||
        existingEmail.role === "MANAGER")
    ) {
      return jsonError(
        "Этот email используется учётной записью администратора.",
        400
      );
    }
    if (existingTelegram && existingTelegram.id !== existingEmail?.id) {
      return jsonError(
        "Этот Telegram ID уже привязан к другой учётной записи.",
        400
      );
    }

    const hashedPassword = await bcrypt.hash(ownerPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      await ensureCommercialPlan(tx);
      const code = ownerTelegramId
        ? null
        : await createUniqueSellerLinkCode(tx);
      const linkExpiresAt = code
        ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : null;

      const business = await tx.business.create({
        data: {
          slug,
          name,
          type: businessType,
          templateKey,
          description: body.description || template.description,
          primaryColor: body.primaryColor || template.theme.primaryColor,
          accentColor: body.accentColor || template.theme.accentColor,
          backgroundColor:
            body.backgroundColor || template.theme.backgroundColor,
          subscriptionStatus,
          subscriptionPlanId: COMMERCIAL_PLAN_ID,
          subscriptionStartDate: now,
          subscriptionEndDate,
          nextPaymentAt: subscriptionEndDate,
          setupFeeAmount: COMMERCIAL_SETUP_FEE_RUB,
          monthlyFeeAmount: COMMERCIAL_MONTHLY_FEE_RUB,
          isActive: true,
          aiProvider:
            process.env.AI_PROVIDER ||
            (process.env.NODE_ENV === "production" ? "polza" : "mock"),
          aiEnabled: true,
          aiDailyLimit: Number(body.aiDailyLimit) || 30,
          aiMonthlyLimit: (Number(body.aiDailyLimit) || 30) * 30,
          modulesEnabled:
            template.orderMode === "booking"
              ? "booking,staff,profile,calendar"
              : "catalog,cart,delivery,pickup,profile",
          settings: {
            create: {
              deliveryEnabled: template.orderMode !== "booking",
              pickupEnabled: true,
              bookingEnabled: template.orderMode === "booking",
              notificationsEnabled: true,
              deliveryFee:
                template.key === "cafe" || template.key === "grocery"
                  ? 150
                  : 0,
            },
          },
        },
        select: {
          id: true,
          slug: true,
          name: true,
          type: true,
          templateKey: true,
          subscriptionStatus: true,
          subscriptionEndDate: true,
        },
      });

      const owner = existingEmail
        ? await tx.user.update({
            where: { id: existingEmail.id },
            data: {
              password: hashedPassword,
              name: ownerName,
              phone: ownerPhone,
              username:
                existingEmail.username || ownerEmail.split("@")[0],
              role: "BUSINESS_OWNER",
              businessId: business.id,
              ...(ownerTelegramId ? { telegramId: ownerTelegramId } : {}),
              telegramLinkCode: code,
              telegramLinkExpiresAt: linkExpiresAt,
              isActive: true,
            },
            select: {
              id: true,
              email: true,
              telegramLinkCode: true,
              telegramLinkExpiresAt: true,
            },
          })
        : await tx.user.create({
            data: {
              email: ownerEmail,
              password: hashedPassword,
              name: ownerName,
              phone: ownerPhone,
              username: ownerEmail.split("@")[0],
              role: "BUSINESS_OWNER",
              businessId: business.id,
              telegramId: ownerTelegramId,
              telegramLinkCode: code,
              telegramLinkExpiresAt: linkExpiresAt,
              isActive: true,
            },
            select: {
              id: true,
              email: true,
              telegramLinkCode: true,
              telegramLinkExpiresAt: true,
            },
          });

      await tx.business.update({
        where: { id: business.id },
        data: { ownerId: owner.id },
        select: { id: true },
      });
      await seedTemplateContent(tx, business.id, templateKey);

      return { business: { ...business, ownerId: owner.id }, owner };
    });

    return NextResponse.json({
      ok: true,
      success: true,
      business: toJsonSafe(result.business),
      owner: toJsonSafe(result.owner),
      sellerLinkCode: result.owner.telegramLinkCode,
      sellerDeepLink: result.owner.telegramLinkCode
        ? buildSellerDeepLink(result.owner.telegramLinkCode)
        : null,
      miniAppUrl: buildBusinessUrl(result.business.slug),
      tariff: {
        name: "Commercial",
        setupFeeAmount: COMMERCIAL_SETUP_FEE_RUB,
        monthlyFeeAmount: COMMERCIAL_MONTHLY_FEE_RUB,
      },
    });
  } catch (error) {
    console.error("POST /api/admin/super/businesses failed:", error);
    return jsonError(
      "Не удалось создать бизнес. Подробности записаны в server logs.",
      500
    );
  }
}
