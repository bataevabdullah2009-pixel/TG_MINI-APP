import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();

  // Find business by id or slug
  let business = await prisma.business.findFirst({
    where: { OR: [{ id: slug }, { slug: slug }] },
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

  // Auto-create "Основное" category if no active categories exist
  if (business.categories.length === 0) {
    const defaultCategory = await prisma.category.create({
      data: {
        businessId: business.id,
        name: "Основное",
        isActive: true,
        sortOrder: 0,
      },
    });
    // Assign created category back to the business categories list
    (business as any).categories = [{ ...defaultCategory, items: [] }];
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
