import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { telegramBot } from "@/lib/telegram-bot-service";
import { AI_MANAGER_HANDOFF_MESSAGE, AIService, resolveAIProviderName } from "@/lib/ai/ai-service";
import { getPolzaChatEndpoint } from "@/lib/ai/polza-provider";
import { ensureTelegramUser, trySyncUserPhone } from "@/lib/auth/telegram-user-service";
import { ensureCustomerForTelegramUser } from "@/lib/customer/customer-service";
import { getMiniAppUrl } from "@/lib/production-url";
import { buildMiniAppUrl, getStoreSlugFromStartParam } from "@/lib/business-share-links";
import { looksLikeSellerLinkAttempt, parseSellerLinkText } from "@/lib/seller-link";
import { normalizeRuPhone } from "@/lib/phone/phone-utils";
import { getTelegramWebhookSecret } from "@/lib/telegram-webhook-config";
import { routeCustomerIntent } from "@/lib/ai/customer-intent-router";
import { isPrismaMissingColumnError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";

type TelegramBusinessContext = {
  id: string;
  slug: string;
  name: string;
  type: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  isOpen: boolean;
  isDemo: boolean;
  aiProvider: string | null;
  aiModel: string | null;
  settings?: {
    deliveryEnabled: boolean;
    pickupEnabled: boolean;
    bookingEnabled: boolean;
  } | null;
  workingHours?: Array<{
    dayOfWeek: number;
    openTime: string;
    closeTime: string;
    isClosed: boolean;
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
  isDemo: true,
  aiProvider: true,
  aiModel: true,
  settings: {
    select: {
      deliveryEnabled: true,
      pickupEnabled: true,
      bookingEnabled: true,
    },
  },
  workingHours: {
    select: {
      dayOfWeek: true,
      openTime: true,
      closeTime: true,
      isClosed: true,
    },
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
    const production = process.env.NODE_ENV === "production";
    console.warn("[TELEGRAM_WEBHOOK_SECRET_MISSING]", {
      reason: production
        ? "TELEGRAM_WEBHOOK_SECRET is not set; rejecting production webhook."
        : "TELEGRAM_WEBHOOK_SECRET is not set; development webhook accepted.",
    });
    return { ok: !production, status: production ? 503 : 200 };
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
  return withTelegramWebAppCacheBust(`${getMiniAppUrl()}?mode=seller`);
}

function safeMiniAppUrl(path = "/app") {
  try {
    return getMiniAppUrl(path);
  } catch (error) {
    console.error("[URL CONFIG] Telegram Mini App URL unavailable:", error);
    return null;
  }
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

type CustomerCatalogItem = {
  id: string;
  name: string;
  price: number;
  stock: number | null;
};

async function loadCustomerCatalog(businessId: string): Promise<CustomerCatalogItem[]> {
  try {
    return await prisma.item.findMany({
      where: { businessId, isAvailable: true, archivedAt: null },
      select: { id: true, name: true, price: true, stock: true },
      orderBy: [{ isPopular: "desc" }, { sortOrder: "asc" }],
      take: 100,
    });
  } catch (error) {
    if (!isPrismaMissingColumnError(error, "Item", "archivedAt")) throw error;
    warnPrismaSchemaDrift("Telegram AI catalog retried without Item.archivedAt", error);
    return prisma.item.findMany({
      where: { businessId, isAvailable: true },
      select: { id: true, name: true, price: true, stock: true },
      orderBy: [{ isPopular: "desc" }, { sortOrder: "asc" }],
      take: 100,
    });
  }
}

async function loadActiveBusiness(value: string | null | undefined): Promise<TelegramBusinessContext | null> {
  if (!value || value === "global") return null;
  const lookup = value.trim();
  if (!lookup) return null;

  try {
    return await prisma.business.findFirst({
      where: {
        isActive: true,
        accessStatus: "ACTIVE",
        archivedAt: null,
        OR: [
          { id: lookup },
          { slug: lookup },
          { slug: { equals: lookup, mode: "insensitive" } },
        ],
      },
      select: telegramBusinessContextSelect,
    });
  } catch (error) {
    if (!isPrismaMissingColumnError(error)) throw error;
    warnPrismaSchemaDrift("Telegram business context retried with legacy lifecycle fields", error);
    return prisma.business.findFirst({
      where: {
        isActive: true,
        OR: [
          { id: lookup },
          { slug: lookup },
          { slug: { equals: lookup, mode: "insensitive" } },
        ],
      },
      select: telegramBusinessContextSelect,
    });
  }
}

async function rememberTelegramBusinessContext(userTelegramId: string | number, businessId: string) {
  try {
    await prisma.user.update({
      where: { telegramId: BigInt(userTelegramId) },
      data: { lastBusinessId: businessId },
      select: { id: true },
    });
  } catch (error) {
    if (!isPrismaMissingColumnError(error, "User", "lastBusinessId")) {
      console.warn("[TELEGRAM BUSINESS CONTEXT] Could not persist last business:", error);
      return;
    }
    warnPrismaSchemaDrift("Telegram business context was not persisted because User.lastBusinessId is missing", error);
  }
}

async function resolveTelegramBusinessContext(
  explicitBusinessValue: string | null,
  userTelegramId: string | number
): Promise<TelegramBusinessContext | null> {
  const explicitBusiness = await loadActiveBusiness(explicitBusinessValue);
  if (explicitBusiness) return explicitBusiness;

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(userTelegramId) },
      select: { lastBusinessId: true },
    });
    const lastBusiness = await loadActiveBusiness(user?.lastBusinessId);
    if (lastBusiness) return lastBusiness;
  } catch (error) {
    if (!isPrismaMissingColumnError(error, "User", "lastBusinessId")) throw error;
    warnPrismaSchemaDrift("Telegram business context fell back to Customer.updatedAt", error);
  }

  try {
    const recentCustomer = await prisma.customer.findFirst({
      where: {
        telegramUserId: BigInt(userTelegramId),
        business: {
          is: {
            isActive: true,
            accessStatus: "ACTIVE",
            archivedAt: null,
            isDemo: false,
          },
        },
      },
      select: {
        business: { select: telegramBusinessContextSelect },
      },
      orderBy: { updatedAt: "desc" },
    });
    return recentCustomer?.business || null;
  } catch (error) {
    if (!isPrismaMissingColumnError(error)) throw error;
    warnPrismaSchemaDrift("Telegram business context could not use lifecycle/demo filters", error);
    const recentCustomer = await prisma.customer.findFirst({
      where: {
        telegramUserId: BigInt(userTelegramId),
        business: { is: { isActive: true } },
      },
      select: {
        business: { select: telegramBusinessContextSelect },
      },
      orderBy: { updatedAt: "desc" },
    });
    return recentCustomer?.business?.slug.startsWith("demo-") ? null : recentCustomer?.business || null;
  }
}

