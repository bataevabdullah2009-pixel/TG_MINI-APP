import { AIProvider } from "./provider";
import { enforcePromptLength } from "./ai-cost-control";

type PolzaMessage =
  | { role: "system" | "user"; content: string }
  | { role: "user"; content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> };

type PolzaResponse = {
  choices?: Array<{
    text?: unknown;
    finish_reason?: unknown;
    message?: {
      content?: unknown;
    };
  }>;
};

function extractContentPart(part: unknown): string {
  if (typeof part === "string") return part;
  if (!part || typeof part !== "object") return "";

  const value = part as { text?: unknown; content?: unknown };
  if (typeof value.text === "string") return value.text;
  if (typeof value.content === "string") return value.content;
  return "";
}

export function extractPolzaText(data: PolzaResponse): string {
  const choice = data.choices?.[0];
  const content = choice?.message?.content;

  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const combined = content.map(extractContentPart).filter(Boolean).join("\n").trim();
    if (combined) return combined;
  }
  if (typeof choice?.text === "string" && choice.text.trim()) return choice.text.trim();

  console.error("[POLZA AI ERROR] Empty response content", {
    choicesCount: data.choices?.length || 0,
    choiceKeys: choice ? Object.keys(choice) : [],
    messageKeys: choice?.message ? Object.keys(choice.message) : [],
    finishReason: choice?.finish_reason,
  });
  throw new Error("Polza AI returned an empty response");
}

export function getPolzaChatEndpoint() {
  const chatUrl = process.env.POLZA_CHAT_BASE_URL?.trim();
  if (chatUrl) return chatUrl;

  const baseUrl = (process.env.POLZA_BASE_URL || "https://polza.ai/api/v1").trim().replace(/\/$/, "");
  return baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;
}

