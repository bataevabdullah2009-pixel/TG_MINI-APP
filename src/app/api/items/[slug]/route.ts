import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const search = searchParams.get("search");

    const business = await prisma.business.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Бизнес не найден." }, { status: 404 });
    }

    const where: any = {
      businessId: business.id,
      isAvailable: true,
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.name = {
        contains: search,
        mode: "insensitive",
      };
    }

    const items = await prisma.item.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ isPopular: "desc" }, { sortOrder: "asc" }],
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching items:", error);
    return NextResponse.json({ error: "Не удалось загрузить товары." }, { status: 500 });
  }
}
