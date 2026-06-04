/**
 * Environment Variables Validation Layer
 * Ensures the system does not crash silently due to missing configurations,
 * while allowing non-critical features (like AI keys) to degrade gracefully with warnings.
 */
export function validateEnv() {
  // We only run this check in server-side environments
  if (typeof window !== "undefined") return;

  const missingCritical: string[] = [];

  if (!process.env.DATABASE_URL) {
    missingCritical.push("DATABASE_URL");
  }
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    missingCritical.push("TELEGRAM_BOT_TOKEN");
  }

  if (missingCritical.length > 0) {
    const errorMsg = `CRITICAL ENVIRONMENT CONFIGURATION ERROR: The following required variables are missing: ${missingCritical.join(
      ", "
    )}. Please ensure they are set in your environment variables (.env / .env.local or Vercel Environment Variables).`;
    console.error("=========================================================================");
    console.error(`❌ ${errorMsg}`);
    console.error("=========================================================================");
    throw new Error(errorMsg);
  }

  // Non-critical environment warnings
  const aiProvider = process.env.AI_PROVIDER || "mock";
  if (aiProvider === "openrouter" && !process.env.OPENROUTER_API_KEY) {
    console.warn(
      `⚠️ [AI CONFIG WARNING] AI_PROVIDER is set to 'openrouter', but 'OPENROUTER_API_KEY' is missing. AI content generation will return an error until the key is configured.`
    );
  }
  if (aiProvider === "polza" && !process.env.POLZA_AI_API_KEY) {
    console.error(
      `[AI CONFIG ERROR] AI_PROVIDER=polza but POLZA_AI_API_KEY is missing. Mock fallback is disabled.`
    );
  }

  if (process.env.NODE_ENV === "production") {
    const expectedProductionVars = [
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_WEBAPP_URL",
      "TELEGRAM_WEBHOOK_URL",
      "DIRECT_URL",
      "AI_PROVIDER",
      "POLZA_TEXT_MODEL",
      "POLZA_VISION_MODEL",
    ];
    const missingProductionVars = expectedProductionVars.filter((name) => !process.env[name]);
    if (missingProductionVars.length > 0) {
      console.error(`[ENV CONFIG ERROR] Missing production variables: ${missingProductionVars.join(", ")}`);
    }
  }

  if (!process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_WEBAPP_URL) {
    console.warn(
      `[URL CONFIG ERROR] Neither NEXT_PUBLIC_APP_URL nor NEXT_PUBLIC_WEBAPP_URL is configured.`
    );
  }
}
