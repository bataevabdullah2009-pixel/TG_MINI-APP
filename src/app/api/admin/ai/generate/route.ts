import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { getAIProviderConfig } from "@/lib/ai/ai-service";
import { estimateAiCost, getAiRouting, getDailyUsage, incrementAiUsage } from "@/lib/ai/ai-cost-control";

const featureLabels: Record<string, string> = {
  post: "пост для Telegram",
  promo: "акция",
  product_description: "описание товара или услуги",
  product_card: "product_card",
  review_reply: "ответ на отзыв",
  ideas: "идеи контента на 7 дней",
  broadcast: "текст рассылки",
  moderation: "модерация текста",
  improve: "улучшенный текст",
  business_description: "описание бизнеса",
  offer: "короткий рекламный оффер",
};

const typeContext: Record<string, string> = {
  CAFE: "Кафе: меню, комбо, доставка, акции дня. Не пиши про барбершоп, автомойку или хозтовары.",
  BARBERSHOP: "Барбершоп: стрижки, мастера, запись, уход. Не пиши про еду или автомойку.",
  SHOP: "Магазин: товары, новинки, остатки, скидки. Не выдумывай товары и цены.",
  GROCERY: "Продукты: свежесть, доставка, акции, наличие. Не выдумывай цены.",
  HARDWARE_STORE: "Хозмаг: инструменты, консультация, ремонт, крупные покупки. Не пиши про кафе.",
  CARWASH: "Автомойка: мойка, химчистка, сезонные акции, запись. Не пиши про стрижки или шаурму.",
};

const PRODUCT_CARD_FORMAT_ERROR = "ИИ вернул неверный формат. Попробуйте ещё раз.";

type ProductCard = {
  name: string;
  description: string;
  category: string;
  marketingText: string;
  imagePrompt: string;
};

function cleanJsonText(value: string) {
  return value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseProductCardResponse(raw: string): ProductCard {
  const cleaned = cleanJsonText(raw);
  let parsed: any;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!objectMatch) throw new Error("No JSON object in AI response.");
    parsed = JSON.parse(objectMatch[0]);
  }

  const card = {
    name: typeof parsed.name === "string" ? parsed.name.trim() : "",
    description: typeof parsed.description === "string" ? parsed.description.trim() : "",
    category: typeof parsed.category === "string" ? parsed.category.trim() : typeof parsed.categorySuggestion === "string" ? parsed.categorySuggestion.trim() : "",
    marketingText: typeof parsed.marketingText === "string" ? parsed.marketingText.trim() : "",
    imagePrompt: typeof parsed.imagePrompt === "string" ? parsed.imagePrompt.trim() : "",
  };

  if (!card.name || !card.description || !card.category || !card.marketingText || !card.imagePrompt) {
    throw new Error("Product card JSON misses required fields.");
  }

  return card;
}

