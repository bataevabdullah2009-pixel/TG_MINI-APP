import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;

  if (!token) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN is not configured in .env" }, { status: 400 });
  }

  if (!webhookUrl) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_WEBHOOK_URL is not configured in .env" }, { status: 400 });
  }

  try {
    console.log(`Setting Telegram webhook to: ${webhookUrl}`);
    const response = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
    );
    const result = await response.json();
    console.log("setWebhook Response:", result);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("setWebhook Error:", err);
    return NextResponse.json({ ok: false, error: err.message || err }, { status: 500 });
  }
}
