import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { telegramBot } from "@/lib/telegram-bot-service";
import { AI_MANAGER_HANDOFF_MESSAGE, AIService, resolveAIProviderName } from "@/lib/ai/ai-service";
import { getPolzaChatEndpoint } from "@/lib/ai/polza-provider";
import { ensureTelegramUser, trySyncUserPhone } from "@/lib/auth/telegram-user-service";
import { ensureCustomerForTelegramUser } from "@/lib/customer/customer-service";
import {
  buildBusinessUrl,
  buildMiniAppUrl,
  buildProductUrl,
} from "@/lib/production-url";
import { looksLikeSellerLinkAttempt, parseSellerLinkText } from "@/lib/seller-link";
import { normalizeRuPhone } from "@/lib/phone/phone-utils";
import { getTelegramWebhookSecret } from "@/lib/telegram-webhook-config";
import { canBusinessOperate } from "@/lib/subscriptions/business-subscription-service";

type TelegramBusinessContext = {
  id: string;
  slug: string;
  name: string;
  type: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  isOpen: boolean;
  transferPaymentEnabled: boolean;
  transferBankName: string | null;
  transferPaymentInstructions: string | null;
  aiProvider: string | null;
  aiModel: string | null;
  workingHours: Array<{
    dayOfWeek: number;
    openTime: string;
    closeTime: string;
    isClosed: boolean;
  }>;
  settings?: {
    deliveryEnabled: boolean;
    pickupEnabled: boolean;
    minOrderAmount: number;
    deliveryFee: number;
    deliveryTime: number | null;
  } | null;
  deliveryZones: Array<{
    name: string;
    cityArea: string;
    fee: number;
    estimatedMinutes: number | null;
  }>;
  telegramAdminChatId?: bigint | null;
  owner?: { telegramId: bigint | null } | null;
};

const telegramBusinessContextSelect = {
  id: true,
  slug: true,
  name: true,
  type: true,
  description: true,
  phone: true,
  address: true,
  isOpen: true,
  transferPaymentEnabled: true,
  transferBankName: true,
  transferPaymentInstructions: true,
  aiProvider: true,
  aiModel: true,
  workingHours: {
    select: {
      dayOfWeek: true,
      openTime: true,
      closeTime: true,
      isClosed: true,
    },
    orderBy: { dayOfWeek: "asc" as const },
  },
  settings: {
    select: {
      deliveryEnabled: true,
      pickupEnabled: true,
      minOrderAmount: true,
      deliveryFee: true,
      deliveryTime: true,
    },
  },
  deliveryZones: {
    where: { isActive: true },
    select: {
      name: true,
      cityArea: true,
      fee: true,
      estimatedMinutes: true,
    },
    orderBy: { name: "asc" as const },
  },
  telegramAdminChatId: true,
  owner: { select: { telegramId: true } },
} as const;

function telegramWebhookAuth(request: NextRequest) {
  let expected = "";
  try {
    expected = getTelegramWebhookSecret();
  } catch (error) {
    console.error("[TELEGRAM WEBHOOK] Invalid webhook secret configuration:", error);
    return { ok: false, status: 503 };
  }
  if (!expected) {
    console.warn("[TELEGRAM_WEBHOOK_SECRET_MISSING]", {
      reason: "TELEGRAM_WEBHOOK_SECRET is not set; accepting Telegram webhook without secret token check.",
    });
    return { ok: true, status: 200 };
  }

  const received = request.headers.get("x-telegram-bot-api-secret-token") || "";
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  const ok = expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  if (!ok) {
    console.warn("[TELEGRAM_WEBHOOK_SECRET_MISMATCH]", {
      hasReceivedSecret: Boolean(received),
    });
    return { ok: false, status: 401 };
  }

  console.info("[TELEGRAM_WEBHOOK_SECRET_OK]");
  return { ok: true, status: 200 };
}

