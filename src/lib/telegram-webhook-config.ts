const TELEGRAM_WEBHOOK_SECRET_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;

export function getTelegramWebhookSecret() {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || "";

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("TELEGRAM_WEBHOOK_SECRET is required in production.");
    }
    return "";
  }

  if (!TELEGRAM_WEBHOOK_SECRET_PATTERN.test(secret)) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET must contain 1-256 characters: A-Z, a-z, 0-9, _ or -.");
  }

  return secret;
}

export function buildTelegramSetWebhookUrl(botToken: string, webhookUrl: string) {
  const url = new URL(`https://api.telegram.org/bot${botToken}/setWebhook`);
  url.searchParams.set("url", webhookUrl);

  const secret = getTelegramWebhookSecret();
  if (secret) url.searchParams.set("secret_token", secret);

  return url.toString();
}
