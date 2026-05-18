const getBotUsername = (): string => {
  const username = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME;
  if (!username) {
    if (process.env.NODE_ENV === "development") {
      throw new Error("Telegram bot username is not configured");
    }
    return "";
  }
  return username.replace(/^@/, "");
};

const botUsername = getBotUsername();

export const telegramConfig = {
  botUsername,
  telegramUrl: botUsername ? `https://t.me/${botUsername}` : "",
  webAppUrl: process.env.NEXT_PUBLIC_WEBAPP_URL || "",
};