const aiGenerateBusinessSelect = {
  id: true,
  name: true,
  type: true,
  phone: true,
  telegramUsername: true,
  telegramBotUsername: true,
  description: true,
  items: { where: { isAvailable: true }, select: { name: true, price: true, type: true } },
} as const;

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);

    const body = await request.json();
    const business = body.businessId
      ? await prisma.business.findUnique({ where: { id: body.businessId }, select: aiGenerateBusinessSelect })
      : session.businessId
        ? await prisma.business.findUnique({ where: { id: session.businessId }, select: aiGenerateBusinessSelect })
        : await prisma.business.findFirst({ where: { isActive: true }, select: aiGenerateBusinessSelect });

    if (!business) return jsonError("Бизнес не найден.", 404);
    if (!canUseBusiness(session, business.id)) return jsonError("Нет доступа к этому бизнесу.", 403);

    const routing = await getAiRouting(business.id);
    if (!routing) return jsonError("ИИ-провайдер не настроен. Проверьте OpenRouter или Polza AI в настройках.", 400);
    if (!routing.providerConfigured) {
      return jsonError(`ИИ-провайдер ${routing.provider} выбран, но не настроен. Проверьте переменные окружения.`, 400);
    }
    if ((await getDailyUsage(business.id)) >= routing.dailyLimit) {
      return jsonError("Лимит ИИ-запросов на сегодня исчерпан. Попробуйте завтра или обновите тариф.", 429);
    }

    const feature = String(body.feature || "post");
    const isProductCard = feature === "product_card" || feature === "product_description";
    const prompt = String(body.prompt || "").slice(0, 4000);
    const knownItems = business.items.map((item) => `${item.name}${item.price ? ` (${item.price} ₽)` : ""}`).join(", ") || "позиции пока не добавлены";
    
    let goal = [
      typeContext[business.type] || "Учитывай реальный тип бизнеса.",
      `Доступные товары и услуги: ${knownItems}.`,
      "Не выдумывай товары и цены. Не обещай лишнего. Пиши по-русски.",
      `Ограничение: до ${routing.maxTokens} токенов.`,
    ].join(" ");

    if (isProductCard) {
      goal += ` ВНИМАНИЕ: Верни строго валидный JSON без какого-либо дополнительного текста, markdown разметки или бэкквотов (без \`\`\`json). JSON должен строго соответствовать следующей схеме:
      {
        "name": "Название товара",
        "description": "Продающее описание товара",
        "category": "Название категории",
        "marketingText": "Короткий текст для рекламы/поста в Telegram",
        "imagePrompt": "Промпт для генерации фото товара"
      }`;
    }

    const input = {
      businessName: business.name,
      businessType: business.type,
      businessPhone: business.phone || "",
      businessUsername: business.telegramUsername || business.telegramBotUsername || "",
      contentType: isProductCard ? "product_card" : featureLabels[feature] || feature,
      productOrService: prompt || business.description || business.name,
      tone: body.tone || "дружелюбный",
      goal: goal,
    };

    const hash = crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const cached = await prisma.aICache.findUnique({ where: { businessId_feature_promptHash: { businessId: business.id, feature, promptHash: hash } } });
    
    if (cached) {
      const responseText = cached.response;
      if (isProductCard) {
        try {
          const parsed = parseProductCardResponse(responseText);
          return NextResponse.json({ ok: true, ...parsed, provider: cached.provider, model: cached.model, cached: true });
        } catch {
          console.error("Cached product_card AI response has invalid JSON:", responseText);
          return jsonError(PRODUCT_CARD_FORMAT_ERROR, 502);
        }
      }
      return NextResponse.json({ ok: true, content: cached.response, provider: cached.provider, model: cached.model, cached: true });
    }

    const provider = getAIProviderConfig(routing.provider, routing.model);
    let content = "";
    let usedProvider = provider.name;

    try {
      content = await provider.generateContent(input);
    } catch (error) {
      console.error("AI provider failed:", error);
      await incrementAiUsage(business.id, feature, usedProvider, routing.model, JSON.stringify(input).length, "FAILED");
      return jsonError("ИИ временно недоступен. Попробуйте позже.", 502);
    }

    const estimatedCost = estimateAiCost(usedProvider, JSON.stringify(input).length, content.length);

    if (isProductCard) {
      try {
        const parsed = parseProductCardResponse(content);
        const normalizedContent = JSON.stringify(parsed);
        await incrementAiUsage(business.id, feature, usedProvider, routing.model, JSON.stringify(input).length, "SUCCESS", normalizedContent.length, estimatedCost);
        await prisma.aICache.upsert({
          where: { businessId_feature_promptHash: { businessId: business.id, feature, promptHash: hash } },
          update: { response: normalizedContent, provider: usedProvider, model: routing.model, createdAt: new Date() },
          create: { businessId: business.id, feature, promptHash: hash, provider: usedProvider, model: routing.model, response: normalizedContent },
        });
        
        return NextResponse.json({
          ok: true,
          ...parsed,
          provider: usedProvider,
          model: routing.model,
          estimatedCost
        });
      } catch (e) {
        console.error("Product_card AI response has invalid JSON:", content);
        await incrementAiUsage(business.id, feature, usedProvider, routing.model, JSON.stringify(input).length, "FAILED", content.length, estimatedCost);
        return jsonError(PRODUCT_CARD_FORMAT_ERROR, 502);
      }
    }

    await incrementAiUsage(business.id, feature, usedProvider, routing.model, JSON.stringify(input).length, "SUCCESS", content.length, estimatedCost);
    await prisma.aICache.upsert({
      where: { businessId_feature_promptHash: { businessId: business.id, feature, promptHash: hash } },
      update: { response: content, provider: usedProvider, model: routing.model, createdAt: new Date() },
      create: { businessId: business.id, feature, promptHash: hash, provider: usedProvider, model: routing.model, response: content },
    });

    return NextResponse.json({ ok: true, content, provider: usedProvider, model: routing.model, estimatedCost });
  } catch (error: any) {
    console.error("POST /api/admin/ai/generate failed:", error);
    return jsonError("ИИ временно недоступен. Попробуйте позже.", 500);
  }
}
