import { NextRequest, NextResponse } from "next/server";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getAdminSession(request);
  if (!session) return jsonError("Нужен вход в панель продавца.", 401);
  const businessId = new URL(request.url).searchParams.get("businessId") || session.businessId;
  if (!businessId || !canUseBusiness(session, businessId)) return jsonError("Нет доступа к зонам доставки.", 403);

  const zones = await prisma.deliveryZone.findMany({ where: { businessId }, orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  return NextResponse.json({ ok: true, zones });
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession(request);
  if (!session) return jsonError("Нужен вход в панель продавца.", 401);
  if (session.role === "MANAGER") return jsonError("У менеджера нет доступа к зонам доставки.", 403);

  const body = await request.json();
  const businessId = body.businessId || session.businessId;
  if (!businessId || !canUseBusiness(session, businessId)) return jsonError("Нет доступа к зонам доставки.", 403);
  if (!String(body.name || "").trim() || !String(body.cityArea || "").trim()) return jsonError("Укажите название и город/район.", 400);

  const zone = await prisma.deliveryZone.create({
    data: {
      businessId,
      name: String(body.name).trim(),
      cityArea: String(body.cityArea).trim(),
      fee: Math.max(0, Number(body.fee) || 0),
      estimatedMinutes: body.estimatedMinutes ? Math.max(1, Math.round(Number(body.estimatedMinutes))) : null,
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
    },
  });
  return NextResponse.json({ ok: true, zone }, { status: 201 });
}