async function recordCustomerIntent(input: {
  businessId: string;
  userId?: string | null;
  userTelegramId: string;
  businessSlug: string;
  intent: string;
  query: string;
  foundProducts: CustomerCatalogItem[];
  confidence: number;
  provider: string;
  model: string;
}) {
  const result = {
    businessSlug: input.businessSlug,
    businessId: input.businessId,
    userTelegramId: input.userTelegramId,
    intent: input.intent,
    query: input.query,
    foundItemsCount: input.foundProducts.length,
    foundProducts: input.foundProducts.map((item) => item.name),
    confidence: input.confidence,
  };
  console.info("[CUSTOMER_AI_INTENT]", result);
  try {
    await prisma.aiRequestLog.create({
      data: {
        businessId: input.businessId,
        userId: input.userId || null,
        type: "CUSTOMER_CHAT_INTENT",
        prompt: input.query,
        result: JSON.stringify(result),
        provider: input.provider,
        model: input.model || null,
        status: "ROUTED",
      },
    });
  } catch (error) {
    console.warn("[CUSTOMER_AI_INTENT_LOG_FAILED]", error);
  }
}

function orderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    NEW: "создан и ждёт подтверждения",
    ACCEPTED: "принят продавцом",
    PREPARING: "готовится",
    READY: "готов",
    READY_FOR_PICKUP: "готов к самовывозу",
    READY_FOR_DELIVERY: "готов к передаче курьеру",
    COURIER_ASSIGNED: "курьер назначен",
    PICKED_UP: "курьер забрал заказ",
    DELIVERING: "доставляется",
    DELIVERED: "доставлен",
    COMPLETED: "завершён",
    CANCELLED: "отменён",
    EXPIRED: "истёк",
  };
  return labels[status] || status.toLowerCase();
}

