import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId") || session.businessId;
    const type = searchParams.get("type");
    if (!businessId) return jsonError("Бизнес не выбран.", 400);
    if (!canUseBusiness(session, businessId)) return jsonError("Нет доступа к этому бизнесу.", 403);

    const drafts = await prisma.marketingPost.findMany({
      where: { businessId, ...(type && type !== "all" ? { type } : {}) },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, data: drafts });
  } catch (error) {
    console.error("GET /api/admin/ai/drafts failed:", error);
    return jsonError("Не удалось загрузить черновики.", 500);
  }
}
