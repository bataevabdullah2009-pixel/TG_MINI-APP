import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, jsonError, requireRole } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session || !requireRole(session, ["SUPER_ADMIN"])) {
      return jsonError("Недостаточно прав", 403);
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const [usageLogsRaw, requestLogsRaw] = await Promise.all([
      prisma.aIUsageLog.findMany({
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          business: {
            select: { name: true },
          },
        },
      }),
      prisma.aiRequestLog.findMany({
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          business: {
            select: { name: true },
          },
        },
      }),
    ]);

    // Map logs to have businessName as expected by UI
    const usageLogs = usageLogsRaw.map((log) => ({
      id: log.id,
      businessName: log.business?.name || "Неизвестный бизнес",
      feature: log.feature,
      provider: log.provider,
      cost: log.estimatedCost || 0.0,
      chars: log.promptChars + (log.outputChars || 0),
      createdAt: log.createdAt,
    }));

    const requestLogs = requestLogsRaw.map((log) => ({
      id: log.id,
      businessName: log.business?.name || "Неизвестный бизнес",
      type: log.type,
      provider: log.provider,
      model: log.model || "",
      prompt: log.prompt,
      status: log.status,
      createdAt: log.createdAt,
    }));

    return NextResponse.json({
      ok: true,
      data: {
        usageLogs,
        requestLogs,
      },
    });
  } catch (error: any) {
    console.error("GET /api/admin/super/ai-logs failed:", error);
    return NextResponse.json({ ok: false, error: error.message || "Не удалось загрузить логи ИИ." }, { status: 500 });
  }
}
