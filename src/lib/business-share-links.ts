function cleanPublicUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function normalizeMiniAppBase(value: string) {
  const cleaned = cleanPublicUrl(value);
  return cleaned.endsWith("/app") ? cleaned.slice(0, -4) : cleaned;
}

function isSafePublicUrl(value: string) {
  if (!value) return false;

  try {
    const url = new URL(value);
    if (process.env.NODE_ENV !== "production") {
      return url.protocol === "http:" || url.protocol === "https:";
    }
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

function normalizeSlug(businessSlug: string) {
  return businessSlug.trim().replace(/^\/+|\/+$/g, "");
}

function resolvePublicBaseUrl() {
  const configuredWebAppUrl = process.env.NEXT_PUBLIC_WEBAPP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const runtimeOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = (
    process.env.NODE_ENV === "production"
      ? [configuredWebAppUrl]
      : [configuredWebAppUrl, runtimeOrigin]
  ).find(isSafePublicUrl) || "";
  return publicUrl ? normalizeMiniAppBase(publicUrl) : "";
}

export function buildBusinessWebUrl(businessSlug: string) {
  const slug = normalizeSlug(businessSlug);
  const baseUrl = resolvePublicBaseUrl();
  return baseUrl && slug ? `${baseUrl}/app/${encodeURIComponent(slug)}` : "";
}

export function buildMiniAppUrl(businessSlug: string) {
  const slug = normalizeSlug(businessSlug);
  const configuredMiniAppUrl = process.env.NEXT_PUBLIC_WEBAPP_URL || "";
  if (slug && isSafePublicUrl(configuredMiniAppUrl)) {
    const cleanMiniAppUrl = cleanPublicUrl(configuredMiniAppUrl);
    return cleanMiniAppUrl.endsWith("/app")
      ? `${cleanMiniAppUrl}/${encodeURIComponent(slug)}`
      : `${normalizeMiniAppBase(cleanMiniAppUrl)}/app/${encodeURIComponent(slug)}`;
  }
  return buildBusinessWebUrl(slug);
}

export function buildTelegramStartAppUrl(businessSlug: string) {
  const slug = normalizeSlug(businessSlug);
  const botUsername = cleanTelegramName(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "");
  const miniAppShortName = cleanTelegramName(process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_SHORT_NAME || "");
  const startParam = `store_${slug}`;

  return botUsername && slug
    ? miniAppShortName
      ? `https://t.me/${botUsername}/${miniAppShortName}?startapp=${encodeURIComponent(startParam)}`
      : `https://t.me/${botUsername}?startapp=${encodeURIComponent(startParam)}`
    : "";
}

export function buildBusinessShareLinks(businessSlug: string) {
  return {
    webAppStoreUrl: buildBusinessWebUrl(businessSlug),
    telegramMiniAppLink: buildTelegramStartAppUrl(businessSlug),
    miniAppUrl: buildMiniAppUrl(businessSlug),
  };
}

export function getStoreSlugFromStartParam(startParam?: string | null) {
  const value = startParam?.trim() || "";
  if (!value.startsWith("store_")) return null;

  const slug = value.slice("store_".length).toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}
