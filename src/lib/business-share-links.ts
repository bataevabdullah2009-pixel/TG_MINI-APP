function cleanPublicUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function normalizeMiniAppBase(value: string) {
  const cleaned = cleanPublicUrl(value);
  return cleaned.endsWith("/app") ? cleaned.slice(0, -4) : cleaned;
}

function isSafePublicUrl(value: string) {
  if (!value) return false;
  if (process.env.NODE_ENV !== "production") return true;

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      !["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname) &&
      !/(^|\.)ngrok(?:-free)?\.(?:app|io)$/i.test(hostname)
    );
  } catch {
    return false;
  }
}

function cleanTelegramName(value: string) {
  return value.trim().replace(/^@/, "").replace(/^\/+|\/+$/g, "");
}

export function buildBusinessShareLinks(businessSlug: string) {
  const slug = businessSlug.trim().replace(/^\/+|\/+$/g, "");
  const configuredWebAppUrl = process.env.NEXT_PUBLIC_WEBAPP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const runtimeOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = [configuredWebAppUrl, runtimeOrigin].find(isSafePublicUrl) || "";
  const baseUrl = publicUrl ? normalizeMiniAppBase(publicUrl) : "";

  const botUsername = cleanTelegramName(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "");
  const miniAppShortName = cleanTelegramName(process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_SHORT_NAME || "");
  const startParam = `store_${slug}`;

  const telegramMiniAppLink = botUsername
    ? miniAppShortName
      ? `https://t.me/${botUsername}/${miniAppShortName}?startapp=${encodeURIComponent(startParam)}`
      : `https://t.me/${botUsername}?startapp=${encodeURIComponent(startParam)}`
    : "";

  return {
    webAppStoreUrl: baseUrl && slug ? `${baseUrl}/app/${encodeURIComponent(slug)}` : "",
    telegramMiniAppLink,
  };
}

export function getStoreSlugFromStartParam(startParam?: string | null) {
  const value = startParam?.trim() || "";
  if (!value.startsWith("store_")) return null;

  const slug = value.slice("store_".length).toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}
