#!/usr/bin/env node

require("dotenv/config");

const baseUrl = (process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const businessSlug = process.env.SMOKE_BUSINESS_SLUG || "mir-conditera";
const secondBusinessSlug = process.env.SMOKE_SECOND_BUSINESS_SLUG || "demo-cafe";
const initData = process.env.SMOKE_TELEGRAM_INIT_DATA || "";

async function request(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        signal: AbortSignal.timeout(30_000),
      });
      const contentType = response.headers.get("content-type") || "";
      const body = contentType.includes("application/json") ? await response.json() : await response.text();
      return { response, body, contentType };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError;
}

function assert(condition, message, details) {
  if (!condition) {
    const suffix = details ? `\n${JSON.stringify(details, null, 2)}` : "";
    throw new Error(`${message}${suffix}`);
  }
}

async function main() {
  console.log(`Smoke base URL: ${baseUrl}`);
  const failures = [];

  async function check(name, fn) {
    try {
      await fn();
      console.log(`ok ${name}`);
    } catch (error) {
      failures.push({ name, message: error.message || String(error) });
      console.error(`fail ${name}: ${error.message || error}`);
    }
  }

  function skip(name, reason) {
    console.log(`skip ${name}: ${reason}`);
  }

  await check("/app opens", async () => {
    const page = await request("/app");
    assert(page.response.ok, "/app must return 200", { status: page.response.status });
    assert(page.contentType.includes("text/html"), "/app must return HTML", { contentType: page.contentType });
  });

  await check(`/app/${businessSlug} opens`, async () => {
    const page = await request(`/app/${encodeURIComponent(businessSlug)}`);
    assert(page.response.ok, "business Mini App page must return 200", { status: page.response.status });
    assert(page.contentType.includes("text/html"), "business Mini App page must return HTML", { contentType: page.contentType });
  });

  await check("marketplace returns real businesses", async () => {
    const marketplace = await request("/api/marketplace/businesses");
    assert(marketplace.response.ok, "marketplace businesses endpoint must return 200", {
      status: marketplace.response.status,
      body: marketplace.body,
    });
    assert(Array.isArray(marketplace.body.businesses), "marketplace response must include businesses array", marketplace.body);
    assert(marketplace.body.businesses.length > 0, "marketplace must not mask DB data with an empty array", marketplace.body);
    assert(
      marketplace.body.businesses.some((business) => business.slug === businessSlug),
      `${businessSlug} must exist in marketplace businesses`,
      marketplace.body.businesses.map((business) => business.slug)
    );
  });

  for (const slug of [businessSlug, secondBusinessSlug]) {
    await check(`catalog ${slug} returns DB items`, async () => {
      const catalog = await request(`/api/businesses/${encodeURIComponent(slug)}/catalog`);
      assert(catalog.response.ok, "catalog endpoint must return 200", {
        status: catalog.response.status,
        body: catalog.body,
      });
      assert(catalog.body.business?.slug === slug, "catalog must return the requested business", catalog.body);
      assert(Array.isArray(catalog.body.items), "catalog must include items array", catalog.body);
      assert(catalog.body.items.length > 0, "catalog must return stored DB items, not an empty fallback", catalog.body);
    });
  }

  await check("profile API does not crash", async () => {
    const profile = await request("/api/customer/profile", {
      headers: initData ? { "x-telegram-init-data": initData } : undefined,
    });
    assert(profile.response.status < 500, "profile API must not return a server error", {
      status: profile.response.status,
      body: profile.body,
    });
    if (initData) assert(profile.body.ok === true, "authorized profile must open", profile.body);
  });

  await check("orders/history API does not crash", async () => {
    const orders = await request("/api/customer/orders", {
      headers: initData ? { "x-telegram-init-data": initData } : undefined,
    });
    assert(orders.response.status < 500, "orders/history API must not return a server error", {
      status: orders.response.status,
      body: orders.body,
    });
    if (initData) {
      assert(orders.body.ok === true, "authorized order history must open", orders.body);
      assert(Array.isArray(orders.body.orders) && Array.isArray(orders.body.bookings), "history must return orders and bookings", orders.body);
    }
  });

  await check("checkout validates empty cart without crashing", async () => {
    const emptyOrder = await request("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: businessSlug,
        telegramUserId: process.env.SMOKE_TELEGRAM_USER_ID || "999999999",
        customerName: "Smoke User",
        customerPhone: "+79990000000",
        items: [],
      }),
    });
    assert(emptyOrder.response.status === 400, "orders endpoint must validate empty cart with 400", {
      status: emptyOrder.response.status,
      body: emptyOrder.body,
    });
  });

  if (process.env.SMOKE_ALLOW_WRITES === "true") {
    await check("checkout creates order", async () => {
      const telegramUserId = process.env.SMOKE_TELEGRAM_USER_ID;
      const verifiedPhone = process.env.SMOKE_VERIFIED_PHONE;
      assert(telegramUserId && verifiedPhone, "SMOKE_TELEGRAM_USER_ID and SMOKE_VERIFIED_PHONE are required for write smoke");

      const catalog = await request(`/api/businesses/${encodeURIComponent(businessSlug)}/catalog`);
      const item = catalog.body.items?.find((candidate) => candidate.type === "PRODUCT") || catalog.body.items?.[0];
      assert(item?.id, "checkout smoke requires a catalog item", catalog.body);

      const order = await request(`/api/businesses/${encodeURIComponent(businessSlug)}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId,
          customerName: process.env.SMOKE_CUSTOMER_NAME || "Smoke User",
          customerPhone: verifiedPhone,
          deliveryType: "PICKUP",
          paymentMethod: "CASH",
          items: [{ itemId: item.id, quantity: 1 }],
          comment: "Automated production smoke order",
        }),
      });
      assert(order.response.status === 201 && order.body.ok === true, "checkout must create an order", {
        status: order.response.status,
        body: order.body,
      });
    });
  } else {
    skip("checkout creates order", "set SMOKE_ALLOW_WRITES=true with an existing verified smoke Telegram user");
  }

  if (process.env.SMOKE_TELEGRAM_CHAT_ID) {
    await check("Telegram webhook accepts ordinary Polza AI text", async () => {
      const chatId = Number(process.env.SMOKE_TELEGRAM_CHAT_ID);
      const webhook = await request("/api/telegram/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          update_id: Date.now(),
          message: {
            message_id: Date.now(),
            date: Math.floor(Date.now() / 1000),
            chat: { id: chatId, type: "private" },
            from: { id: chatId, first_name: "Smoke", username: "vitrina_smoke" },
            text: "Ответь одним коротким живым сообщением через Polza AI: Привет",
          },
        }),
      });
      assert(webhook.response.ok && webhook.body.ok === true, "Telegram webhook must accept ordinary text", {
        status: webhook.response.status,
        body: webhook.body,
      });
    });
  } else {
    skip("Telegram webhook ordinary Polza AI text", "set SMOKE_TELEGRAM_CHAT_ID to receive the live answer");
  }

  if (failures.length > 0) {
    throw new Error(`Smoke production flow failed ${failures.length} check(s): ${failures.map((failure) => failure.name).join(", ")}`);
  }
  console.log("Smoke production flow passed.");
}

main().catch((error) => {
  console.error("Smoke production flow failed.");
  console.error(error.message || error);
  process.exit(1);
});