export class PolzaAIProvider implements AIProvider {
  name = "polza";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = process.env.POLZA_TEXT_MODEL || "z-ai/glm-4.7-flash") {
    this.apiKey = apiKey;
    this.model = model || process.env.POLZA_TEXT_MODEL || "z-ai/glm-4.7-flash";
  }

  getDebugInfo() {
    return {
      provider: this.name,
      model: this.model,
      hasPolzaKey: Boolean(this.apiKey),
      endpoint: getPolzaChatEndpoint(),
    };
  }

  private async callAPI(
    system: string,
    user: string,
    options: {
      maxTokens?: number;
      temperature?: number;
      model?: string;
      messages?: PolzaMessage[];
      responseFormat?: { type: "json_object" };
    } = {}
  ): Promise<string> {
    if (!this.apiKey) {
      console.error("[AI CONFIG ERROR] POLZA_AI_API_KEY missing");
      throw new Error("POLZA_AI_API_KEY missing");
    }

    const envMaxTokens = parseInt(process.env.AI_MAX_OUTPUT_TOKENS || "500", 10);
    const maxTokens = options.maxTokens ? Math.max(envMaxTokens, options.maxTokens) : envMaxTokens;
    const temperature = options.temperature ?? parseFloat(process.env.AI_TEMPERATURE || "0.7");
    const endpoint = getPolzaChatEndpoint();
    const model = options.model || this.model;
    const messages = options.messages || [
      { role: "system" as const, content: system },
      { role: "user" as const, content: enforcePromptLength(user) },
    ];

    console.info("[AI CONFIG] provider", {
      provider: this.name,
      model,
      endpoint,
      hasApiKey: Boolean(this.apiKey),
    });

    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
            reasoning: {
              enabled: false,
              exclude: true,
            },
            ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
          }),
          signal: AbortSignal.timeout(45_000),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error("[POLZA AI ERROR]", {
            status: res.status,
            responsePreview: errorText.slice(0, 500),
            model,
            endpoint,
            attempt,
          });
          throw new Error(`Polza AI API request failed with status ${res.status}`);
        }

        const data = (await res.json()) as PolzaResponse;
        console.info("[POLZA AI] request ok", { model, endpoint, attempt });
        return extractPolzaText(data);
      } catch (error) {
        lastError = error;
        console.error("[POLZA AI] request error", {
          model,
          endpoint,
          attempt,
          reason: error instanceof Error ? error.message : String(error),
        });
        if (attempt < 2) {
          console.warn("[POLZA AI RETRY]", {
            model,
            endpoint,
            attempt,
            reason: error instanceof Error ? error.message : String(error),
          });
          await new Promise((resolve) => setTimeout(resolve, 750));
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Polza AI API request failed");
  }

  async generateFAQAnswer(input: any): Promise<string> {
    const system = [
      `Ты вежливый помощник бизнеса "${input.businessName}" (${input.businessType}).`,
      "Отвечай коротко, по делу и только на основе базы знаний.",
      "Если данных нет, спокойно предложи открыть раздел Мои заказы или связаться с продавцом.",
      `База знаний: ${input.knowledgeBase}`,
    ].join(" ");

    return this.callAPI(system, input.customerQuestion, { temperature: 0.3 });
  }

  async generateContent(input: any): Promise<string> {
    if (input.contentType === "product_card" || input.contentType === "productCard") {
      const system = [
        "Ты помогаешь продавцу заполнить карточку товара в Telegram Mini App.",
        "Верни ТОЛЬКО валидный JSON. Без markdown, без ```json, без code fence, без пояснений и без текста вокруг JSON.",
        "Схема строго такая: {\"title\":\"string\",\"shortDescription\":\"string\",\"description\":\"string\",\"categorySuggestion\":\"string\",\"tags\":[\"string\"],\"tgPost\":\"string\"}.",
        "Все строковые поля обязательны и должны быть непустыми.",
        "Пиши на русском языке.",
        "Не выдумывай цену и факты, которых нет во входных данных.",
      ].join(" ");
      const user = [
        `Бизнес: ${input.businessName}. Тип бизнеса: ${input.businessType}.`,
        `Данные товара: ${input.productOrService || "не указаны"}.`,
        `Тон: ${input.tone || "дружелюбный"}.`,
        `Категории и ограничения: ${input.goal || "используй только факты из данных"}.`,
      ].join("\n");
      return this.callAPI(system, user, {
        maxTokens: 1200,
        temperature: 0.3,
        responseFormat: { type: "json_object" },
      });
    }

    const system = `Ты профессиональный SMM и маркетолог. Напиши контент формата "${input.contentType}" для бизнеса ${input.businessName}. Тон: ${input.tone || "продающий"}.`;
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
    return this.callAPI(system, user, { temperature: 0.2 });
  }

  async analyzeImageJson(input: {
    imageUrl: string;
    system: string;
    user: string;
    model?: string;
  }): Promise<string> {
    const messages: PolzaMessage[] = [
      { role: "system", content: input.system },
      {
        role: "user",
        content: [
          { type: "text", text: enforcePromptLength(input.user) },
          { type: "image_url", image_url: { url: input.imageUrl } },
        ],
      },
    ];

    return this.callAPI(input.system, input.user, {
      model: input.model || process.env.POLZA_VISION_MODEL || process.env.POLZA_IMAGE_MODEL || this.model,
      maxTokens: 1200,
      temperature: 0.1,
      messages,
    });
  }

  async generateStrictJson(input: { system: string; user: string; model?: string }): Promise<string> {
    return this.callAPI(input.system, input.user, {
      model: input.model || this.model,
      maxTokens: 1200,
      temperature: 0.1,
      responseFormat: { type: "json_object" },
    });
  }

  async generateProductDescription(input: any): Promise<string> {
    const system = `Ты копирайтер. Напиши описание товара/услуги для ${input.businessName}. Тон: ${input.tone || "нейтральный"}. Сделай 3-5 коротких предложений.`;
    const user = `Название: ${input.productName}. Категория: ${input.productCategory || "Разное"}. Характеристики: ${input.productFeatures || "Нет дополнительных данных"}.`;
    return this.callAPI(system, user);
  }
}
