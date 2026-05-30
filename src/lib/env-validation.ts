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
      `⚠️ [AI CONFIG WARNING] AI_PROVIDER is set to 'openrouter', but 'OPENROUTER_API_KEY' is missing. AI content generation will fall back to local 'mock' provider mode.`
    );
  }
  if (aiProvider === "polza" && !process.env.POLZA_AI_API_KEY) {
    console.warn(
      `⚠️ [AI CONFIG WARNING] AI_PROVIDER is set to 'polza', but 'POLZA_AI_API_KEY' is missing. AI content generation will fall back to local 'mock' provider mode.`
    );
  }

  // App domain configuration check
  if (!process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_WEBAPP_URL) {
    console.warn(
      `⚠️ [URL CONFIG WARNING] Neither 'NEXT_PUBLIC_APP_URL' nor 'NEXT_PUBLIC_WEBAPP_URL' is configured. Webhook and redirection services will fallback to 'https://tg-mini-app-two-ruby.vercel.app'.`
    );
  }
}
