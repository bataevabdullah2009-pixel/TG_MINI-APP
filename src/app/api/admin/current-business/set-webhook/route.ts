import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);
    if (session.role === "MANAGER") return jsonError("У менеджера нет доступа к этой операции.", 403);

    const body = await request.json();
    const businessId = body.businessId || session.businessId;
    const { origin } = body;

    if (!businessId) return jsonError("Бизнес не выбран.", 400);
    if (!canUseBusiness(session, businessId)) return jsonError("Нет доступа к этому бизнесу.", 403);
    if (!origin) return jsonError("Не передан адрес (origin) сайта.", 400);

    const business = await prisma.business.findUnique({
      where: { id: businessId }
    });

    if (!business) return jsonError("Бизнес не найден.", 404);
    if (!business.telegramBotToken) {
      return jsonError("Укажите Токен Telegram-бота в настройках перед подключением.", 400);
    }

    // Webhook URL includes the business ID as a query parameter for routing multi-tenant updates
    const webhookUrl = `${origin}/api/telegram/webhook?businessId=${business.id}`;
    
    console.log(`Setting Telegram webhook for business ${business.name} to URL: ${webhookUrl}`);
    
    const response = await fetch(
      `https://api.telegram.org/bot${business.telegramBotToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
    );
    
    const result = await response.json();
    console.log("setWebhook Response from Telegram:", result);
    
    if (result.ok) {
      return NextResponse.json({ ok: true, data: result });
    } else {
      return jsonError(`Telegram API Error: ${result.description || "Не удалось настроить Webhook"}`, 400);
    }
  } catch (error: any) {
    console.error("POST /api/admin/current-business/set-webhook failed:", error);
    return jsonError(error.message || "Не удалось настроить Webhook в Telegram.", 500);
  }
}
