import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, jsonError } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);

    const where =
      session.role === "SUPER_ADMIN"
        ? {}
        : { isActive: true, id: session.businessId || "__none__" };

    const businesses = await prisma.business.findMany({
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        templateKey: true,
        description: true,
        logoUrl: true,
        coverImageUrl: true,
        primaryColor: true,
        accentColor: true,
        phone: true,
        address: true,
        isOpen: true,
        accessStatus: true,
        planType: true,
        paidAmount: true,
        paidAt: true,
        blockedReason: true,
        archivedAt: true,
        subscriptionStatus: true,
        subscriptionPlan: { select: { name: true } },
        _count: { select: { orders: true, bookings: true, customers: true, items: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, data: businesses });
  } catch (error) {
    console.error("GET /api/admin/businesses failed:", error);
    return jsonError("Не удалось загрузить список бизнесов.", 500);
  }
}
