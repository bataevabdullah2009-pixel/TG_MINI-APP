import { prisma } from "@/lib/prisma";

export type AiPlan = "FREE" | "START" | "PRO" | "BUSINESS";

export const planLimits: Record<AiPlan, { daily: number; maxTokens: number; provider: string; model: string }> = {
  FREE: { daily: 5, maxTokens: 300, provider: "mock", model: "mock-free" },
  START: { daily: 20, maxTokens: 400, provider: "openrouter", model: "google/gemini-flash-1.5" },
  PRO: { daily: 100, maxTokens: 700, provider: "openrouter", model: "openai/gpt-4o-mini" },
  BUSINESS: { daily: 300, maxTokens: 1000, provider: "polza", model: "gpt-4o-mini" },
};

export function normalizePlan(name?: string | null): AiPlan {
  const value = (name || "FREE").toUpperCase();
  if (value.includes("BUSINESS")) return "BUSINESS";
  if (value.includes("PRO")) return "PRO";
  if (value.includes("START")) return "START";
  return "FREE";
}

export async function getAiRouting(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      aiEnabled: true,
      aiProvider: true,
      aiModel: true,
      aiDailyLimit: true,
      subscriptionPlan: { select: { name: true } },
    },
  });
  if (!business || !business.aiEnabled) return null;

  const plan = normalizePlan(business.subscriptionPlan?.name);
  const limits = planLimits[plan];
  const preferredProvider = business.aiProvider && business.aiProvider !== "mock" ? business.aiProvider : limits.provider;
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
  const hasPolza = Boolean(process.env.POLZA_AI_API_KEY);

  let provider = preferredProvider;
  if (provider === "openrouter" && !hasOpenRouter) provider = plan === "FREE" ? "mock" : "mock";
  if (provider === "polza" && !hasPolza) provider = hasOpenRouter ? "openrouter" : "mock";

  return {
    business,
    plan,
    dailyLimit: business.aiDailyLimit || limits.daily,
    maxTokens: limits.maxTokens,
    provider,
    model: business.aiModel || limits.model,
    providerConfigured: provider === "mock" || (provider === "openrouter" && hasOpenRouter) || (provider === "polza" && hasPolza),
  };
}

export async function checkBusinessAiLimit(businessId: string): Promise<boolean> {
  const routing = await getAiRouting(businessId);
  if (!routing) return false;
  const dailyUsage = await getDailyUsage(businessId);
  return dailyUsage < routing.dailyLimit;
}

export async function getDailyUsage(businessId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return prisma.aIUsageLog.count({ where: { businessId, createdAt: { gte: today } } });
}

export async function getMonthlyUsage(businessId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  return prisma.aIUsageLog.count({ where: { businessId, createdAt: { gte: startOfMonth } } });
}

export async function incrementAiUsage(
  businessId: string,
  feature: string,
  provider: string,
  model: string,
  promptChars: number,
  status = "SUCCESS",
  outputChars?: number,
  estimatedCost?: number
) {
  try {
    await prisma.aIUsageLog.create({
      data: {
        businessId,
        provider,
        model,
        feature,
        promptChars,
        outputChars,
        estimatedCost,
        status,
      },
    });
  } catch (error) {
    console.error("Failed to log AI usage:", error);
  }
}

export function estimateAiCost(provider: string, promptChars: number, outputChars = 0) {
  if (provider === "mock") return 0;
  const tokens = Math.ceil((promptChars + outputChars) / 4);
  return Number((tokens * 0.0000006).toFixed(6));
}

export function enforcePromptLength(prompt: string): string {
  const maxChars = parseInt(process.env.AI_MAX_PROMPT_CHARS || "4000", 10);
  return prompt.length > maxChars ? prompt.slice(0, maxChars) : prompt;
}
