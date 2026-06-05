#!/usr/bin/env node

import "dotenv/config";

const apiKey = process.env.POLZA_AI_API_KEY;
const model = process.env.POLZA_TEXT_MODEL || "z-ai/glm-4.7-flash";
const endpoint = process.env.POLZA_CHAT_BASE_URL
  || `${(process.env.POLZA_BASE_URL || "https://polza.ai/api/v1").replace(/\/+$/, "")}/chat/completions`;

if ((process.env.AI_PROVIDER || "").trim().toLowerCase() !== "polza") {
  console.error("[AI CONFIG ERROR] smoke requires AI_PROVIDER=polza");
  process.exit(1);
}
if (!apiKey) {
  console.error("[AI CONFIG ERROR] POLZA_AI_API_KEY missing");
  process.exit(1);
}

async function callPolza(system, user, maxTokens = 500, responseFormat) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          max_tokens: maxTokens,
          temperature: 0.2,
          reasoning: {
            enabled: false,
            exclude: true,
          },
          ...(responseFormat ? { response_format: responseFormat } : {}),
        }),
        signal: AbortSignal.timeout(45_000),
      });

      const body = await response.json().catch(async () => ({ raw: await response.text() }));
      if (!response.ok) throw new Error(`Polza HTTP ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
      const choice = body.choices?.[0];
      const content = choice?.message?.content;
      if (typeof content === "string" && content.trim()) return content.trim();
      if (Array.isArray(content)) {
        const combined = content
          .map((part) => typeof part === "string" ? part : part?.text || part?.content || "")
          .filter(Boolean)
          .join("\n")
          .trim();
        if (combined) return combined;
      }
      if (typeof choice?.text === "string" && choice.text.trim()) return choice.text.trim();
      throw new Error(`Polza returned an empty response (finish_reason=${choice?.finish_reason || "unknown"})`);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  throw lastError;
}

function repairParse(raw) {
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("Product card response has no JSON object");
  const json = raw
    .slice(first, last + 1)
    .replace(/[“”]/g, "\"")
    .replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(json);
}

const chat = await callPolza(
  "Ты живой Telegram AI-помощник Vitrina AI. Ответь коротко по-русски.",
  "Привет. Подтверди, что отвечаешь через Polza AI."
);

const productRaw = await callPolza(
  "Верни только строгий JSON без markdown: {\"title\":\"string\",\"shortDescription\":\"string\",\"description\":\"string\",\"categorySuggestion\":\"string\",\"tags\":[\"string\"],\"tgPost\":\"string\"}. Все поля обязательны.",
  "Создай карточку товара: шоколадный торт ручной работы, вес 1 кг.",
  900,
  { type: "json_object" }
);
let product;
let repaired = false;
try {
  product = repairParse(productRaw);
} catch {
  const repairedRaw = await callPolza(
    "Преобразуй исходный ответ в строгий JSON. Верни только JSON без markdown: {\"title\":\"string\",\"shortDescription\":\"string\",\"description\":\"string\",\"categorySuggestion\":\"string\",\"tags\":[\"string\"],\"tgPost\":\"string\"}. Все поля обязательны.",
    `Исходный ответ:\n${productRaw}`,
    900,
    { type: "json_object" }
  );
  product = repairParse(repairedRaw);
  repaired = true;
}
const requiredFields = ["title", "shortDescription", "description", "categorySuggestion", "tgPost"];
for (const field of requiredFields) {
  if (typeof product[field] !== "string" || !product[field].trim()) {
    throw new Error(`Polza product card is missing required field: ${field}`);
  }
}
if (!Array.isArray(product.tags) || product.tags.some((tag) => typeof tag !== "string")) {
  throw new Error("Polza product card is missing string tags array");
}

console.log(JSON.stringify({
  ok: true,
  provider: "polza",
  model,
  endpointHost: new URL(endpoint).host,
  chatChars: chat.length,
  productCardFields: [...requiredFields, "tags"],
  repaired,
}, null, 2));
