import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, requireRole, canUseBusiness, jsonError } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const limit = parseInt(searchParams.get("limit") || "20");

    const businesses = await prisma.business.findMany({
      where: {
        isActive: true,
        ...(businessId ? { id: businessId } : {}),
      },
      include: {
        _count: {
          select: {
            orders: true,
            customers: true,
            items: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(
      businesses.map((business) => ({
        ...business,
        telegramAdminChatId: business.telegramAdminChatId?.toString() || null,
      }))
    );
  } catch (error) {
    console.error("Error fetching businesses:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session || !requireRole(session, ["SUPER_ADMIN"])) {
      return jsonError("Недостаточно прав", 403);
    }

    const body = await request.json();
    const { slug, name, type, description, primaryColor, accentColor } = body;

    const existing = await prisma.business.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "Slug already taken" }, { status: 400 });
    }

    const business = await prisma.business.create({
      data: {
        slug,
        name,
        type: type || "CUSTOM",
        description,
        primaryColor: primaryColor || "#3B82F6",
        accentColor: accentColor || "#FF6347",
      },
    });

    return NextResponse.json(
      { ...business, telegramAdminChatId: business.telegramAdminChatId?.toString() || null },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating business:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) {
      return jsonError("Нужен вход в админку.", 401);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return jsonError("Не передан ID бизнеса.", 400);
    }

    if (!canUseBusiness(session, id)) {
      return jsonError("Нет доступа к этому бизнесу.", 403);
    }

    const body = await request.json();
    const {
      name,
      description,
      phone,
      email,
      primaryColor,
      accentColor,
      telegramUsername,
      telegramAdminChatId,
      isActive,
      deliveryFee,
      minOrderAmount,
    } = body;

    const updated = await prisma.business.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(primaryColor !== undefined ? { primaryColor } : {}),
        ...(accentColor !== undefined ? { accentColor } : {}),
        ...(telegramUsername !== undefined ? { telegramUsername } : {}),
        ...(telegramAdminChatId !== undefined ? { telegramAdminChatId } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(deliveryFee !== undefined || minOrderAmount !== undefined
          ? {
              settings: {
                update: {
                  ...(deliveryFee !== undefined ? { deliveryFee: parseFloat(deliveryFee || "0") } : {}),
                  ...(minOrderAmount !== undefined ? { minOrderAmount: parseFloat(minOrderAmount || "0") } : {}),
                },
              },
            }
          : {}),
      },
      include: {
        settings: true,
      },
    });

    return NextResponse.json({ ...updated, telegramAdminChatId: updated.telegramAdminChatId?.toString() || null });
  } catch (error) {
    console.error("PATCH Business error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
