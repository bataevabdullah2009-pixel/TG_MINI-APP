import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { getTelegramWebhookUrl } from "@/lib/production-url";
import { isBusinessIsDemoMissingColumnError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";
import { buildTelegramSetWebhookUrl } from "@/lib/telegram-webhook-config";
import { canBusinessOperate } from "@/lib/subscriptions/business-subscription-service";

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);
    if (session.role === "MANAGER") return jsonError("У менеджера нет доступа к этой операции.", 403);

    const body = await request.json();
    const businessId = body.businessId || session.businessId;

    if (!businessId) return jsonError("Бизнес не выбран.", 400);
    if (!canUseBusiness(session, businessId)) return jsonError("Нет доступа к этому бизнесу.", 403);
    if (session.role !== "SUPER_ADMIN") {
      const access = await canBusinessOperate(businessId);
      if (!access.canManageProducts) {
        return jsonError(access.reason || "Настройки бизнеса временно недоступны.", 403);
      }
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, telegramBotToken: true },
    });

    if (!business) return jsonError("Бизнес не найден.", 404);
    if (!business.telegramBotToken) {
      return jsonError("Укажите Токен Telegram-бота в настройках перед подключением.", 400);
    }

    // Webhook URL includes the business ID as a query parameter for routing multi-tenant updates.
    const webhookUrl = getTelegramWebhookUrl({ businessId: business.id });
    
    console.log(`Setting Telegram webhook for business ${business.name} to URL: ${webhookUrl}`);
    
    const response = await fetch(buildTelegramSetWebhookUrl(business.telegramBotToken, webhookUrl));
    
    const result = await response.json();
    console.log("setWebhook Response from Telegram:", result);
    
    if (result.ok) {
      return NextResponse.json({ ok: true, data: result });
    } else {
      return jsonError(`Telegram API Error: ${result.description || "Не удалось настроить Webhook"}`, 400);
    }
  } catch (error: any) {
    console.error("POST /api/admin/current-business/set-webhook failed:", error);
    if (isBusinessIsDemoMissingColumnError(error)) {
      warnPrismaSchemaDrift("Set webhook business lookup failed while Business.isDemo is missing", error);
    }
    return jsonError("Не удалось настроить Telegram webhook. Повторите попытку позже.", 500);
  }
}
