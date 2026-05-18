import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();

  const business = await prisma.business.findUnique({
    where: { slug },
    include: {
      categories: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            where: {
              isAvailable: true,
              ...(search ? { name: { contains: search } } : {}),
            },
            orderBy: [{ isPopular: "desc" }, { sortOrder: "asc" }],
          },
        },
      },
      items: {
        where: {
          isAvailable: true,
          ...(search ? { name: { contains: search } } : {}),
        },
        include: { category: true },
        orderBy: [{ isPopular: "desc" }, { sortOrder: "asc" }],
      },
      staff: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!business || !business.isActive) {
    return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
  }

  return NextResponse.json({
    business: {
      ...business,
      telegramAdminChatId: business.telegramAdminChatId?.toString() || null,
    },
    categories: business.categories,
    items: business.items,
    staff: business.staff,
  });
}
