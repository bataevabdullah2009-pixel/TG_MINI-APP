import { NextRequest, NextResponse } from "next/server";
import { AIService } from "@/lib/ai/ai-service";
import { aiRawPreview, safeParseAiJson, validateProductCardJson } from "@/lib/ai/safe-ai-json";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession } from "@/lib/admin-auth";

const aiContentBusinessSelect = {
  id: true,
  name: true,
  type: true,
  aiProvider: true,
  aiModel: true,
} as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, prompt, type, tone, goal } = body;
    const session = await getAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: "Нужен вход в панель продавца." }, { status: 401 });
    }

    if (!prompt || !type) {
      return NextResponse.json({ error: "Укажите задачу и тип генерации." }, { status: 400 });
    }

    const targetBusinessId = businessId || session.businessId;
    if (!targetBusinessId) {
      return NextResponse.json({ error: "Выберите бизнес для генерации." }, { status: 400 });
    }
    if (!canUseBusiness(session, targetBusinessId)) {
      return NextResponse.json({ error: "Нет доступа к этому бизнесу." }, { status: 403 });
    }

    const business = await prisma.business.findUnique({ where: { id: targetBusinessId }, select: aiContentBusinessSelect });

    if (!business) {
      return NextResponse.json({ error: "Бизнес не найден." }, { status: 404 });
    }

    const isProductCard = type === "product_card" || type === "productCard";
    const input = {
      businessName: business.name,
      businessType: business.type,
      contentType: isProductCard ? "product_card" : type,
      productOrService: prompt,
      tone: tone || "продающий",
      goal: goal || "привлечь внимание",
    };

    const content = await AIService.generateContent(
      business.id,
      business.aiProvider || "mock",
      business.aiModel || "",
      input
    );

    if (isProductCard) {
      try {
        return NextResponse.json({
          ok: true,
          ...safeParseAiJson(content, validateProductCardJson),
        });
      } catch (firstParseError) {
        console.error("Failed to parse product_card JSON:", {
          error: firstParseError,
          raw: content,
        });

        const repaired = await AIService.generateContent(
          business.id,
          business.aiProvider || "mock",
          business.aiModel || "",
          {
            ...input,
            productOrService: [
              "Исправь этот ответ в валидный JSON строго по схеме:",
              "{\"title\":\"string\",\"shortDescription\":\"string\",\"description\":\"string\",\"categorySuggestion\":\"string\",\"tags\":[\"string\"],\"tgPost\":\"string\"}",
              "Верни только JSON без markdown и пояснений.",
              "",
              "Исходный ответ:",
              content,
            ].join("\n"),
          }
        );

        try {
          return NextResponse.json({
            ok: true,
            ...safeParseAiJson(repaired, validateProductCardJson),
            repaired: true,
          });
        } catch (repairError) {
          console.error("Failed to repair product_card JSON:", {
            error: repairError,
            raw: repaired,
          });
          return NextResponse.json({
            error: "ИИ вернул неверный формат. Попробуйте ещё раз.",
            rawPreview: aiRawPreview(repaired || content),
          }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ content });
  } catch (error: any) {
    console.error("AI Content Generation Error:", error);
    return NextResponse.json({ error: "ИИ временно недоступен. Попробуйте позже." }, { status: 500 });
  }
}
