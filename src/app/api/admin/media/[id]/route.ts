import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { canBusinessOperate } from "@/lib/subscriptions/business-subscription-service";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);

    const { id } = await context.params;
    const asset = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) return jsonError("Файл не найден.", 404);
    if (!canUseBusiness(session, asset.businessId)) return jsonError("Нет доступа к этому бизнесу.", 403);
    if (session.role !== "SUPER_ADMIN") {
      const access = await canBusinessOperate(asset.businessId);
      if (!access.canManageProducts) {
        return jsonError(access.reason || "Удаление файлов временно недоступно.", 403);
      }
    }

    await prisma.mediaAsset.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/media/[id] failed:", error);
    return jsonError("Не удалось удалить файл.", 500);
  }
}
