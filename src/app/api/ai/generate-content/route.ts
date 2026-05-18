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

    const content = await AIService.generateContent(
      business.id,
      business.aiProvider || "mock",
      business.aiModel || "",
      {
        businessName: business.name,
        businessType: business.type,
        contentType: type,
        productOrService: prompt,
        tone: tone || "продающий",
        goal: goal || "привлечь внимание",
      }
    );

    return NextResponse.json({ content });
  } catch (error: any) {
    console.error("AI Content Generation Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
