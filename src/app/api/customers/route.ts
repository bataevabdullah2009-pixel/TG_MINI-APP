import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    }

    const customers = await prisma.customer.findMany({
      where: {
        businessId,
      },
      include: {
        _count: {
          select: {
            orders: true,
            bookings: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // CRITICAL: Safely convert BigInt (telegramUserId) to string to prevent JSON serialization crash!
    const serializedCustomers = customers.map((c) => ({
      ...c,
      telegramUserId: c.telegramUserId.toString(),
    }));

    return NextResponse.json(serializedCustomers);
  } catch (error) {
    console.error("GET Customers API Error:", error);
    return NextResponse.json({ error: "Ошибка при загрузке базы клиентов" }, { status: 500 });
  }
}
