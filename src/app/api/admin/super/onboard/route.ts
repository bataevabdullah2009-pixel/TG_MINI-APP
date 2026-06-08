import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { BUSINESS_TEMPLATES, templateKeyFromBusinessType } from "@/lib/business-templates";
import { getAdminSession, jsonError, requireRole } from "@/lib/admin-auth";

const PLAN_IDS: Record<string, string> = {
  START: "plan-start",
  PRO: "plan-pro",
  BUSINESS: "plan-business",
};

const cyrillicMap: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function transliterate(value: string) {
  return value
    .split("")
    .map((char) => cyrillicMap[char.toLowerCase()] ?? char)
    .join("");
}

function normalizeSlug(value: string) {
  return transliterate(value)
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function resolveTemplateKey(type?: string, templateKey?: string) {
  const requested = String(templateKey || "").toLowerCase();
  if (requested && requested in BUSINESS_TEMPLATES) return requested as keyof typeof BUSINESS_TEMPLATES;

  const normalizedType = String(type || "").toUpperCase();
  if (normalizedType === "CUSTOM" || normalizedType === "COURSES") return "shop";
  return templateKeyFromBusinessType(normalizedType);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session || !requireRole(session, ["SUPER_ADMIN"])) {
      return jsonError("Недостаточно прав", 403);
    }

    const body = await request.json();
    const {
      name,
      slug,
      type,
      templateKey,
      ownerEmail,
      ownerPassword,
      telegramUsername,
      telegramAdminChatId,
      subscriptionPlan = "PRO",
      aiEnabled = true,
      aiDailyLimit = "30",
    } = body;

    if (!name || !type || !ownerEmail || !ownerPassword) {
      return NextResponse.json({ error: "Заполните название бизнеса, тип, email и пароль владельца." }, { status: 400 });
    }

    const normalizedSlug = normalizeSlug(String(slug || name));
    if (!normalizedSlug) {
      return NextResponse.json({ error: "Не удалось сформировать slug. Укажите короткую ссылку латиницей." }, { status: 400 });
    }
    const selectedTemplateKey = resolveTemplateKey(type, templateKey);
    const template = BUSINESS_TEMPLATES[selectedTemplateKey as keyof typeof BUSINESS_TEMPLATES];

    if (!template) {
      return NextResponse.json({ error: "Неизвестный шаблон бизнеса." }, { status: 400 });
    }

    const [existingSlug, existingEmail] = await Promise.all([
      prisma.business.findUnique({ where: { slug: normalizedSlug }, select: { id: true } }),
      prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } }),
    ]);

    if (existingSlug) {
      return NextResponse.json({ error: "Такой slug уже занят. Укажите другую короткую ссылку." }, { status: 400 });
    }

    if (existingEmail) {
      return NextResponse.json({ error: "Этот email уже зарегистрирован. Укажите другой email владельца." }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(ownerPassword, 10);
    const planId = PLAN_IDS[String(subscriptionPlan).toUpperCase()] || PLAN_IDS.PRO;
    const adminChatId = telegramAdminChatId ? BigInt(String(telegramAdminChatId)) : undefined;

    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name,
          slug: normalizedSlug,
          type: String(type).toUpperCase() === "CUSTOM" || String(type).toUpperCase() === "COURSES" ? "CUSTOM" : template.businessType,
          templateKey: template.key,
          description: template.description,
          primaryColor: template.theme.primaryColor,
          accentColor: template.theme.accentColor,
          backgroundColor: template.theme.backgroundColor,
          telegramUsername: telegramUsername || undefined,
          telegramAdminChatId: adminChatId,
          subscriptionStatus: "ACTIVE",
          subscriptionPlanId: planId,
          isActive: true,
          aiEnabled: Boolean(aiEnabled),
          aiDailyLimit: parseInt(String(aiDailyLimit || "30"), 10),
          aiMonthlyLimit: parseInt(String(aiDailyLimit || "30"), 10) * 30,
          modulesEnabled:
            template.orderMode === "booking"
              ? "booking,staff,profile,calendar"
              : "catalog,cart,delivery,pickup,profile",
          settings: {
            create: {
              deliveryEnabled: template.orderMode !== "booking",
              pickupEnabled: true,
              bookingEnabled: template.orderMode === "booking",
              minOrderAmount: 0,
              deliveryFee: template.key === "cafe" || template.key === "grocery" ? 150 : 0,
              notificationsEnabled: true,
              reminderTime: 120,
            },
          },
        },
        select: { id: true, slug: true, name: true },
      });

      const linkCode = body.ownerTelegramId 
        ? null 
        : Math.random().toString(36).substring(2, 8).toUpperCase();
      const linkExpires = body.ownerTelegramId 
        ? null 
        : new Date(Date.now() + 24 * 60 * 60 * 1000);

      const owner = await tx.user.create({
        data: {
          email: ownerEmail,
          password: hashedPassword,
          name: `${name} Owner`,
          username: String(ownerEmail).split("@")[0],
          role: "BUSINESS_OWNER",
          businessId: business.id,
          telegramId: body.ownerTelegramId ? BigInt(body.ownerTelegramId) : null,
          telegramLinkCode: linkCode,
          telegramLinkExpiresAt: linkExpires,
          isActive: true,
        },
        select: { id: true, email: true, telegramLinkCode: true },
      });

      await tx.business.update({ where: { id: business.id }, data: { ownerId: owner.id }, select: { id: true } });
      await seedTemplateContent(tx, business.id, template.key);

      return { business: { ...business, ownerId: owner.id }, owner };
    });

    // Safely serialize BigInt/objects
    const safeResult = JSON.parse(
      JSON.stringify(result, (key, value) => (typeof value === "bigint" ? value.toString() : value))
    );

    return NextResponse.json({
      success: true,
      message: "Business, owner and default template content created.",
      business: safeResult.business,
      owner: { 
        id: safeResult.owner.id, 
        email: safeResult.owner.email,
        telegramLinkCode: safeResult.owner.telegramLinkCode 
      },
      miniAppUrl: `/app/${safeResult.business.slug}`,
    });
  } catch (error) {
    console.error("Onboard API error:", error);
    return NextResponse.json({ error: "Не удалось создать бизнес. Подробности записаны в server logs." }, { status: 500 });
  }
}

async function seedTemplateContent(tx: any, businessId: string, templateKey: string) {
  const template = BUSINESS_TEMPLATES[templateKey as keyof typeof BUSINESS_TEMPLATES] || BUSINESS_TEMPLATES.cafe;
  const categoryIds = new Map<string, string>();

  for (const [index, categoryName] of template.categories.entries()) {
    const category = await tx.category.create({
      data: { businessId, name: categoryName, sortOrder: index + 1, isActive: true },
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
