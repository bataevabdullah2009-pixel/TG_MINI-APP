import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { getAiRouting, getDailyUsage, getMonthlyUsage } from "@/lib/ai/ai-cost-control";

const adminAiBusinessSelect = {
  id: true,
  name: true,
  type: true,
  templateKey: true,
} as const;

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);

    const { searchParams } = new URL(request.url);
    const value = searchParams.get("businessId") || session.businessId || undefined;
    const business = value
      ? await prisma.business.findFirst({ where: { OR: [{ id: value }, { slug: value }] }, select: adminAiBusinessSelect })
      : await prisma.business.findFirst({ where: { isActive: true }, select: adminAiBusinessSelect });

    if (!business) return jsonError("Бизнес не найден.", 404);
    if (!canUseBusiness(session, business.id)) return jsonError("Нет доступа к этому бизнесу.", 403);

    const routing = await getAiRouting(business.id);
    return NextResponse.json({
      ok: true,
      businessId: business.id,
      businessName: business.name,
      businessType: business.type,
      templateKey: business.templateKey,
      provider: routing?.provider || "mock",
      model: routing?.model || "mock",
      plan: routing?.plan || "FREE",
      dailyLimit: routing?.dailyLimit || 5,
      maxTokens: routing?.maxTokens || 300,
      dailyUsage: await getDailyUsage(business.id),
      monthlyUsage: await getMonthlyUsage(business.id),
    });
  } catch (error) {
    console.error("GET /api/admin/ai failed:", error);
    return jsonError("Не удалось загрузить ИИ-маркетинг.", 500);
  }
}
