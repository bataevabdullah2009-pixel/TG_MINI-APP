#!/usr/bin/env node

import "dotenv/config";

const required = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_WEBAPP_URL",
  "TELEGRAM_WEBHOOK_URL",
  "TELEGRAM_WEBHOOK_SECRET",
  "TELEGRAM_BOT_TOKEN",
  "AI_PROVIDER",
  "POLZA_AI_API_KEY",
  "POLZA_TEXT_MODEL",
  "POLZA_VISION_MODEL",
  "DATABASE_URL",
  "DIRECT_URL",
];

const blockedHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const issues = [];
const variables = {};

for (const name of required) {
  const value = process.env[name]?.trim();
  variables[name] = value ? "set" : "missing";
  if (!value) {
    issues.push({ type: "missing_env", variable: name });
    continue;
  }

  if (name.includes("URL")) {
    try {
      const url = new URL(value);
      variables[name] = { status: "set", protocol: url.protocol, host: url.host, path: url.pathname };
      if (name.startsWith("NEXT_PUBLIC_") || name === "TELEGRAM_WEBHOOK_URL") {
        if (url.protocol !== "https:" || blockedHosts.has(url.hostname) || /ngrok/i.test(url.hostname)) {
          issues.push({ type: "unsafe_production_url", variable: name, host: url.host });
        }
      }
    } catch {
      issues.push({ type: "invalid_url", variable: name });
    }
  }
}

if ((process.env.AI_PROVIDER || "").trim().toLowerCase() !== "polza") {
  issues.push({ type: "wrong_ai_provider", variable: "AI_PROVIDER", expected: "polza" });
}

console.log(JSON.stringify({ ok: issues.length === 0, variables, issues }, null, 2));
if (issues.length > 0) process.exitCode = 1;
