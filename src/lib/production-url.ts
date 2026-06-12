const BLOCKED_PRODUCTION_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
];

const BLOCKED_PRODUCTION_PATTERNS = [
  /(^|\.)ngrok-free\.app$/i,
  /(^|\.)ngrok\.app$/i,
  /(^|\.)ngrok\.io$/i,
];

type WebhookOptions = {
  businessId?: string | null;
};

function cleanUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function normalizeConfiguredUrl(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return "";
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
}

function isBlockedProductionUrl(url: URL) {
  const hostname = url.hostname.toLowerCase();
  return (
    url.protocol !== "https:" ||
    BLOCKED_PRODUCTION_HOSTS.includes(hostname) ||
    BLOCKED_PRODUCTION_PATTERNS.some((pattern) => pattern.test(hostname))
  );
}

function assertProductionUrl(label: string, value: string) {
  let parsed: URL;
  try {
    parsed = new URL(normalizeConfiguredUrl(value));
  } catch {
    throw new Error(
      `[URL CONFIG] ${label} must be an absolute URL. Received: "${value}".`
    );
  }

  const runtimePreviewHost = (process.env.VERCEL_URL || "").toLowerCase();
  const productionHost = (process.env.VERCEL_PROJECT_PRODUCTION_URL || "").toLowerCase();
  if (
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL_ENV === "preview" &&
    parsed.hostname.toLowerCase() === runtimePreviewHost &&
    runtimePreviewHost !== productionHost
  ) {
    throw new Error(
      `[URL CONFIG] ${label} cannot use a Vercel Preview deployment for production Telegram routing.`
    );
  }

  if (process.env.NODE_ENV === "production" && isBlockedProductionUrl(parsed)) {
    throw new Error(
      `[URL CONFIG] ${label} points to "${value}". Production Telegram URLs must use a deployed HTTPS domain, not ngrok, localhost, or 127.0.0.1.`
    );
  }

  return cleanUrl(parsed.toString());
}

function stripMiniAppPath(value: string) {
  const parsed = new URL(value);
  if (parsed.pathname === "/app" || parsed.pathname.startsWith("/app/")) {
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
  }
  return cleanUrl(parsed.toString());
}

export function getAppBaseUrl() {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_WEBAPP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.WEBAPP_URL;

  if (!configured) {
    throw new Error(
      "[URL CONFIG] NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_WEBAPP_URL, or VERCEL_PROJECT_PRODUCTION_URL is required for Telegram Mini App routing."
    );
  }

  return stripMiniAppPath(
    assertProductionUrl(
      "NEXT_PUBLIC_APP_URL/NEXT_PUBLIC_WEBAPP_URL/VERCEL_PROJECT_PRODUCTION_URL",
      configured
    )
  );
}

export function buildMiniAppUrl(path = "/app") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAppBaseUrl()}${normalizedPath}`;
}

export function getMiniAppUrl(path = "/app") {
  return buildMiniAppUrl(path);
}

export function buildBusinessMiniAppUrl(businessSlug: string) {
  return buildMiniAppUrl(`/app/${encodeURIComponent(businessSlug.trim())}`);
}

export function buildProductMiniAppUrl(businessSlug: string, productIdOrSlug: string) {
  const url = new URL(buildBusinessMiniAppUrl(businessSlug));
  url.searchParams.set("product", productIdOrSlug);
  return url.toString();
}

export function buildSellerPanelUrl(
  businessSlug?: string | null,
  options: { orderId?: string | null; tab?: "orders" | "bookings" } = {}
) {
  const url = new URL(buildMiniAppUrl());
  url.searchParams.set("mode", "seller");
  if (businessSlug) url.searchParams.set("business", businessSlug);
  if (options.tab) url.searchParams.set("tab", options.tab);
  if (options.orderId) url.searchParams.set("orderId", options.orderId);
  return url.toString();
}

export function buildCourierPanelUrl(courierId?: string | null) {
  const url = new URL(buildMiniAppUrl("/courier/orders"));
  if (courierId) url.searchParams.set("courierId", courierId);
  return url.toString();
}

export function buildTelegramBotStartUrl(
  startParam: string,
  botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || ""
) {
  const username = botUsername.trim().replace(/^@/, "");
  if (!username) return null;
  return `https://t.me/${username}?start=${encodeURIComponent(startParam)}`;
}

export function getTelegramWebhookUrl(options: WebhookOptions = {}) {
  const configured = process.env.TELEGRAM_WEBHOOK_URL;
  const url = configured
    ? assertProductionUrl("TELEGRAM_WEBHOOK_URL", configured)
    : `${getAppBaseUrl()}/api/telegram/webhook`;

  if (!options.businessId) return url;

  const parsed = new URL(url);
  parsed.searchParams.set("businessId", options.businessId);
  return parsed.toString();
}
