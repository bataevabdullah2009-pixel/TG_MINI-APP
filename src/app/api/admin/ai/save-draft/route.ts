import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);

    const body = await request.json();
    const businessId = body.businessId || session.businessId;
    if (!businessId) return jsonError("Бизнес не выбран.", 400);
    if (!canUseBusiness(session, businessId)) return jsonError("Нет доступа к этому бизнесу.", 403);

    const draft = await prisma.marketingPost.create({
      data: {
        businessId,
        title: body.title || "Черновик ИИ-маркетинга",
        content: body.content || "",
        type: body.type || "post",
        status: body.status || "draft",
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        createdByAi: true,
        provider: body.provider || null,
        model: body.model || null,
      },
    });

    return NextResponse.json({ ok: true, data: draft }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/ai/save-draft failed:", error);
    return jsonError("Не удалось сохранить черновик.", 500);
  }
}
