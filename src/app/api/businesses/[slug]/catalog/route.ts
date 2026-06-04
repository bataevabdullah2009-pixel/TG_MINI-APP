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
      secondaryColor: true,
      backgroundColor: true,
      accentColor: true,
      phone: true,
      email: true,
      address: true,
      latitude: true,
      longitude: true,
      telegramUrl: true,
      whatsappUrl: true,
      instagramUrl: true,
      telegramBotUsername: true,
      telegramUsername: true,
      telegramAdminChatId: true,
      currency: true,
      language: true,
      timezone: true,
      subscriptionStatus: true,
      subscriptionPlanId: true,
      subscriptionStartDate: true,
      subscriptionEndDate: true,
      modulesEnabled: true,
      aiProvider: true,
      aiModel: true,
      aiEnabled: true,
      aiDailyLimit: true,
      aiMonthlyLimit: true,
      transferPaymentEnabled: true,
      transferBankName: true,
      transferPaymentPhone: true,
      transferRecipientName: true,
      transferPaymentCommentRequired: true,
      transferPaymentInstructions: true,
      isActive: true,
      isOpen: true,
      ownerId: true,
      createdAt: true,
      updatedAt: true,
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
