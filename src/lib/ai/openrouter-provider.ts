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
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://tg-mini-app-two-ruby.vercel.app",
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
