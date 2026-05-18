import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
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
      success: true,
      stats: {
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
  } catch (error) {
    console.error("Super Admin stats API error:", error);
    return NextResponse.json({ error: "Ошибка сбора статистики" }, { status: 500 });
  }
}
