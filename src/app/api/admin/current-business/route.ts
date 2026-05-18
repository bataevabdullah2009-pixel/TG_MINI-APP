import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);

    const { searchParams } = new URL(request.url);
    const value = searchParams.get("businessId") || session.businessId || undefined;
    const business = value
      ? await prisma.business.findFirst({ where: { OR: [{ id: value }, { slug: value }] }, include: { settings: true } })
      : await prisma.business.findFirst({ where: { isActive: true }, include: { settings: true } });

    if (!business) return jsonError("Бизнес не найден.", 404);
    if (!canUseBusiness(session, business.id)) return jsonError("Нет доступа к этому бизнесу.", 403);

    return NextResponse.json({ ok: true, data: { ...business, telegramAdminChatId: business.telegramAdminChatId?.toString() || null } });
  } catch (error) {
    console.error("GET /api/admin/current-business failed:", error);
    return jsonError("Не удалось загрузить настройки бизнеса.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);
    if (session.role === "MANAGER") return jsonError("У менеджера нет доступа к настройкам.", 403);

    const body = await request.json();
    const businessId = body.businessId || session.businessId;
    if (!businessId) return jsonError("Бизнес не выбран.", 400);
    if (!canUseBusiness(session, businessId)) return jsonError("Нет доступа к этому бизнесу.", 403);

    // Convert telegramAdminChatId to BigInt safely
    let telegramAdminChatIdValue = undefined;
    if (body.telegramAdminChatId !== undefined) {
      if (body.telegramAdminChatId === null || body.telegramAdminChatId === "") {
        telegramAdminChatIdValue = null;
      } else {
        try {
          telegramAdminChatIdValue = BigInt(body.telegramAdminChatId);
        } catch (e) {
          return jsonError("Некорректный ID чата Telegram (должен быть числом).", 400);
        }
      }
    }

    const business = await prisma.business.update({
      where: { id: businessId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.primaryColor !== undefined ? { primaryColor: body.primaryColor } : {}),
        ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
        ...(body.coverImageUrl !== undefined ? { coverImageUrl: body.coverImageUrl } : {}),
        ...(body.telegramBotToken !== undefined ? { telegramBotToken: body.telegramBotToken } : {}),
        ...(body.telegramBotUsername !== undefined ? { telegramBotUsername: body.telegramBotUsername } : {}),
        ...(body.telegramUsername !== undefined ? { telegramUsername: body.telegramUsername } : {}),
        ...(telegramAdminChatIdValue !== undefined ? { telegramAdminChatId: telegramAdminChatIdValue } : {}),
      },
      include: { settings: true },
    });

    return NextResponse.json({ ok: true, data: { ...business, telegramAdminChatId: business.telegramAdminChatId?.toString() || null } });
  } catch (error) {
    console.error("PATCH /api/admin/current-business failed:", error);
    return jsonError("Не удалось сохранить настройки бизнеса.", 500);
  }
}
