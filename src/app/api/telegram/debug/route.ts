import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const botTokenExists = !!token;
  
  let webhookInfo = null;
  if (botTokenExists) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      webhookInfo = await response.json();
    } catch (err: any) {
      webhookInfo = { error: err.message || err };
    }
  }

  return NextResponse.json({
    botTokenExists,
    TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || null,
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || null,
    NEXT_PUBLIC_WEBAPP_URL: process.env.NEXT_PUBLIC_WEBAPP_URL || null,
    TELEGRAM_WEBHOOK_URL: process.env.TELEGRAM_WEBHOOK_URL || null,
    webhookInfo,
  });
}
