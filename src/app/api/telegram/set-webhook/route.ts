import { NextRequest, NextResponse } from "next/server";
import { getTelegramWebhookUrl } from "@/lib/production-url";

export async function GET(request: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN is not configured in environment variables" }, { status: 400 });
  }

  try {
    const webhookUrl = getTelegramWebhookUrl();
    console.log(`Setting Telegram webhook to: ${webhookUrl}`);
    const response = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
    );
    const result = await response.json();
    console.log("setWebhook Response:", result);
    return NextResponse.json({
      ok: result.ok,
      webhookUrl,
      telegramResponse: result
    });
  } catch (err: any) {
    console.error("setWebhook Error:", err);
    return NextResponse.json({ ok: false, error: err.message || err }, { status: 500 });
  }
}
