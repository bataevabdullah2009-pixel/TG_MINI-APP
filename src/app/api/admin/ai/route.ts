import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { getAiRouting, getDailyUsage, getMonthlyUsage } from "@/lib/ai/ai-cost-control";
import {
  SELLER_BLOCKED_MESSAGE,
  canBusinessOperate,
} from "@/lib/subscriptions/business-subscription-service";

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
    if (!value) return jsonError("Выберите бизнес для ИИ-маркетинга.", 400);
    const business = await prisma.business.findFirst({ where: { OR: [{ id: value }, { slug: value }] }, select: adminAiBusinessSelect });

    if (!business) return jsonError("Бизнес не найден.", 404);
    if (!canUseBusiness(session, business.id)) return jsonError("Нет доступа к этому бизнесу.", 403);
    if (session.role !== "SUPER_ADMIN") {
      const access = await canBusinessOperate(business.id);
      if (!access.canUseAI) {
        return jsonError(access.reason || SELLER_BLOCKED_MESSAGE, 403);
      }
    }

    const routing = await getAiRouting(business.id);
    return NextResponse.json({
      ok: true,
      businessId: business.id,
      businessName: business.name,
      businessType: business.type,
      templateKey: business.templateKey,
      provider: routing?.provider || (process.env.NODE_ENV === "production" ? "polza" : "mock"),
      model: routing?.model || "not-configured",
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
