import { NextRequest, NextResponse } from "next/server";
import { AIService } from "@/lib/ai/ai-service";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, prompt, type, tone, goal } = body;

    if (!prompt || !type) {
      return NextResponse.json({ error: "Missing required fields (prompt, type)" }, { status: 400 });
    }

    let business;
    if (businessId) {
      business = await prisma.business.findUnique({ where: { id: businessId } });
    } else {
      business = await prisma.business.findFirst();
    }

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const isProductCard = type === "product_card" || type === "productCard";

    const content = await AIService.generateContent(
      business.id,
      business.aiProvider || "mock",
      business.aiModel || "",
      {
        businessName: business.name,
        businessType: business.type,
        contentType: isProductCard ? "product_card" : type,
        productOrService: prompt,
        tone: tone || "продающий",
        goal: goal || "привлечь внимание",
      }
    );

    if (isProductCard) {
      try {
        const cleanContent = content.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        const parsed = JSON.parse(cleanContent);
        return NextResponse.json(parsed);
      } catch (err) {
        console.error("Failed to parse product_card JSON:", err);
        return NextResponse.json({
          name: prompt || "Новый товар",
          description: content,
          category: "Разное",
          marketingText: content,
          imagePrompt: `photo of ${prompt || "item"}, clean background, photorealistic`
        });
      }
    }

    return NextResponse.json({ content });
  } catch (error: any) {
    console.error("AI Content Generation Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
