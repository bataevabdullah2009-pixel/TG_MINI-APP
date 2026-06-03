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
    const baseUrl = process.env.POLZA_BASE_URL || "https://polza.ai/api/v1/chat/completions";

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
    if (input.contentType === "product_card") {
      const system = [
        "Ты помогаешь продавцу заполнить карточку товара в Telegram Mini App.",
        "Верни только валидный JSON без markdown, без пояснений и без code fence.",
        "Схема строго такая: {\"name\":string,\"description\":string,\"category\":string,\"marketingText\":string,\"imagePrompt\":string}.",
        "Пиши по-русски. Не выдумывай цену и факты, которых нет во входных данных.",
      ].join(" ");
      const user = [
        `Бизнес: ${input.businessName}. Тип бизнеса: ${input.businessType}.`,
        `Данные товара: ${input.productOrService || "не указаны"}.`,
        `Тон: ${input.tone || "дружелюбный"}.`,
        `Категории и ограничения: ${input.goal || "используй только факты из данных"}.`,
      ].join("\n");
      return this.callAPI(system, user);
    }

    const system = `Ты — профессиональный SMM и маркетолог. Напиши контент формата "${input.contentType}" для бизнеса ${input.businessName}. Тон: ${input.tone || "продающий"}.`;
    const user = `Тема: ${input.productOrService || "Общее продвижение"}. Цель: ${input.goal || "Привлечь клиентов"}. Ограничься 700 символами.`;
    return this.callAPI(system, user);
  }

  async generateNotice(input: {
    recipient: "customer" | "seller";
    event: string;
    facts: string;
    fallback: string;
  }): Promise<string> {
    const system = [
      "Ты пишешь короткие сервисные уведомления для Telegram Mini App.",
      "Не принимай бизнес-решений и не пересчитывай время: сервер уже решил, что событие произошло.",
      "Верни одно человеческое сообщение на русском, до 220 символов, без markdown.",
    ].join(" ");
    const user = [
      `Получатель: ${input.recipient === "customer" ? "клиент" : "продавец"}.`,
      `Событие: ${input.event}.`,
      `Факты от сервера: ${input.facts}.`,
      `Базовый смысл: ${input.fallback}`,
    ].join("\n");
    return this.callAPI(system, user);
  }

  async generateProductDescription(input: any): Promise<string> {
    const system = `Ты — копирайтер. Напиши описание товара/услуги для ${input.businessName}. Тон: ${input.tone || "нейтральный"}. Сделай 3-5 коротких предложений.`;
    const user = `Название: ${input.productName}. Категория: ${input.productCategory || "Разное"}. Характеристики: ${input.productFeatures || "Нет дополнительных данных"}.`;
    return this.callAPI(system, user);
  }
}