function businessHoursAnswer(business: TelegramBusinessContext, query: string) {
  const normalized = query.toLowerCase();
  if (normalized.includes("адрес") || normalized.includes("куда") || normalized.includes("где") || normalized.includes("найти")) {
    return business.address
      ? `Адрес ${business.name}: ${business.address}.`
      : `У ${business.name} адрес пока не указан. Уточните его у заведения по телефону${business.phone ? ` ${business.phone}` : ""}.`;
  }

  const today = new Date().getDay();
  const hours = business.workingHours?.find((entry) => entry.dayOfWeek === today);
  const state = business.isOpen ? "сейчас открыто" : "сейчас закрыто";
  if (!hours) return `${business.name} ${state}. Точный график в витрине пока не указан.`;
  if (hours.isClosed) return `${business.name} сегодня закрыто.`;
  return `${business.name} ${state}. Сегодня: ${hours.openTime}–${hours.closeTime}.`;
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
      business = await loadActiveBusiness(queryBusinessId);
    }

    if (command === "/start") {
      const payload = text.split(" ")[1]?.trim();
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
      } else if (payload === "demo-cafe" || payload === "cafe") {
        targetUrl = `${miniAppUrl}/demo-cafe`;

        buttonText = "Открыть Demo Cafe";
        message = "Добро пожаловать в <b>Demo Cafe</b>! ✨\n\nНажмите на кнопку ниже, чтобы открыть наше Mini App приложение, посмотреть каталог товаров/услуг и оформить заказ.";
      } else if (payload) {
        // Deep link payload: check if link code
        if (payload.startsWith("link-") || payload.startsWith("link_") || payload.length === 6) {
          const cleanCode = payload.replace("link-", "").replace("link_", "").toUpperCase();
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
          const storeSlug = getStoreSlugFromStartParam(payload) || payload;
          const targetBusiness = await loadActiveBusiness(storeSlug);
          if (targetBusiness) {
            business = targetBusiness;
            targetUrl = buildMiniAppUrl(targetBusiness.slug) || `${miniAppUrl}/${targetBusiness.slug}`;
            buttonText = `Открыть ${targetBusiness.name}`;
            message = `Добро пожаловать в <b>${targetBusiness.name}</b>! ✨\n\nНажмите на кнопку ниже, чтобы открыть наше Mini App приложение, посмотреть каталог товаров/услуг и оформить заказ.`;
          } else {
            targetUrl = miniAppUrl;

            buttonText = "Открыть Mini App";
            message = "Добро пожаловать! Откройте заведение в Mini App.";
          }
        }
      } else if (business) {
        targetUrl = buildMiniAppUrl(business.slug) || `${miniAppUrl}/${business.slug}`;

        buttonText = `Открыть ${business.name}`;
        message = `Добро пожаловать в <b>${business.name}</b>! ✨\n\nНажмите на кнопку ниже, чтобы открыть наше Mini App приложение, посмотреть каталог товаров/услуг и оформить заказ.`;
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
          await rememberTelegramBusinessContext(from.id, business.id);
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

      const miniAppUrl = getMiniAppUrl();


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
          inline_keyboard: [[{ text: "Открыть Vitrina AI", web_app: { url: withTelegramWebAppCacheBust(getMiniAppUrl()) } }]],
        },
      });
      logTelegramResponseSent({ chatId, type: "unknown_command", command });
      return NextResponse.json({ ok: true });
    }

    // 2. FAQ logic - resolve business strictly by explicit route, start/open context, then last selected business.
    const activeBusiness = business || await resolveTelegramBusinessContext(queryBusinessId, from.id);
    const customer = activeBusiness
      ? await prisma.customer.findFirst({
          where: {
            telegramUserId: BigInt(from.id),
            businessId: activeBusiness.id,
          },
          orderBy: { updatedAt: "desc" },
        })
      : null;
    const activeBusinessProvider = resolveAIProviderName(activeBusiness?.aiProvider);
    const activeBusinessModel = activeBusinessProvider === "polza"
      ? process.env.POLZA_TEXT_MODEL || activeBusiness?.aiModel || "z-ai/glm-4.7-flash"
      : activeBusiness?.aiModel || "";

    if (activeBusiness) {
      const catalogItems = await loadCustomerCatalog(activeBusiness.id);
      const storeUrl = buildMiniAppUrl(activeBusiness.slug) || getMiniAppUrl(`/app/${activeBusiness.slug}`);
      const intent = routeCustomerIntent(text);
      const normalizedQuery = intent.query.toLowerCase();
      const matches = intent.intent === "product_search"
        ? catalogItems.filter((item) => {
            const itemName = item.name.toLowerCase();
            return itemName.includes(normalizedQuery) || normalizedQuery.includes(itemName);
          }).slice(0, 5)
        : [];
      const knowledgeBase = [
        `Название: ${activeBusiness.name}.`,
        `Описание: ${activeBusiness.description || "нет"}.`,
        `Телефон: ${activeBusiness.phone || "нет"}.`,
        `Адрес: ${activeBusiness.address || "нет"}.`,
        `Текущий каталог: ${catalogItems.map((item) => `${item.name} — ${item.price} ₽`).join("; ") || "товаров нет"}.`,
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

      await recordCustomerIntent({
        businessId: activeBusiness.id,
        userId: customer?.userId,
        userTelegramId: String(from.id),
        businessSlug: activeBusiness.slug,
        intent: intent.intent,
        query: intent.query,
        foundProducts: matches,
        confidence: intent.confidence,
        provider: activeBusinessProvider,
        model: activeBusinessModel,
      });

      if (intent.intent === "business_hours") {
        await telegramBot.sendNotification(chatId, businessHoursAnswer(activeBusiness, intent.query));
        logTelegramResponseSent({ chatId, type: "business_hours", businessId: activeBusiness.id });
        return NextResponse.json({ ok: true });
      }

      if (intent.intent === "product_search") {
        if (matches.length > 0) {
          const firstAvailable = matches.find((item) => item.stock === null || item.stock > 0);
          const productUrl = new URL(storeUrl);
          if (firstAvailable) productUrl.searchParams.set("product", firstAvailable.id);
          const description = matches
            .map((item) => `${item.name} — ${item.price} ₽${item.stock === 0 ? " (нет в наличии)" : ""}`)
            .join(", ");
          await telegramBot.sendNotification(
            chatId,
            `${description}.`,
            {
              reply_markup: {
                inline_keyboard: [[{
                  text: firstAvailable ? "Открыть товар" : `Открыть ${activeBusiness.name}`,
                  web_app: { url: productUrl.toString() },
                }]],
              },
            }
          );
          logTelegramResponseSent({ chatId, type: "catalog_match", businessId: activeBusiness.id });
        } else {
          await telegramBot.sendNotification(chatId, `В каталоге ${activeBusiness.name} этого товара сейчас нет.`);
          logTelegramResponseSent({ chatId, type: "catalog_no_match", businessId: activeBusiness.id });
        }
        return NextResponse.json({ ok: true });
      }

      if (intent.intent === "order_status") {
        const latestOrder = customer
          ? await prisma.order.findFirst({
              where: { businessId: activeBusiness.id, customerId: customer.id },
              select: { id: true, status: true },
              orderBy: { createdAt: "desc" },
            })
          : null;
        await telegramBot.sendNotification(
          chatId,
          latestOrder
            ? `Последний заказ ${latestOrder.id.slice(-6)}: ${orderStatusLabel(latestOrder.status)}.`
            : `В ${activeBusiness.name} у вас пока нет заказов.`
        );
        logTelegramResponseSent({ chatId, type: "order_status", businessId: activeBusiness.id });
        return NextResponse.json({ ok: true });
      }

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

      await telegramBot.sendNotification(chatId, answer);
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
      const intent = routeCustomerIntent(text);
      console.info("[CUSTOMER_AI_INTENT]", {
        businessSlug: null,
        businessId: null,
        userTelegramId: String(from.id),
        intent: intent.intent,
        query: intent.query,
        foundItemsCount: 0,
      });
      await telegramBot.sendNotification(chatId, "По какому заведению вы спрашиваете? Откройте нужную витрину или выберите бизнес.");
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
