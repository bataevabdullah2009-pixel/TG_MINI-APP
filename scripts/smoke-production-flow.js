#!/usr/bin/env node

const baseUrl = (process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return { response, body, contentType };
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

  await check("marketplace businesses include demo-cafe", async () => {
    const marketplace = await request("/api/marketplace/businesses");
    assert(marketplace.response.ok, "marketplace businesses endpoint must return 200", {
      status: marketplace.response.status,
      body: marketplace.body,
    });
    assert(Array.isArray(marketplace.body.businesses), "marketplace response must include businesses array", marketplace.body);
    assert(marketplace.body.businesses.length > 0, "marketplace businesses endpoint must return businesses", marketplace.body);
    assert(
      marketplace.body.businesses.some((business) => business.slug === "demo-cafe"),
      "demo-cafe must exist in marketplace businesses",
      marketplace.body.businesses.map((business) => business.slug)
    );
  });

  await check("create business rejects unauthenticated request with JSON", async () => {
    const createBusiness = await request("/api/admin/super/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Smoke Test Business",
        slug: "smoke-test-business",
        type: "CUSTOM",
        templateKey: "shop",
        ownerEmail: "smoke@example.com",
        ownerPassword: "password123",
      }),
    });
    assert(createBusiness.response.status === 403, "create business without auth must return 403", {
      status: createBusiness.response.status,
      body: createBusiness.body,
    });
    assert(createBusiness.body && typeof createBusiness.body.error === "string", "create business auth error must be useful JSON", createBusiness.body);
  });

  await check("categories endpoint exists", async () => {
    const categories = await request("/api/categories");
    assert(categories.response.status !== 404, "categories endpoint must exist", {
      status: categories.response.status,
      body: categories.body,
    });
    assert(categories.contentType.includes("application/json"), "categories endpoint must return JSON", {
      contentType: categories.contentType,
    });
  });

  await check("orders endpoint validates empty cart", async () => {
    const emptyOrder = await request("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: "demo-cafe",
        customerName: "Smoke User",
        customerPhone: "+79990000000",
        items: [],
      }),
    });
    assert(emptyOrder.response.status === 400, "orders endpoint must validate empty cart with 400", {
      status: emptyOrder.response.status,
      body: emptyOrder.body,
    });
    assert(emptyOrder.body && typeof emptyOrder.body.error === "string", "orders empty cart error must be useful JSON", emptyOrder.body);
  });

  await check("upload endpoint requires auth", async () => {
    const upload = await request("/api/upload", { method: "POST" });
    assert(upload.response.status !== 404, "upload endpoint must not be 404", {
      status: upload.response.status,
      body: upload.body,
    });
    assert(upload.response.status === 401, "upload endpoint must require auth without a session", {
      status: upload.response.status,
      body: upload.body,
    });
    assert(upload.body && typeof upload.body.error === "string", "upload auth error must be useful JSON", upload.body);
  });

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
