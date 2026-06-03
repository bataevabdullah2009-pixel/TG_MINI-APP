const action = process.argv[2];
const token = process.env.TELEGRAM_BOT_TOKEN;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function assertSafeProductionUrl(label, value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${label} must be an absolute URL. Received: ${value || "<empty>"}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  const blocked =
    parsed.protocol !== "https:" ||
    ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname) ||
    /(^|\.)ngrok(-free)?\.(app|io)$/i.test(hostname);

  if (process.env.NODE_ENV === "production" && blocked) {
    fail(`${label} must be a deployed HTTPS URL in production. Received: ${value}`);
  }

  return parsed.toString().replace(/\/+$/, "");
}

function appBaseUrl() {
  const configured =
    process.env.NEXT_PUBLIC_WEBAPP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.WEBAPP_URL;

  if (!configured) {
    fail("NEXT_PUBLIC_WEBAPP_URL or NEXT_PUBLIC_APP_URL is required to derive TELEGRAM_WEBHOOK_URL.");
  }

  const parsed = new URL(assertSafeProductionUrl("NEXT_PUBLIC_WEBAPP_URL/NEXT_PUBLIC_APP_URL", configured));
  if (parsed.pathname === "/app" || parsed.pathname.startsWith("/app/")) {
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
  }
  return parsed.toString().replace(/\/+$/, "");
}

function webhookUrl() {
  return process.env.TELEGRAM_WEBHOOK_URL
    ? assertSafeProductionUrl("TELEGRAM_WEBHOOK_URL", process.env.TELEGRAM_WEBHOOK_URL)
    : `${appBaseUrl()}/api/telegram/webhook`;
}

async function callTelegram(method, params = {}) {
  if (!token) fail("TELEGRAM_BOT_TOKEN is required.");
  const url = new URL(`https://api.telegram.org/bot${token}/${method}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url);
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
  if (!data.ok) process.exit(1);
}

if (action === "info") {
  await callTelegram("getWebhookInfo");
} else if (action === "set") {
  await callTelegram("setWebhook", { url: webhookUrl() });
} else if (action === "delete") {
  await callTelegram("deleteWebhook");
} else {
  fail("Usage: node scripts/telegram-webhook.mjs <info|set|delete>");
}
