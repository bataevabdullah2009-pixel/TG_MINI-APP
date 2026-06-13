import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { telegramBot } from "@/lib/telegram-bot-service";
import { ensureTelegramUser, trySyncUserPhone } from "@/lib/auth/telegram-user-service";
import { ensureCustomerForTelegramUser } from "@/lib/customer/customer-service";
import {
  buildBusinessMiniAppUrl,
  buildMiniAppUrl,
  buildSellerPanelUrl,
} from "@/lib/production-url";
import { looksLikeSellerLinkAttempt, parseSellerLinkText } from "@/lib/seller-link";
import { normalizeRuPhone } from "@/lib/phone/phone-utils";
import { getTelegramWebhookSecret } from "@/lib/telegram-webhook-config";
import {
  getSelectedBusinessContext,
  runTelegramMarketplaceAgent,
  setSelectedBusinessContext,
} from "@/lib/ai/telegram-marketplace-agent";
import { isPrismaMissingColumnError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";

type TelegramBusinessContext = {
  id: string;
  slug: string;
  name: string;
  type: string;
  description: string | null;
  phone: string | null;
  address: string | null;
};

const telegramBusinessContextSelect = {
  id: true,
  slug: true,
  name: true,
  type: true,
  description: true,
  phone: true,
  address: true,
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
  return withTelegramWebAppCacheBust(buildSellerPanelUrl());
}

function safeMiniAppUrl(path = "/app") {
  try {
    return buildMiniAppUrl(path);
  } catch (error) {
    console.error("[URL CONFIG] Telegram Mini App URL unavailable:", error);
    return null;
  }
}

function logTelegramResponseSent(context: Record<string, unknown>) {
  console.info("[TELEGRAM_RESPONSE_SENT]", context);
}

async function loadActiveBusiness(value: string | null | undefined): Promise<TelegramBusinessContext | null> {
  if (!value || value === "global") return null;
  const lookup = value.trim();
  if (!lookup) return null;

  const lookupFilter = {
    OR: [
      { id: lookup },
      { slug: lookup },
      { slug: { equals: lookup, mode: "insensitive" as const } },
    ],
  };

  try {
    return await prisma.business.findFirst({
      where: {
        ...lookupFilter,
        isActive: true,
        accessStatus: "ACTIVE",
        archivedAt: null,
        subscriptionStatus: { notIn: ["BLOCKED", "EXPIRED"] },
      },
      select: telegramBusinessContextSelect,
    });
  } catch (error) {
    if (!isPrismaMissingColumnError(error)) throw error;
    warnPrismaSchemaDrift("Telegram business context retried with legacy lifecycle fields", error);
    return prisma.business.findFirst({
      where: {
        ...lookupFilter,
        isActive: true,
        subscriptionStatus: { notIn: ["BLOCKED", "EXPIRED"] },
      },
      select: telegramBusinessContextSelect,
    });
  }
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
      const effectiveBusiness = await loadActiveBusiness(queryBusinessId);
      const customer = await ensureCustomerForTelegramUser({
        telegramId,
        username: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
        phone,
        phoneVerified: true,
        businessId: effectiveBusiness?.id || null,
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
    if (queryBusinessId && queryBusinessId !== "global") {
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
        targetUrl = buildSellerPanelUrl();
        buttonText = "Панель продавца";
        message = "Добро пожаловать в Панель управления продавца! 💼\n\nНажмите на кнопку ниже, чтобы открыть ваш кабинет...";
      } else if (payload === "admin" && superAdminIds.includes(from.id.toString())) {
        targetUrl = `${miniAppUrl}?mode=super`;
        buttonText = "SaaS Панель";
        message = "Добро пожаловать в SaaS Панель управления! 👑\n\nНажмите на кнопку ниже, чтобы открыть кабинет...";
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
            targetUrl = buildSellerPanelUrl();

            buttonText = "💼 Панель продавца";
            message = `✅ <b>Успешно привязано!</b>\n\nВы привязали аккаунт продавца <b>${ownerUser.email}</b>.\nТеперь вы можете управлять вашим бизнесом прямо внутри Telegram Mini App!`;
          }
        } else {
          const businessPayload = payload.startsWith("store_")
            ? payload.slice("store_".length)
            : payload;
          const targetBusiness = await loadActiveBusiness(businessPayload);
          if (targetBusiness) {
            business = targetBusiness;
            targetUrl = buildBusinessMiniAppUrl(targetBusiness.slug);
            buttonText = `Открыть ${targetBusiness.name}`;
            message = `Добро пожаловать в <b>${targetBusiness.name}</b>! ✨\n\nНажмите на кнопку ниже, чтобы открыть наше Mini App приложение, посмотреть каталог товаров/услуг и оформить заказ.`;
          } else {
            targetUrl = miniAppUrl;

            buttonText = "Открыть Mini App";
            message = "Добро пожаловать! Откройте заведение в Mini App.";
          }
        }
      } else if (business) {
        targetUrl = buildBusinessMiniAppUrl(business.slug);

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
          await setSelectedBusinessContext(String(from.id), business.id);
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

      await telegramBot.sendNotification(
        chatId,
        `✅ <b>Успешно привязано!</b>\n\nВы привязали аккаунт продавца <b>${ownerUser.email}</b>.\nТеперь вы можете управлять вашим бизнесом прямо внутри Telegram Mini App!`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: "💼 Панель продавца", web_app: { url: sellerPanelUrl() } }]],

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

    const storedContext = business
      ? null
      : await getSelectedBusinessContext(String(from.id));
    const activeBusiness = business || await loadActiveBusiness(storedContext?.business?.id);
    const agentResponse = await runTelegramMarketplaceAgent({
      text,
      telegramUserId: String(from.id),
      business: activeBusiness,
    });

    const responseButtons = agentResponse.buttons?.length
      ? agentResponse.buttons.slice(0, 5)
      : agentResponse.button
        ? [agentResponse.button]
        : [];
    const replyMarkup = responseButtons.length
      ? {
          reply_markup: {
            inline_keyboard: responseButtons.map((button) => [{
              text: button.text,
              web_app: { url: withTelegramWebAppCacheBust(button.url) },
            }]),
          },
        }
      : undefined;

    await telegramBot.sendNotification(chatId, agentResponse.text, replyMarkup);
    console.info("[TELEGRAM_AI_AGENT]", {
      telegramUserId: String(from.id),
      text,
      detectedIntent: agentResponse.detectedIntent,
      businessSlug: activeBusiness?.slug || null,
      businessId: activeBusiness?.id || null,
      toolsCalled: agentResponse.toolsCalled,
      responseSource: agentResponse.responseSource,
    });
    logTelegramResponseSent({
      chatId,
      type: "marketplace_agent",
      businessId: activeBusiness?.id || null,
      detectedIntent: agentResponse.detectedIntent,
    });

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
        "Не удалось обработать вопрос. Откройте Vitrina AI или повторите попытку позже."
      );
      logTelegramResponseSent({ chatId: webhookChatId, type: "ai_error_handoff" });
    }
    return NextResponse.json({ ok: true });
  }
}
