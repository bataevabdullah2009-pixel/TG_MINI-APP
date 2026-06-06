import { buildBusinessUrl } from "@/lib/production-url";

function cleanTelegramName(value: string) {
  return value.trim().replace(/^@/, "").replace(/^\/+|\/+$/g, "");
}

export function buildBusinessShareLinks(businessSlug: string) {
  const slug = businessSlug.trim().replace(/^\/+|\/+$/g, "");
  let webAppStoreUrl = "";

  try {
    webAppStoreUrl = buildBusinessUrl(slug);
  } catch {
    webAppStoreUrl = "";
  }

  const botUsername = cleanTelegramName(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "");
  const miniAppShortName = cleanTelegramName(process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_SHORT_NAME || "");
  const startParam = slug ? `store_${slug}` : "";

  const telegramMiniAppLink = botUsername && startParam
    ? miniAppShortName
      ? `https://t.me/${botUsername}/${miniAppShortName}?startapp=${encodeURIComponent(startParam)}`
      : `https://t.me/${botUsername}?startapp=${encodeURIComponent(startParam)}`
    : "";

  return {
    webAppStoreUrl,
    telegramMiniAppLink,
  };
}

export function getStoreSlugFromStartParam(startParam?: string | null) {
  const value = startParam?.trim() || "";
  if (!value.startsWith("store_")) return null;

  const slug = value.slice("store_".length).toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}
