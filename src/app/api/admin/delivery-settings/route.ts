import { NextRequest, NextResponse } from "next/server";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  SELLER_BLOCKED_MESSAGE,
  canBusinessOperate,
} from "@/lib/subscriptions/business-subscription-service";

function numberOrDefault(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

export async function GET(request: NextRequest) {
  const session = await getAdminSession(request);
  if (!session) return jsonError("Нужен вход в панель продавца.", 401);

  const businessId = new URL(request.url).searchParams.get("businessId") || session.businessId;
  if (!businessId || !canUseBusiness(session, businessId)) return jsonError("Нет доступа к настройкам доставки.", 403);

  const settings = await prisma.businessSettings.upsert({
    where: { businessId },
    update: {},
    create: { businessId },
  });
  const zones = await prisma.deliveryZone.findMany({ where: { businessId }, orderBy: [{ isActive: "desc" }, { name: "asc" }] });

  return NextResponse.json({ ok: true, settings, zones });
}

export async function PATCH(request: NextRequest) {
  const session = await getAdminSession(request);
  if (!session) return jsonError("Нужен вход в панель продавца.", 401);
  if (session.role === "MANAGER") return jsonError("У менеджера нет доступа к настройкам доставки.", 403);

  const body = await request.json();
  const businessId = body.businessId || session.businessId;
  if (!businessId || !canUseBusiness(session, businessId)) return jsonError("Нет доступа к настройкам доставки.", 403);
  if (session.role !== "SUPER_ADMIN") {
    const access = await canBusinessOperate(businessId);
    if (!access.canUseDelivery) {
      return jsonError(access.reason || SELLER_BLOCKED_MESSAGE, 403);
    }
  }

  const settings = await prisma.businessSettings.upsert({
    where: { businessId },
    update: {
      ...(body.deliveryEnabled !== undefined ? { deliveryEnabled: Boolean(body.deliveryEnabled) } : {}),
      ...(body.pickupEnabled !== undefined ? { pickupEnabled: Boolean(body.pickupEnabled) } : {}),
      ...(body.minOrderAmount !== undefined ? { minOrderAmount: numberOrDefault(body.minOrderAmount, 0) } : {}),
      ...(body.pickupWaitHours !== undefined ? { pickupWaitHours: Math.max(1, Math.round(numberOrDefault(body.pickupWaitHours, 24))) } : {}),
      ...(body.courierAcceptanceMinutes !== undefined ? { courierAcceptanceMinutes: Math.max(1, Math.round(numberOrDefault(body.courierAcceptanceMinutes, 30))) } : {}),
    },
    create: {
      businessId,
      deliveryEnabled: Boolean(body.deliveryEnabled),
      pickupEnabled: body.pickupEnabled === undefined ? true : Boolean(body.pickupEnabled),
      minOrderAmount: numberOrDefault(body.minOrderAmount, 0),
      pickupWaitHours: Math.max(1, Math.round(numberOrDefault(body.pickupWaitHours, 24))),
      courierAcceptanceMinutes: Math.max(1, Math.round(numberOrDefault(body.courierAcceptanceMinutes, 30))),
    },
  });

  return NextResponse.json({ ok: true, settings });
}