function withTelegramWebAppCacheBust(url: string) {
  const parsed = new URL(url);
  parsed.searchParams.set("v", Date.now().toString());
  return parsed.toString();
}

type TelegramMessageFrom = {
  id: number | string;
  username?: string;
  first_name?: string;
  last_name?: string;
};

function sellerPanelUrl() {
  return withTelegramWebAppCacheBust(buildMiniAppUrl("/app?mode=seller"));
}

function safeMiniAppUrl(path = "/app") {
  try {
    return buildMiniAppUrl(path);
  } catch (error) {
    console.error("[URL CONFIG] Telegram Mini App URL unavailable:", error);
    return null;
  }
}

const WEEKDAY_NAMES = [
  "воскресенье",
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
];

function formatWorkingHours(business: TelegramBusinessContext) {
  if (business.workingHours.length === 0) return "не указан";
  return business.workingHours
    .map((entry) => {
      const day = WEEKDAY_NAMES[entry.dayOfWeek] || `день ${entry.dayOfWeek}`;
      return entry.isClosed
        ? `${day}: выходной`
        : `${day}: ${entry.openTime}-${entry.closeTime}`;
    })
    .join(", ");
}

function formatDelivery(business: TelegramBusinessContext) {
  if (!business.settings?.deliveryEnabled) return "доставка отключена";
  const zones = business.deliveryZones
    .map(
      (zone) =>
        `${zone.name} (${zone.cityArea}), ${zone.fee} ₽${
          zone.estimatedMinutes ? `, около ${zone.estimatedMinutes} мин.` : ""
        }`
    )
    .join("; ");
  return [
    `доставка включена, базовая стоимость ${business.settings.deliveryFee} ₽`,
    business.settings.deliveryTime
      ? `срок около ${business.settings.deliveryTime} мин.`
      : null,
    zones ? `зоны: ${zones}` : "зоны не указаны",
  ]
    .filter(Boolean)
    .join(", ");
}

function managerChatIdForBusiness(business: TelegramBusinessContext) {
  return (
    business.telegramAdminChatId?.toString() ||
    business.owner?.telegramId?.toString() ||
    process.env.TELEGRAM_ADMIN_CHAT_ID ||
    null
  );
}

