import { NextRequest, NextResponse } from "next/server";
import { AIService } from "@/lib/ai/ai-service";
import { aiRawPreview, safeParseAiJson, validateProductCardJson } from "@/lib/ai/safe-ai-json";
import { prisma } from "@/lib/prisma";

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

    if (!prompt || !type) {
      return NextResponse.json({ error: "Укажите задачу и тип генерации." }, { status: 400 });
    }

    const business = businessId
      ? await prisma.business.findUnique({ where: { id: businessId }, select: aiContentBusinessSelect })
      : await prisma.business.findFirst({ select: aiContentBusinessSelect });

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
              "{\"name\":\"string\",\"description\":\"string\",\"category\":\"string\",\"marketingText\":\"string\",\"imagePrompt\":\"string\"}",
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
    return NextResponse.json({ error: error.message || "Ошибка генерации ИИ. Попробуйте позже." }, { status: 500 });
  }
}
