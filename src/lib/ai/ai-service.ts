import { AIProvider } from "./provider";
import { MockAIProvider } from "./mock-provider";
import { OpenRouterProvider } from "./openrouter-provider";
import { PolzaAIProvider } from "./polza-provider";
import { checkBusinessAiLimit, incrementAiUsage } from "./ai-cost-control";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export function getAIProviderConfig(providerName?: string, modelName?: string): AIProvider {
  const provider = providerName || process.env.AI_PROVIDER || "mock";

  if (provider === "openrouter") {
    const key = process.env.OPENROUTER_API_KEY;
    if (key) return new OpenRouterProvider(key, modelName);
    console.warn("⚠️ [AI Service] 'openrouter' was selected but OPENROUTER_API_KEY is not defined. Falling back to 'mock' provider.");
  }

  if (provider === "polza") {
    const key = process.env.POLZA_AI_API_KEY;
    if (!key) {
      throw new Error("API-ключ Polza AI (POLZA_AI_API_KEY) отсутствует в конфигурации сервера. Пожалуйста, настройте его в .env файле.");
    }
    return new PolzaAIProvider(key, modelName);
  }

  // Fallback to mock if keys are missing or provider is mock
  return new MockAIProvider();
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
      // Return cached only if it's not too old (e.g., 24 hours)
      const isFresh = Date.now() - cached.createdAt.getTime() < 24 * 60 * 60 * 1000;
      if (isFresh) return cached.response;
    }
  } catch (e) {
    console.warn("Cache check failed:", e);
  }
  return null;
}

async function saveCache(businessId: string, feature: string, promptHash: string, provider: string, model: string, response: string) {
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
    const isAllowed = await checkBusinessAiLimit(businessId);
    if (!isAllowed) {
      return "Лимит ИИ-запросов на сегодня исчерпан. Передайте вопрос менеджеру или попробуйте завтра.";
    }

    const provider = getAIProviderConfig(providerConfig, modelConfig);
    const hash = crypto.createHash("md5").update(JSON.stringify(input)).digest("hex");

    const cached = await checkCache(businessId, "faq", hash);
    if (cached) return cached;

    try {
      const response = await provider.generateFAQAnswer(input);
      await saveCache(businessId, "faq", hash, provider.name, modelConfig, response);
      await incrementAiUsage(businessId, "faq", provider.name, modelConfig, JSON.stringify(input).length, "SUCCESS", response.length);
      return response;
    } catch (error) {
      console.error("AI Error:", error);
      await incrementAiUsage(businessId, "faq", provider.name, modelConfig, JSON.stringify(input).length, "FAILED");
      return "Сейчас ИИ временно недоступен. Я передам ваш вопрос менеджеру.";
    }
  }

  static async generateContent(businessId: string, providerConfig: string, modelConfig: string, input: any): Promise<string> {
    const isAllowed = await checkBusinessAiLimit(businessId);
    if (!isAllowed) {
      throw new Error("Лимит ИИ-запросов на сегодня исчерпан.");
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