function escapeTelegramHtml(message: string) {
  return message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function logTelegramResponseSent(context: Record<string, unknown>) {
  console.info("[TELEGRAM_RESPONSE_SENT]", context);
}

async function notifyManagerAboutAiFailure(
  business: TelegramBusinessContext,
  from: TelegramMessageFrom | null | undefined,
  question: string
) {
  const chatId = managerChatIdForBusiness(business);
  if (!chatId) {
    console.warn("[TELEGRAM_AI_MANAGER_HANDOFF_SKIPPED]", {
      businessId: business.id,
      reason: "manager_chat_id_missing",
    });
    return;
  }

  await telegramBot.sendNotification(
    chatId,
    [
      "<b>AI question requires manager attention</b>",
      `Business: ${escapeTelegramHtml(business.name)}`,
      `Customer: ${escapeTelegramHtml(from?.username ? `@${from.username}` : String(from?.id || "unknown"))}`,
      `Question: ${escapeTelegramHtml(question.slice(0, 1000))}`,
    ].join("\n")
  );
}

function catalogSearchQuery(text: string) {
  const normalized = text.toLowerCase().replace(/[?!.,;:]/g, " ").replace(/\s+/g, " ").trim();
  const markers = ["есть ли у вас ", "у вас есть ", "есть ли ", "есть "];
  const marker = markers.find((candidate) => normalized.includes(candidate));
  if (!marker) return null;
  return normalized.split(marker)[1]?.replace(/\b(в наличии|сейчас|товар)\b/g, "").trim() || null;
}

async function handleSellerLinkCode(text: string, chatId: string | number, from?: TelegramMessageFrom | null) {
  const parsed = parseSellerLinkText(text);
  if (!parsed.attempt) return false;

  if (!from?.id || !parsed.code) {
    await telegramBot.sendNotification(
      chatId,
      "❌ Код не найден или истёк. Попросите Super Admin создать новый код."
    );
    return true;
  }

  const ownerUser = await prisma.user.findFirst({
    where: {
      telegramLinkCode: parsed.code,
      telegramLinkExpiresAt: { gt: new Date() },
    },
    select: { id: true, email: true, username: true },
  });

  if (!ownerUser) {
    await telegramBot.sendNotification(
      chatId,
      "❌ Код не найден или истёк. Попросите Super Admin создать новый код."
    );
    return true;
  }

  const telegramId = BigInt(from.id);

  await prisma.$transaction(async (tx) => {
    const linkedTelegramUser = await tx.user.findUnique({
      where: { telegramId },
      select: { id: true, role: true, businessId: true },
    });

    if (linkedTelegramUser && linkedTelegramUser.id !== ownerUser.id) {
      if (linkedTelegramUser.role !== "CUSTOMER" || linkedTelegramUser.businessId) {
        throw new Error("Telegram account is already linked to another seller/admin user.");
      }

      await tx.user.update({
        where: { id: linkedTelegramUser.id },
        data: { telegramId: null },
        select: { id: true },
      });
    }

    await tx.user.update({
      where: { id: ownerUser.id },
      data: {
        telegramId,
        username: from.username || ownerUser.username,
        telegramLinkCode: null,
        telegramLinkExpiresAt: null,
        isActive: true,
      },
      select: { id: true },
    });
  });

  await telegramBot.sendNotification(
    chatId,
    "✅ Продавец привязан. Теперь откройте панель управления."
  );
  await telegramBot.sendNotification(chatId, "Панель продавца", {
    reply_markup: {
      inline_keyboard: [[{ text: "Панель продавца", web_app: { url: sellerPanelUrl() } }]],
    },
  });

  return true;
}

export async function POST(request: NextRequest) {
  let webhookChatId: string | number | null = null;
  let webhookText = "";

  try {
    const webhookAuthorization = telegramWebhookAuth(request);
    if (!webhookAuthorization.ok) {
      return NextResponse.json({ ok: false, error: "Telegram webhook authentication failed." }, { status: webhookAuthorization.status });
    }

    const { searchParams } = new URL(request.url);
    const queryBusinessId = searchParams.get("businessId");

    const body = await request.json();
    
    if (!body.message || (!body.message.text && !body.message.contact)) {
      console.info("[TELEGRAM_WEBHOOK_RECEIVED]", {
        updateId: body.update_id || null,
        ignored: true,
        reason: "message_text_or_contact_missing",
      });
      return NextResponse.json({ ok: true });
    }

    const chatId = body.message.chat.id;
    const text = body.message.text || "";
    const from = body.message.from;
    webhookChatId = chatId;
    webhookText = text;

    console.info("[TELEGRAM_WEBHOOK_RECEIVED]", {
      updateId: body.update_id || null,
      chatId,
      fromUserId: from?.id || null,
      fromUsername: from?.username || null,
      hasText: Boolean(text),
      hasContact: Boolean(body.message.contact),
      queryBusinessId: queryBusinessId || null,
    });

    // Handle shared contact (Task 3)
    if (body.message.contact) {
      const contact = body.message.contact;
      
      // Security check: only allow verifying own phone
      if (!from?.id || !contact.user_id || String(contact.user_id) !== String(from.id)) {
        await telegramBot.sendNotification(chatId, "❌ Ошибка: вы можете подтвердить только собственный номер телефона.");
        return NextResponse.json({ ok: true });
      }

      const telegramId = String(from.id);
      const phone = normalizeRuPhone(contact.phone_number);
      if (!phone) {
        await telegramBot.sendNotification(chatId, "Поддерживается подтверждение номера РФ в формате +7XXXXXXXXXX.");
        return NextResponse.json({ ok: true });
      }

      // 1. Ensure User exists and is synchronized
      const user = await ensureTelegramUser({
        telegramId,
        username: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
        phone,
        phoneVerified: true,
      });

      // 2. Ensure Customer exists
      const effectiveBusinessId = (queryBusinessId && queryBusinessId !== "global") ? queryBusinessId : null;
      const customer = await ensureCustomerForTelegramUser({
        telegramId,
        username: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
        phone,
        phoneVerified: true,
        businessId: effectiveBusinessId,
      });

      // 3. Mark the Customer as verified in DB
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          phone,
          phoneVerified: true,
          verificationMethod: "telegram_contact",
        },
      });
      await trySyncUserPhone(user.id, phone, {
        verified: true,
        context: "telegram webhook contact user phone sync",
      });

      await telegramBot.sendNotification(chatId, "✅ Номер подтверждён. Теперь можно оформлять заказы и записи.");
      return NextResponse.json({ ok: true });
    }

    const isCommand = text.startsWith("/");
    const command = isCommand ? text.split(" ")[0] : "none";

    console.log("Chat ID:", chatId);
    console.log("Message Text:", text);
    console.log("Command:", command);

    if (await handleSellerLinkCode(text, chatId, from)) {
      return NextResponse.json({ ok: true });
    }

    // 1. Resolve Business
    let business: TelegramBusinessContext | null = null;
    if (queryBusinessId) {
      business = await prisma.business.findUnique({
        where: { id: queryBusinessId },
        select: telegramBusinessContextSelect,
      });
    }

    if (command === "/start") {
      const payload = text.split(" ")[1]?.trim();
      const storePayload = payload?.startsWith("store_")
        ? payload.slice("store_".length)
        : payload;
      const miniAppUrl = safeMiniAppUrl();
      if (!miniAppUrl) {
        await telegramBot.sendNotification(
          chatId,
          "Vitrina AI временно недоступна: ссылка Mini App не настроена. Менеджер уже увидит ошибку в логах."
        );
        return NextResponse.json({ ok: true });
      }
      
      // Determine target URL for the Mini App
      let targetUrl = miniAppUrl;

      let buttonText = "Открыть Vitrina AI";
      let message = "Добро пожаловать в Vitrina AI! 🚀\n\nНажмите на кнопку ниже, чтобы открыть наш Mini App...";

      const superAdminIds = (process.env.TELEGRAM_SUPER_ADMIN_IDS || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      if (payload === "seller") {
        targetUrl = `${miniAppUrl}?mode=seller`;
        buttonText = "Панель продавца";
        message = "Добро пожаловать в Панель управления продавца! 💼\n\nНажмите на кнопку ниже, чтобы открыть ваш кабинет...";
      } else if (payload === "admin" && superAdminIds.includes(from.id.toString())) {
        targetUrl = `${miniAppUrl}?mode=super`;
        buttonText = "SaaS Панель";
        message = "Добро пожаловать в SaaS Панель управления! 👑\n\nНажмите на кнопку ниже, чтобы открыть кабинет...";
      } else if (storePayload === "demo-cafe" || storePayload === "cafe") {
        targetUrl = buildBusinessUrl("demo-cafe");

        buttonText = "Открыть Demo Cafe";
        message = "Добро пожаловать в <b>Demo Cafe</b>! ✨\n\nНажмите на кнопку ниже, чтобы открыть наше Mini App приложение, посмотреть каталог товаров/услуг и оформить заказ.";
      } else if (storePayload) {
        // Deep link payload: check if link code
        if (storePayload.startsWith("link-") || storePayload.startsWith("link_") || storePayload.length === 6) {
          const cleanCode = storePayload.replace("link-", "").replace("link_", "").toUpperCase();
          const ownerUser = await prisma.user.findFirst({
            where: {
              telegramLinkCode: cleanCode,
              telegramLinkExpiresAt: { gt: new Date() },
            },
            select: { id: true, email: true, username: true },
          });
          if (ownerUser) {
            await prisma.user.update({
              where: { id: ownerUser.id },
              data: {
                telegramId: BigInt(from.id),
                username: from.username || ownerUser.username,
                telegramLinkCode: null,
                telegramLinkExpiresAt: null,
              },
              select: { id: true },
            });
            targetUrl = `${miniAppUrl}?mode=seller`;

            buttonText = "💼 Панель продавца";
            message = `✅ <b>Успешно привязано!</b>\n\nВы привязали аккаунт продавца <b>${ownerUser.email}</b>.\nТеперь вы можете управлять вашим бизнесом прямо внутри Telegram Mini App!`;
          }
        } else {
          const targetBusiness = await prisma.business.findFirst({
            where: {
              isActive: true,
              isArchived: false,
              isDeleted: false,
              OR: [
                { slug: storePayload },
                { id: storePayload },
                { slug: { equals: storePayload, mode: "insensitive" } },
              ],
            },
            select: telegramBusinessContextSelect,
          });
          if (targetBusiness) {
            business = targetBusiness;
            const access = await canBusinessOperate(targetBusiness.id);
            if (access.canCreateOrder) {
              targetUrl = buildBusinessUrl(targetBusiness.slug);
              buttonText = `Открыть ${targetBusiness.name}`;
              message = `Добро пожаловать в <b>${targetBusiness.name}</b>! ✨\n\nНажмите на кнопку ниже, чтобы открыть наше Mini App приложение, посмотреть каталог товаров/услуг и оформить заказ.`;
            } else {
              targetUrl = buildBusinessUrl(targetBusiness.slug);
              buttonText = `Каталог ${targetBusiness.name}`;
              message = `Добро пожаловать в <b>${targetBusiness.name}</b>!\n\n⚠️ ${access.reason || "Магазин временно недоступен для заказов."}\n\nВы можете посмотреть каталог, но оформление заказов временно недоступно.`;
            }
          } else {
            targetUrl = miniAppUrl;

            buttonText = "Открыть Mini App";
            message = "Добро пожаловать! Откройте заведение в Mini App.";
          }
        }
      } else if (business) {
        const access = await canBusinessOperate(business.id);
        if (access.canCreateOrder) {
          targetUrl = buildBusinessUrl(business.slug);
          buttonText = `Открыть ${business.name}`;
          message = `Добро пожаловать в <b>${business.name}</b>! ✨\n\nНажмите на кнопку ниже, чтобы открыть наше Mini App приложение, посмотреть каталог товаров/услуг и оформить заказ.`;
        } else {
          targetUrl = buildBusinessUrl(business.slug);
          buttonText = `Каталог ${business.name}`;
          message = `Добро пожаловать в <b>${business.name}</b>!\n\n⚠️ ${access.reason || "Магазин временно недоступен для заказов."}`;
        }
      }

      if (targetUrl === miniAppUrl) {
        buttonText = "Открыть Vitrina AI";
      }

      // Upsert Customer to ensure they exist in relation to this business
      if (business && from) {
        try {
          // Sync User state first to prevent relational mismatch
          const syncedUser = await ensureTelegramUser({
            telegramId: String(from.id),
            username: from.username,
            firstName: from.first_name,
            lastName: from.last_name,
          });

          await prisma.customer.upsert({
            where: {
              businessId_telegramUserId: {
                businessId: business.id,
                telegramUserId: BigInt(from.id),
              },
            },
            update: {
              name: [from.first_name, from.last_name].filter(Boolean).join(" "),
              username: from.username,
              userId: syncedUser.id,
            },
            create: {
              businessId: business.id,
              telegramUserId: BigInt(from.id),
              name: [from.first_name, from.last_name].filter(Boolean).join(" "),
              username: from.username,
              userId: syncedUser.id,
            },
          });
        } catch (err) {
          console.error("Failed to upsert customer on start command:", err);
        }
      }

      await telegramBot.sendNotification(chatId, message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: buttonText, web_app: { url: withTelegramWebAppCacheBust(targetUrl) } }]],
        },
      });

      console.info("[TELEGRAM_START_BUTTON_SENT]", {
        chatId,
        payload: payload || null,
        targetUrl,
      });
      logTelegramResponseSent({ chatId, type: "start", targetUrl });
      return NextResponse.json({ ok: true });
    }

    // 1.5. Link account command: /link CODE
    if (command === "/link" || text.startsWith("/link")) {
      const code = text.replace("/link", "").trim().toUpperCase();
      if (!code) {
        await telegramBot.sendNotification(
          chatId,
          "❌ Пожалуйста, укажите код привязки. Пример: <code>/link ABC123</code>",
          { parse_mode: "HTML" }
        );
        return NextResponse.json({ ok: true });
      }

      const ownerUser = await prisma.user.findFirst({
        where: {
          telegramLinkCode: code,
          telegramLinkExpiresAt: { gt: new Date() },
        },
        select: { id: true, email: true, username: true },
      });

      if (!ownerUser) {
        await telegramBot.sendNotification(
          chatId,
          "❌ Неверный или истекший код привязки. Проверьте правильность ввода."
        );
        return NextResponse.json({ ok: true });
      }

      await prisma.user.update({
        where: { id: ownerUser.id },
        data: {
          telegramId: BigInt(from.id),
          username: from.username || ownerUser.username,
          telegramLinkCode: null,
          telegramLinkExpiresAt: null,
        },
        select: { id: true },
      });

      const miniAppUrl = buildMiniAppUrl();


      await telegramBot.sendNotification(
        chatId,
        `✅ <b>Успешно привязано!</b>\n\nВы привязали аккаунт продавца <b>${ownerUser.email}</b>.\nТеперь вы можете управлять вашим бизнесом прямо внутри Telegram Mini App!`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: "💼 Панель продавца", web_app: { url: withTelegramWebAppCacheBust(`${miniAppUrl}?mode=seller`) } }]],

          },
        }
      );

      return NextResponse.json({ ok: true });
    }

    if (isCommand) {
      await telegramBot.sendNotification(chatId, "Доступные команды: /start и /link CODE. Обычный вопрос отправьте без команды.", {
        reply_markup: {
          inline_keyboard: [[{ text: "Открыть Vitrina AI", web_app: { url: withTelegramWebAppCacheBust(buildMiniAppUrl()) } }]],
        },
      });
      logTelegramResponseSent({ chatId, type: "unknown_command", command });
      return NextResponse.json({ ok: true });
    }

    // 2. FAQ logic - resolve customer or business
    const customer = await prisma.customer.findFirst({
      where: { 
        telegramUserId: BigInt(from.id),
        ...(business ? { businessId: business.id } : {})
      },
      include: {
        business: {
          select: telegramBusinessContextSelect,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const activeBusiness = business || customer?.business;
    const activeBusinessProvider = resolveAIProviderName(activeBusiness?.aiProvider);
    const activeBusinessModel = activeBusinessProvider === "polza"
      ? process.env.POLZA_TEXT_MODEL || activeBusiness?.aiModel || "z-ai/glm-4.7-flash"
      : activeBusiness?.aiModel || "";

    if (activeBusiness) {
      const operationAccess = await canBusinessOperate(activeBusiness.id);
      const storeUrl = buildBusinessUrl(activeBusiness.slug);
      if (!operationAccess.canUseAI) {
        const message = operationAccess.canViewCatalog
          ? "Магазин временно недоступен для заказов."
          : "Бизнес временно недоступен.";
        await telegramBot.sendNotification(chatId, message, {
          reply_markup: operationAccess.canViewCatalog
            ? {
                inline_keyboard: [
                  [
                    {
                      text: `Открыть ${activeBusiness.name}`,
                      web_app: { url: storeUrl },
                    },
                  ],
                ],
              }
            : undefined,
        });
        logTelegramResponseSent({
          chatId,
          type: "business_subscription_blocked",
          businessId: activeBusiness.id,
        });
        return NextResponse.json({ ok: true });
      }

      const catalogItems = await prisma.item.findMany({
        where: {
          businessId: activeBusiness.id,
          isAvailable: true,
          type: { in: ["PRODUCT", "SERVICE"] },
        },
        select: { id: true, name: true, price: true, type: true },
        orderBy: [{ isPopular: "desc" }, { sortOrder: "asc" }],
        take: 100,
      });
      const knowledgeBase = [
        `Название: ${activeBusiness.name}.`,
        `Категория: ${activeBusiness.type}.`,
        `Описание: ${activeBusiness.description || "нет"}.`,
        `Телефон: ${activeBusiness.phone || "нет"}.`,
        `Адрес: ${activeBusiness.address || "нет"}.`,
        `Сейчас бизнес ${activeBusiness.isOpen ? "открыт" : "закрыт"}.`,
        `График: ${formatWorkingHours(activeBusiness)}.`,
        `Самовывоз: ${activeBusiness.settings?.pickupEnabled ? "доступен" : "недоступен"}.`,
        `Доставка: ${formatDelivery(activeBusiness)}.`,
        `Минимальная сумма заказа: ${activeBusiness.settings?.minOrderAmount || 0} ₽.`,
        `Оплата: наличные${
          activeBusiness.transferPaymentEnabled
            ? `, перевод${activeBusiness.transferBankName ? ` через ${activeBusiness.transferBankName}` : ""}`
            : ""
        }.`,
        activeBusiness.transferPaymentInstructions
          ? `Инструкция по переводу: ${activeBusiness.transferPaymentInstructions}.`
          : "",
        `Текущий каталог: ${
          catalogItems
            .map(
              (item) =>
                `${item.type === "SERVICE" ? "услуга" : "товар"} ${item.name} — ${item.price} ₽`
            )
            .join("; ") || "товаров и услуг нет"
        }.`,
        `Mini App: ${storeUrl}.`,
        "Не выдумывай товары. Если товара нет в текущем каталоге, честно скажи, что его нет.",
      ].join(" ");
      
      console.info("[BUSINESS CONTEXT] slug/name/id", {
        slug: activeBusiness.slug,
        name: activeBusiness.name,
        id: activeBusiness.id,
      });
      console.info("[AI CONFIG] provider", {
        provider: activeBusinessProvider,
        model: activeBusinessModel,
        hasPolzaKey: Boolean(process.env.POLZA_AI_API_KEY),
        endpoint: activeBusinessProvider === "polza" ? getPolzaChatEndpoint() : null,
      });

      if (activeBusinessProvider === "polza" && !process.env.POLZA_AI_API_KEY) {
        console.error("[POLZA_AI_ERROR]", {
          businessId: activeBusiness.id,
          model: activeBusinessModel,
          reason: "POLZA_AI_API_KEY missing",
        });
        await notifyManagerAboutAiFailure(activeBusiness, from, text).catch((error) =>
          console.warn("[TELEGRAM_AI_MANAGER_HANDOFF_FAILED]", error)
        );
        await telegramBot.sendNotification(
          chatId,
          AI_MANAGER_HANDOFF_MESSAGE
        );
        logTelegramResponseSent({ chatId, type: "ai_handoff", businessId: activeBusiness.id });
        return NextResponse.json({ ok: true });
      }

      const searchQuery = catalogSearchQuery(text);
      if (searchQuery) {
        const matches = catalogItems.filter((item) => {
          const itemName = item.name.toLowerCase();
          return itemName.includes(searchQuery) || searchQuery.includes(itemName);
        });
        if (matches.length > 0) {
          const matchedItemUrl = buildProductUrl(
            activeBusiness.slug,
            matches[0].id
          );
          await telegramBot.sendNotification(
            chatId,
            `Есть: ${matches.slice(0, 5).map((item) => `${item.name} — ${item.price} ₽`).join(", ")}. Откройте Mini App, чтобы добавить товар в корзину.`,
            { reply_markup: { inline_keyboard: [[{ text: "Открыть товар", web_app: { url: matchedItemUrl } }]] } }
          );
          logTelegramResponseSent({ chatId, type: "catalog_match", businessId: activeBusiness.id });
        } else {
          await telegramBot.sendNotification(
            chatId,
            `В каталоге ${activeBusiness.name} такого товара сейчас нет.`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: `Открыть ${activeBusiness.name}`,
                      web_app: { url: storeUrl },
                    },
                  ],
                ],
              },
            }
          );
          logTelegramResponseSent({ chatId, type: "catalog_no_match", businessId: activeBusiness.id });
        }
        return NextResponse.json({ ok: true });
      }

      await telegramBot.sendNotification(chatId, "⏳ Думаю...");
      console.info("[TELEGRAM_AI_REQUEST]", {
        chatId,
        businessId: activeBusiness.id,
        businessSlug: activeBusiness.slug,
        provider: activeBusinessProvider,
        model: activeBusinessModel,
        questionLength: text.length,
      });
      
      const answer = await AIService.generateFAQAnswer(
        activeBusiness.id,
        activeBusinessProvider,
        activeBusinessModel,
        {
          businessName: activeBusiness.name,
          businessType: activeBusiness.type,
          knowledgeBase,
          customerQuestion: text,
        }
      );

      if (answer === AI_MANAGER_HANDOFF_MESSAGE) {
        await notifyManagerAboutAiFailure(activeBusiness, from, text).catch((error) =>
          console.warn("[TELEGRAM_AI_MANAGER_HANDOFF_FAILED]", error)
        );
      }

      await telegramBot.sendNotification(chatId, answer, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `Открыть ${activeBusiness.name}`,
                web_app: { url: storeUrl },
              },
            ],
          ],
        },
      });
      logTelegramResponseSent({
        chatId,
        type: "ai_answer",
        businessId: activeBusiness.id,
        provider: activeBusinessProvider,
        model: activeBusinessModel,
        handoff: answer === AI_MANAGER_HANDOFF_MESSAGE,
      });
    } else {
      console.error("[BUSINESS CONTEXT] slug/name/id", { slug: null, name: null, id: null });
      await telegramBot.sendNotification(chatId, "Сначала откройте нужный магазин в Mini App. Без выбранного бизнеса я не буду выдумывать товары и ответы.");
      logTelegramResponseSent({ chatId, type: "business_context_missing" });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (looksLikeSellerLinkAttempt(webhookText)) {
      console.error("[SELLER_LINK_ERROR]", error);
      if (webhookChatId) {
        await telegramBot.sendNotification(
          webhookChatId,
          "❌ Ошибка привязки. Админ уже увидит детали в логах Vercel."
        );
      }
      return NextResponse.json({ ok: true });
    }

    console.error("Error details in telegram webhook:", error);
    console.error("[POLZA_AI_ERROR]", {
      chatId: webhookChatId,
      reason: error instanceof Error ? error.message : String(error),
    });
    if (webhookChatId && webhookText && !webhookText.startsWith("/")) {
      await telegramBot.sendNotification(
        webhookChatId,
        AI_MANAGER_HANDOFF_MESSAGE
      );
      logTelegramResponseSent({ chatId: webhookChatId, type: "ai_error_handoff" });
    }
    return NextResponse.json({ ok: true });
  }
}
