import { NextRequest, NextResponse } from "next/server";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { toJsonSafe } from "@/lib/prisma-schema-guard";
import { canBusinessOperate } from "@/lib/subscriptions/business-subscription-service";

function parseTelegramId(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  try {
    return BigInt(String(value));
  } catch {
    return undefined;
  }
}

export async function GET(request: NextRequest) {
  const session = await getAdminSession(request);
  if (!session) return jsonError("Нужен вход в панель продавца.", 401);
  const businessId = new URL(request.url).searchParams.get("businessId") || session.businessId;
  if (!businessId || !canUseBusiness(session, businessId)) return jsonError("Нет доступа к курьерам.", 403);

  const couriers = await prisma.courier.findMany({
    where: { businessId },
    include: {
      assignments: {
        where: { status: { in: ["ASSIGNED", "ACCEPTED_BY_COURIER", "PICKED_UP"] } },
        include: { order: { select: { id: true, status: true, customerAddress: true } } },
      },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return NextResponse.json(toJsonSafe({ ok: true, couriers }));
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession(request);
  if (!session) return jsonError("Нужен вход в панель продавца.", 401);
  if (session.role === "MANAGER") return jsonError("У менеджера нет доступа к курьерам.", 403);

  const body = await request.json();
  const businessId = body.businessId || session.businessId;
  if (!businessId || !canUseBusiness(session, businessId)) return jsonError("Нет доступа к курьерам.", 403);
  if (session.role !== "SUPER_ADMIN") {
    const access = await canBusinessOperate(businessId);
    if (!access.canUseDelivery) {
      return jsonError(access.reason || "Управление курьерами временно недоступно.", 403);
    }
  }

  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const telegramId = parseTelegramId(body.telegramId);
  if (!name || !phone) return jsonError("Укажите имя и телефон курьера.", 400);
  if (telegramId === undefined) return jsonError("Telegram ID должен быть числом.", 400);

  if (telegramId) {
    const existingUser = await prisma.user.findUnique({ where: { telegramId }, select: { id: true, role: true } });
    if (existingUser && !["CUSTOMER", "COURIER"].includes(existingUser.role)) {
      return jsonError("Этот Telegram ID уже принадлежит пользователю с другой ролью.", 409);
    }
  }

  const courier = await prisma.$transaction(async (tx) => {
    let userId: string | null = null;
    if (telegramId) {
      const user = await tx.user.upsert({
        where: { telegramId },
        update: { name, phone, role: "COURIER", businessId, isActive: body.isActive === undefined ? true : Boolean(body.isActive) },
        create: { telegramId, name, phone, role: "COURIER", businessId, isActive: body.isActive === undefined ? true : Boolean(body.isActive) },
      });
      userId = user.id;
    }

    if (telegramId) {
      return tx.courier.upsert({
        where: { businessId_telegramId: { businessId, telegramId } },
        update: { userId, name, phone, cityArea: body.cityArea || null, isActive: body.isActive === undefined ? true : Boolean(body.isActive) },
        create: { businessId, userId, name, phone, telegramId, cityArea: body.cityArea || null, isActive: body.isActive === undefined ? true : Boolean(body.isActive) },
      });
    }

    return tx.courier.create({
      data: { businessId, name, phone, cityArea: body.cityArea || null, isActive: body.isActive === undefined ? true : Boolean(body.isActive) },
    });
  });

  return NextResponse.json(toJsonSafe({ ok: true, courier }), { status: 201 });
}
