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

function isBlockedProductionUrl(url: URL) {
  const hostname = url.hostname.toLowerCase();
  return (
    url.protocol !== "https:" ||
    BLOCKED_PRODUCTION_HOSTS.includes(hostname) ||
    BLOCKED_PRODUCTION_PATTERNS.some((pattern) => pattern.test(hostname))
  );
}

function isCurrentVercelPreviewUrl(url: URL) {
  const previewHosts = [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
  ]
    .map((value) => value?.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase())
    .filter(Boolean);

  return previewHosts.includes(url.hostname.toLowerCase());
}

function assertProductionUrl(label: string, value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `[URL CONFIG] ${label} must be an absolute URL. Received: "${value}".`
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL_ENV === "preview" &&
    isCurrentVercelPreviewUrl(parsed)
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
    process.env.NEXT_PUBLIC_WEBAPP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.WEBAPP_URL;

  if (!configured) {
    throw new Error(
      "[URL CONFIG] NEXT_PUBLIC_WEBAPP_URL or NEXT_PUBLIC_APP_URL is required for Telegram Mini App routing."
    );
  }

  return stripMiniAppPath(assertProductionUrl("NEXT_PUBLIC_WEBAPP_URL/NEXT_PUBLIC_APP_URL", configured));
}

export function getMiniAppUrl(path = "/app") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAppBaseUrl()}${normalizedPath}`;
}

function normalizeBusinessSlug(slug?: string | null) {
  const normalized = slug?.trim().replace(/^\/+|\/+$/g, "").toLowerCase();

  if (!normalized || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function buildBusinessUrl(slug?: string | null) {
  const normalizedSlug = normalizeBusinessSlug(slug);
  return getMiniAppUrl(normalizedSlug ? `/app/${encodeURIComponent(normalizedSlug)}` : "/app");
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
