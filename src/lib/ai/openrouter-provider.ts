import { AIProvider } from "./provider";
import { enforcePromptLength } from "./ai-cost-control";

export class OpenRouterProvider implements AIProvider {
  name = "openrouter";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = process.env.OPENROUTER_MODEL || "z-ai/glm-4.6") {
    this.apiKey = apiKey;
    this.model = model;
  }

  private async callAPI(system: string, user: string): Promise<string> {
    if (!this.apiKey) throw new Error("Missing OpenRouter API Key");

    const maxTokens = parseInt(process.env.AI_MAX_OUTPUT_TOKENS || "500");
    const temperature = parseFloat(process.env.AI_TEMPERATURE || "0.7");

    const res = await fetch(process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://production-domain.vercel.app",
        "X-OpenRouter-Title": process.env.OPENROUTER_SITE_NAME || "LocalAI Systems",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: enforcePromptLength(user) },
        ],
        max_tokens: maxTokens,
        temperature: temperature,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`OpenRouter API Error: ${errorText}`);
      throw new Error("Ошибка при обращении к OpenRouter API");
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  async generateFAQAnswer(input: any): Promise<string> {
    const system = `Ты — вежливый помощник бизнеса (${input.businessName}, ${input.businessType}). Отвечай на основе базы знаний коротко и по делу. Не придумывай того, чего нет. База знаний: ${input.knowledgeBase}`;
    return this.callAPI(system, input.customerQuestion);
  }

  async generateContent(input: any): Promise<string> {
    if (input.contentType === "product_card" || input.contentType === "productCard") {
      const system = `Ты — профессиональный контент-генератор для интернет-магазинов. Твоя задача — создать карточку товара для бизнеса "${input.businessName}" (${input.businessType}).
Ты должен вернуть строго валидный JSON объект и больше ничего. Не оборачивай JSON в маркдаун \`\`\`json \`\`\`. Не пиши никаких дополнительных текстов.
JSON должен строго содержать следующие поля:
{
  "name": "Название товара (привлекательное)",
  "description": "Описание товара (подробное, продающее, 2-3 предложения)",
  "category": "Название категории (одно слово или короткая фраза, подходящая для группировки)",
  "marketingText": "Промо-текст для SMM/поста в Telegram (со смайликами, призывом к действию)",
  "imagePrompt": "Промпт для генерации фото-изображения этого товара на английском языке (детальное описание визуального стиля для Stable Diffusion/Midjourney, professional product photography, clean background, 8k, photorealistic)"
}`;
      const user = `Сделай карточку товара по теме: "${input.productOrService || "Новый товар"}". Тон: ${input.tone || "продающий"}.`;
      return this.callAPI(system, user);
    }
    const system = `Ты — профессиональный SMM и маркетолог. Напиши контент формата "${input.contentType}" для бизнеса ${input.businessName}. Тон: ${input.tone || "продающий"}.`;
    const user = `Тема: ${input.productOrService || "Общее продвижение"}. Цель: ${input.goal || "Привлечь клиентов"}. Ограничься 700 символами.`;
    return this.callAPI(system, user);
  }

  async generateProductDescription(input: any): Promise<string> {
    const system = `Ты — копирайтер. Напиши описание товара/услуги для ${input.businessName}. Тон: ${input.tone || "нейтральный"}. Сделай 3-5 коротких предложений.`;
    const user = `Название: ${input.productName}. Категория: ${input.productCategory || "Разное"}. Характеристики: ${input.productFeatures || "Нет дополнительных данных"}.`;
    return this.callAPI(system, user);
  }
}
