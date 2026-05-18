import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { telegramBot } from "@/lib/telegram-bot-service";
import { AIService } from "@/lib/ai/ai-service";
import { ensureTelegramUser } from "@/lib/auth/telegram-user-service";
import { ensureCustomerForTelegramUser } from "@/lib/customer/customer-service";

export async function POST(request: NextRequest) {
  console.log("webhook received");
  try {
    const { searchParams } = new URL(request.url);
    const queryBusinessId = searchParams.get("businessId");

    const body = await request.json();
    console.log("Webhook Body:", JSON.stringify(body));

    if (!body.message || (!body.message.text && !body.message.contact)) {
      console.log("No message text or contact in webhook body");
      return NextResponse.json({ ok: true });
    }

    const chatId = body.message.chat.id;
    const text = body.message.text || "";
    const from = body.message.from;

    // Handle shared contact (Task 3)
    if (body.message.contact) {
      const contact = body.message.contact;
      
      // Security check: only allow verifying own phone
      if (contact.user_id && contact.user_id !== from.id) {
        await telegramBot.sendNotification(chatId, "❌ Ошибка: вы можете подтвердить только собственный номер телефона.");
        return NextResponse.json({ ok: true });
      }

      const telegramId = String(from.id);
      const phone = contact.phone_number;

      // 1. Ensure User exists and is synchronized
      const user = await ensureTelegramUser({
        telegramId,
        username: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
      });

      // 2. Ensure Customer exists
      const effectiveBusinessId = (queryBusinessId && queryBusinessId !== "global") ? queryBusinessId : null;
      const customer = await ensureCustomerForTelegramUser({
        telegramId,
        username: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
        phone,
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

      await telegramBot.sendNotification(chatId, "✅ Номер подтверждён. Теперь можно оформлять заказы и записи.");
      return NextResponse.json({ ok: true });
    }

    const isCommand = text.startsWith("/");
    const command = isCommand ? text.split(" ")[0] : "none";

    console.log("Chat ID:", chatId);
    console.log("Message Text:", text);
    console.log("Command:", command);

    // 1. Resolve Business
    let business = null;
    if (queryBusinessId) {
      business = await prisma.business.findUnique({
        where: { id: queryBusinessId }
      });
    }

    if (command === "/start") {
      const payload = text.split(" ")[1]?.trim();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_WEBAPP_URL || "http://localhost:3000";
      
      // Determine target URL for the Mini App
      let targetUrl = `${appUrl}/app`;
      let buttonText = "Открыть SmartBiz";
      let message = "Добро пожаловать в SmartBiz AI! 🚀\n\nНажмите на кнопку ниже, чтобы открыть наш Mini App...";

      const superAdminIds = (process.env.TELEGRAM_SUPER_ADMIN_IDS || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      if (payload === "seller") {
        targetUrl = `${appUrl}/app?mode=seller`;
        buttonText = "Панель продавца";
        message = "Добро пожаловать в Панель управления продавца! 💼\n\nНажмите на кнопку ниже, чтобы открыть ваш кабинет...";
      } else if (payload === "admin" && superAdminIds.includes(from.id.toString())) {
        targetUrl = `${appUrl}/app?mode=super`;
        buttonText = "SaaS Панель";
        message = "Добро пожаловать в SaaS Панель управления! 👑\n\nНажмите на кнопку ниже, чтобы открыть кабинет...";
      } else if (payload === "demo-cafe" || payload === "cafe") {
        targetUrl = `${appUrl}/app/demo-cafe`;
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
            });
            targetUrl = `${appUrl}/app?mode=seller`;
            buttonText = "💼 Панель продавца";
            message = `✅ <b>Успешно привязано!</b>\n\nВы привязали аккаунт продавца <b>${ownerUser.email}</b>.\nТеперь вы можете управлять вашим бизнесом прямо внутри Telegram Mini App!`;
          }
        } else {
          const targetBusiness = await prisma.business.findFirst({
            where: { OR: [{ slug: payload }, { id: payload }] }
          });
          if (targetBusiness) {
            business = targetBusiness;
            targetUrl = `${appUrl}/app/${targetBusiness.slug}`;
            buttonText = `Открыть ${targetBusiness.name}`;
            message = `Добро пожаловать в <b>${targetBusiness.name}</b>! ✨\n\nНажмите на кнопку ниже, чтобы открыть наше Mini App приложение, посмотреть каталог товаров/услуг и оформить заказ.`;
          } else {
            targetUrl = `${appUrl}/app/${payload}`;
            buttonText = "Открыть Mini App";
            message = "Добро пожаловать! Откройте заведение в Mini App.";
          }
        }
      } else if (business) {
        targetUrl = `${appUrl}/app/${business.slug}`;
        buttonText = `Открыть ${business.name}`;
        message = `Добро пожаловать в <b>${business.name}</b>! ✨\n\nНажмите на кнопку ниже, чтобы открыть наше Mini App приложение, посмотреть каталог товаров/услуг и оформить заказ.`;
      }

      // Upsert Customer to ensure they exist in relation to this business
      if (business && from) {
        try {
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
            },
            create: {
              businessId: business.id,
              telegramUserId: BigInt(from.id),
              name: [from.first_name, from.last_name].filter(Boolean).join(" "),
              username: from.username,
            },
          });
        } catch (err) {
          console.error("Failed to upsert customer on start command:", err);
        }
      }

      await telegramBot.sendNotification(chatId, message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: buttonText, web_app: { url: targetUrl } }]],
        },
      });

      console.log("response sent");
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
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_WEBAPP_URL || "http://localhost:3000";

      await telegramBot.sendNotification(
        chatId,
        `✅ <b>Успешно привязано!</b>\n\nВы привязали аккаунт продавца <b>${ownerUser.email}</b>.\nТеперь вы можете управлять вашим бизнесом прямо внутри Telegram Mini App!`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: "💼 Панель продавца", web_app: { url: `${appUrl}/app?mode=seller` } }]],
          },
        }
      );

      return NextResponse.json({ ok: true });
    }

    // 2. FAQ logic - resolve customer or business
    const customer = await prisma.customer.findFirst({
      where: { 
        telegramUserId: BigInt(from.id),
        ...(business ? { businessId: business.id } : {})
      },
      include: { business: true },
      orderBy: { createdAt: "desc" },
    });

    const activeBusiness = business || customer?.business;

    if (activeBusiness) {
      const knowledgeBase = `Название: ${activeBusiness.name}. Описание: ${activeBusiness.description || "нет"}. Телефон: ${activeBusiness.phone || "нет"}. Адрес: ${activeBusiness.address || "нет"}.`;
      
      console.log("Sending FAQ loading notification to Chat ID:", chatId);
      await telegramBot.sendNotification(chatId, "⏳ Думаю...");
      
      const answer = await AIService.generateFAQAnswer(
        activeBusiness.id,
        activeBusiness.aiProvider || "mock",
        activeBusiness.aiModel || "",
        {
          businessName: activeBusiness.name,
          businessType: activeBusiness.type,
          knowledgeBase,
          customerQuestion: text,
        }
      );

      console.log("Sending FAQ answer to Chat ID:", chatId);
      await telegramBot.sendNotification(chatId, answer);
      console.log("response sent");
    } else {
      console.log("Customer or business not found, sending default message to Chat ID:", chatId);
      const defaultText = "Пожалуйста, запустите бота заново с помощью команды /start и выберите заведение.";
      await telegramBot.sendNotification(chatId, defaultText);
      console.log("response sent");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error details in telegram webhook:", error);
    return NextResponse.json({ ok: true });
  }
}
