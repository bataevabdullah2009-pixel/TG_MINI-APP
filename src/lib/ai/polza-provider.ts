import { AIProvider } from "./provider";
import { enforcePromptLength } from "./ai-cost-control";

export class PolzaAIProvider implements AIProvider {
  name = "polza";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = process.env.POLZA_TEXT_MODEL || "z-ai/glm-4.7-flash") {
    this.apiKey = apiKey;
    this.model = model;
  }

  private async callAPI(system: string, user: string): Promise<string> {
    if (!this.apiKey) throw new Error("Missing Polza AI API Key");

    const maxTokens = parseInt(process.env.AI_MAX_OUTPUT_TOKENS || "500");
    const temperature = parseFloat(process.env.AI_TEMPERATURE || "0.7");
    const baseUrl = process.env.POLZA_CHAT_BASE_URL || process.env.POLZA_BASE_URL || "https://polza.ai/api/v1/chat/completions";

    const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
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
      console.error(`Polza AI API Error: ${errorText}`);
      throw new Error("Ошибка при обращении к Polza AI API");
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
