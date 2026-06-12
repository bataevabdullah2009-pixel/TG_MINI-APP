import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId") || session.businessId;
    const requestedLimit = Number(searchParams.get("limit") || 50);
    const take = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100) : 50;
    if (!businessId) return jsonError("Бизнес не выбран.", 400);
    if (!canUseBusiness(session, businessId)) return jsonError("Нет доступа к этому бизнесу.", 403);

    const customers = await prisma.customer.findMany({
      where: { businessId },
      include: { _count: { select: { orders: true, bookings: true } } },
      orderBy: { createdAt: "desc" },
      take,
    });

    return NextResponse.json({
      ok: true,
      data: customers.map((customer) => ({ ...customer, telegramUserId: customer.telegramUserId.toString() })),
    });
  } catch (error) {
    console.error("GET /api/admin/customers failed:", error);
    return jsonError("Не удалось загрузить клиентов.", 500);
  }
}
