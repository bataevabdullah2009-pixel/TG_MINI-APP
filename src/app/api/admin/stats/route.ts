import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    const where = businessId ? { businessId } : {};

    const [
      totalBusinesses,
      totalOrders,
      totalBookings,
      totalCustomers,
      recentOrders,
      recentBookings,
      ordersByStatus,
    ] = await Promise.all([
      prisma.business.count({ where: { isActive: true } }),
      prisma.order.count({ where }),
      prisma.booking.count({ where }),
      prisma.customer.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          items: true,
          business: { select: { name: true, slug: true } },
        },
      }),
      prisma.booking.findMany({
        where,
        orderBy: { startTime: "asc" },
        take: 5,
        include: {
          service: { select: { name: true } },
          business: { select: { name: true } },
        },
      }),
      prisma.order.groupBy({
        by: ["status"],
        where,
        _count: { id: true },
        _sum: { totalPrice: true },
      }),
    ]);

    const revenue = ordersByStatus
      .filter((s) => s.status !== "CANCELLED")
      .reduce((sum, s) => sum + (s._sum.totalPrice || 0), 0);

    return NextResponse.json({
      totalBusinesses,
      totalOrders,
      totalBookings,
      totalCustomers,
      revenue,
      recentOrders,
      recentBookings,
      ordersByStatus,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
