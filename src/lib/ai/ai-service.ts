import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { AIProvider } from "./provider";
import { MockAIProvider } from "./mock-provider";
import { OpenRouterProvider } from "./openrouter-provider";
import { PolzaAIProvider } from "./polza-provider";
import { checkBusinessAiLimit, incrementAiUsage } from "./ai-cost-control";

export class AIConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIConfigurationError";
  }
}

export const AI_MANAGER_HANDOFF_MESSAGE = "ИИ временно недоступен, но я передал вопрос менеджеру.";

export function resolveAIProviderName(providerName?: string | null) {
  const envProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (envProvider) {
    if (process.env.NODE_ENV === "production" && envProvider === "mock") {
      console.error("[AI CONFIG ERROR] AI_PROVIDER=mock is ignored in production; routing to polza.");
      return "polza";
    }
    return envProvider;
  }

  const businessProvider = providerName?.trim().toLowerCase();
  if (businessProvider && businessProvider !== "mock") return businessProvider;

  return process.env.NODE_ENV === "production" ? "polza" : businessProvider || "mock";
}

export function getAIProviderConfig(providerName?: string | null, modelName?: string | null): AIProvider {
  const provider = resolveAIProviderName(providerName);
  const envProvider = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (envProvider === "polza" && provider !== "polza") {
    console.error(`[AI CONFIG ERROR] AI_PROVIDER=polza cannot route to ${provider}`);
    throw new AIConfigurationError("AI_PROVIDER=polza cannot use a fallback provider");
  }

  if (provider === "mock") {
    if (process.env.NODE_ENV === "production") {
      console.error("[AI CONFIG ERROR] Mock AI is disabled in production");
      throw new AIConfigurationError("Mock AI is disabled in production");
    }
    return new MockAIProvider();
  }

  if (provider === "openrouter") {
    const key = process.env.OPENROUTER_API_KEY;
    if (key) return new OpenRouterProvider(key, modelName || undefined);
    console.error("[AI CONFIG ERROR] OPENROUTER_API_KEY missing");
    throw new AIConfigurationError("OPENROUTER_API_KEY missing");
  }

  if (provider === "polza") {
    const key = process.env.POLZA_AI_API_KEY;
    if (!key) {
      console.error("[AI CONFIG ERROR] POLZA_AI_API_KEY missing");
      throw new AIConfigurationError("POLZA_AI_API_KEY missing");
    }
    return new PolzaAIProvider(key, modelName || undefined);
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}

async function checkCache(businessId: string, feature: string, promptHash: string) {
  if (process.env.AI_CACHE_ENABLED !== "true") return null;
  try {
    const cached = await prisma.aICache.findUnique({
      where: {
        businessId_feature_promptHash: {
          businessId,
          feature,
          promptHash,
        },
      },
    });

    if (cached) {
      const isFresh = Date.now() - cached.createdAt.getTime() < 24 * 60 * 60 * 1000;
      if (isFresh) return cached.response;
    }
  } catch (e) {
    console.warn("Cache check failed:", e);
  }
  return null;
}

async function saveCache(
  businessId: string,
  feature: string,
  promptHash: string,
  provider: string,
  model: string,
  response: string
) {
  if (process.env.AI_CACHE_ENABLED !== "true") return;
  try {
    await prisma.aICache.upsert({
      where: {
        businessId_feature_promptHash: { businessId, feature, promptHash },
      },
      update: {
        response,
        createdAt: new Date(),
      },
      create: {
        businessId,
        feature,
        promptHash,
        provider,
        model,
        response,
      },
    });
  } catch (e) {
    console.warn("Cache save failed:", e);
  }
}

export class AIService {
  static async generateFAQAnswer(businessId: string, providerConfig: string, modelConfig: string, input: any): Promise<string> {
    let provider: AIProvider | null = null;
    try {
      const isAllowed = await checkBusinessAiLimit(businessId);
      if (!isAllowed) {
        return "Лимит AI-запросов на сегодня исчерпан. Передайте вопрос менеджеру или попробуйте завтра.";
      }

      provider = getAIProviderConfig(providerConfig, modelConfig);
      const hash = crypto.createHash("md5").update(JSON.stringify(input)).digest("hex");
      const cached = await checkCache(businessId, "faq", hash);
      if (cached) return cached;

      const response = await provider.generateFAQAnswer(input);
      if (!response.trim()) {
        throw new Error("AI provider returned an empty response");
      }
      await saveCache(businessId, "faq", hash, provider.name, modelConfig, response);
      await incrementAiUsage(businessId, "faq", provider.name, modelConfig, JSON.stringify(input).length, "SUCCESS", response.length);
      return response;
    } catch (error) {
      const failedProviderName = provider?.name || resolveAIProviderName(providerConfig);
      console.error("AI Error:", error);
      if (failedProviderName === "polza") {
        console.error("[POLZA_AI_ERROR]", {
          businessId,
          model: modelConfig,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
      if (provider) {
        await incrementAiUsage(businessId, "faq", provider.name, modelConfig, JSON.stringify(input).length, "FAILED");
      }
      return AI_MANAGER_HANDOFF_MESSAGE;
    }
  }

  static async generateContent(businessId: string, providerConfig: string, modelConfig: string, input: any): Promise<string> {
    const isAllowed = await checkBusinessAiLimit(businessId);
    if (!isAllowed) {
      throw new Error("Лимит AI-запросов на сегодня исчерпан.");
    }

    const provider = getAIProviderConfig(providerConfig, modelConfig);
    try {
      const response = await provider.generateContent(input);
      await incrementAiUsage(businessId, "content", provider.name, modelConfig, JSON.stringify(input).length, "SUCCESS", response.length);
      return response;
    } catch (error: any) {
      console.error("AI Error:", error);
      await incrementAiUsage(businessId, "content", provider.name, modelConfig, JSON.stringify(input).length, "FAILED");
      throw new Error(error.message || "Ошибка при генерации контента.");
    }
  }
}
