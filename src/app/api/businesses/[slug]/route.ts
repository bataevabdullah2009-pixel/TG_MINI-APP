import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, jsonError } from "@/lib/admin-auth";

const businessDetailSelect = {
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
  isActive: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  settings: true,
  categories: { where: { isActive: true } },
} as const;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const business = await prisma.business.findUnique({
      where: { slug },
      select: businessDetailSelect,
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...business,
      telegramAdminChatId: business.telegramAdminChatId?.toString() || null,
    });
  } catch (error) {
    console.error("Error fetching business:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);
    if (session.role !== "SUPER_ADMIN") return jsonError("Недостаточно прав.", 403);

    const { slug } = await context.params;
    const body = await request.json();
    const business = await prisma.business.findFirst({
      where: { OR: [{ id: slug }, { slug }] },
      select: { id: true },
    });

    if (!business) return jsonError("Бизнес не найден.", 404);

    const updated = await prisma.business.update({
      where: { id: business.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.primaryColor !== undefined ? { primaryColor: body.primaryColor } : {}),
        ...(body.accentColor !== undefined ? { accentColor: body.accentColor } : {}),
        ...(body.subscriptionStatus !== undefined ? { subscriptionStatus: body.subscriptionStatus } : {}),
        ...(body.subscriptionPlanId !== undefined ? { subscriptionPlanId: body.subscriptionPlanId } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        ...(body.isDemo !== undefined ? { isDemo: Boolean(body.isDemo) } : {}),
        ...(body.ownerId !== undefined ? { ownerId: body.ownerId || null } : {}),
      },
      select: {
        ...businessDetailSelect,
        _count: { select: { orders: true, customers: true, items: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      data: { ...updated, telegramAdminChatId: updated.telegramAdminChatId?.toString() || null },
    });
  } catch (error) {
    console.error("PATCH /api/businesses/[slug] failed:", error);
    return jsonError("Не удалось обновить бизнес.", 500);
  }
}
