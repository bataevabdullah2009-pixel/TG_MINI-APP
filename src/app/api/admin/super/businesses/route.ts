import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAdminSession, jsonError, requireRole } from "@/lib/admin-auth";
import { BUSINESS_TEMPLATES, templateKeyFromBusinessType, type TemplateKey } from "@/lib/business-templates";
import { buildSellerDeepLink, generateSellerLinkCode } from "@/lib/seller-link";

export { GET } from "@/app/api/businesses/route";

type BusinessTypeValue = "CAFE" | "BARBERSHOP" | "CARWASH" | "SHOP" | "GROCERY" | "HARDWARE_STORE" | "COURSES" | "CUSTOM";

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

function resolveTemplateKey(type?: string, templateKey?: string): TemplateKey {
  const requested = String(templateKey || "").toLowerCase();
  if (requested && requested in BUSINESS_TEMPLATES) return requested as TemplateKey;

  const normalizedType = String(type || "").toUpperCase();
  if (normalizedType === "CUSTOM" || normalizedType === "COURSES") return "shop";
  return templateKeyFromBusinessType(normalizedType);
}

function resolveBusinessType(requestedType: string, templateBusinessType: BusinessTypeValue): BusinessTypeValue {
  if (requestedType === "CUSTOM" || requestedType === "COURSES") return requestedType;
  return templateBusinessType;
}

async function createUniqueSellerLinkCode(tx: any) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateSellerLinkCode();
    const existing = await tx.user.findUnique({ where: { telegramLinkCode: code }, select: { id: true } });
    if (!existing) return code;
  }

  throw new Error("Could not generate unique seller link code.");
}

async function seedTemplateContent(tx: any, businessId: string, templateKey: TemplateKey) {
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
    const requestedType = String(body.type || "CUSTOM").toUpperCase();

    if (!name || !ownerEmail || !ownerPassword) {
      return jsonError("Заполните название бизнеса, email и пароль владельца.", 400);
    }

    if (ownerPassword.length < 6) {
      return jsonError("Пароль владельца должен быть не короче 6 символов.", 400);
    }

    const slug = normalizeSlug(String(body.slug || name));
    if (!slug) {
      return jsonError("Не удалось сформировать slug. Укажите короткую ссылку латиницей.", 400);
    }

    const templateKey = resolveTemplateKey(requestedType, body.templateKey);
    const template = BUSINESS_TEMPLATES[templateKey];
    const businessType = resolveBusinessType(requestedType, template.businessType);

    const [existingSlug, existingEmail] = await Promise.all([
      prisma.business.findUnique({ where: { slug }, select: { id: true } }),
      prisma.user.findUnique({
        where: { email: ownerEmail },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          role: true,
          businessId: true,
          ownedBusinesses: { select: { id: true }, take: 1 },
        },
      }),
    ]);

    if (existingSlug) {
      return jsonError("Такой slug уже занят. Укажите другой slug.", 400);
    }
    if (existingEmail?.businessId || (existingEmail?.ownedBusinesses.length || 0) > 0) {
      return jsonError("Этот email уже привязан к другому бизнесу. Укажите другой email владельца.", 400);
    }
    if (existingEmail && (existingEmail.role === "SUPER_ADMIN" || existingEmail.role === "MANAGER")) {
      return jsonError("Этот email уже используется учетной записью администратора. Укажите другой email владельца.", 400);
    }

    const hashedPassword = await bcrypt.hash(ownerPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      const code = await createUniqueSellerLinkCode(tx);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const business = await tx.business.create({
        data: {
          slug,
          name,
          type: businessType,
          templateKey,
          description: body.description || template.description,
          primaryColor: body.primaryColor || template.theme.primaryColor,
          accentColor: body.accentColor || template.theme.accentColor,
          backgroundColor: body.backgroundColor || template.theme.backgroundColor,
          subscriptionStatus: "ACTIVE",
          isActive: true,
          aiProvider: "mock",
          aiEnabled: true,
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
              deliveryFee: template.key === "cafe" || template.key === "grocery" ? 150 : 0,
            },
          },
        },
        select: { id: true, slug: true, name: true, type: true, templateKey: true },
      });

      const owner = existingEmail
        ? await tx.user.update({
            where: { id: existingEmail.id },
            data: {
              password: hashedPassword,
              name: existingEmail.name || `${name} Owner`,
              username: existingEmail.username || ownerEmail.split("@")[0],
              role: "BUSINESS_OWNER",
              businessId: business.id,
              telegramLinkCode: code,
              telegramLinkExpiresAt: expiresAt,
              isActive: true,
            },
            select: { id: true, email: true, telegramLinkCode: true, telegramLinkExpiresAt: true },
          })
        : await tx.user.create({
            data: {
              email: ownerEmail,
              password: hashedPassword,
              name: `${name} Owner`,
              username: ownerEmail.split("@")[0],
              role: "BUSINESS_OWNER",
              businessId: business.id,
              telegramLinkCode: code,
              telegramLinkExpiresAt: expiresAt,
              isActive: true,
            },
            select: { id: true, email: true, telegramLinkCode: true, telegramLinkExpiresAt: true },
          });

      await tx.business.update({
        where: { id: business.id },
        data: { ownerId: owner.id },
        select: { id: true },
      });

      await seedTemplateContent(tx, business.id, templateKey);

      return { business: { ...business, ownerId: owner.id }, owner };
    });

    const sellerLinkCode = result.owner.telegramLinkCode;

    return NextResponse.json({
      ok: true,
      success: true,
      business: result.business,
      owner: result.owner,
      sellerLinkCode,
      sellerDeepLink: sellerLinkCode ? buildSellerDeepLink(sellerLinkCode) : null,
    });
  } catch (error) {
    console.error("POST /api/admin/super/businesses failed:", error);
    return jsonError("Не удалось создать бизнес. Подробности записаны в server logs.", 500);
  }
}
