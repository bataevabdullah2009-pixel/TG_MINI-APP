import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, jsonError, requireRole } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session || !requireRole(session, ["SUPER_ADMIN"])) {
      return jsonError("Недостаточно прав", 403);
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalBusinesses,
      activeBusinesses,
      totalOrdersToday,
      aiQueriesToday,
      totalCustomers,
      revenueResult,
      planStats,
    ] = await Promise.all([
      // Total count
      prisma.business.count(),
      // Active count
      prisma.business.count({ where: { isActive: true } }),
      // Today's orders
      prisma.order.count({
        where: {
          createdAt: { gte: todayStart },
        },
      }),
      // Today's AI logs
      prisma.aIUsageLog.count({
        where: {
          createdAt: { gte: todayStart },
        },
      }),
      // Total platform customers
      prisma.customer.count(),
      // Total order revenue
      prisma.order.aggregate({
        where: {
          status: { not: "CANCELLED" },
        },
        _sum: {
          totalPrice: true,
        },
      }),
      // Active subscription breakdown
      prisma.business.groupBy({
        by: ["subscriptionStatus"],
        _count: {
          id: true,
        },
      }),
    ]);

    const totalRevenue = revenueResult._sum.totalPrice || 0;

    return NextResponse.json({
      ok: true,
      data: {
        totalBusinesses,
        activeBusinesses,
        totalOrdersToday,
        aiQueriesToday,
        totalCustomers,
        totalRevenue,
        planStats: planStats.map((item) => ({
          status: item.subscriptionStatus,
          count: item._count.id,
        })),
      },
    });
  } catch (error: any) {
    console.error("Super Admin stats API error:", error);
    return NextResponse.json({ ok: false, error: error.message || "Ошибка сбора статистики" }, { status: 500 });
  }
}
