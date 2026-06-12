import { NextRequest, NextResponse } from "next/server";
import { getTelegramSessionUser } from "@/lib/auth-telegram";
import { prisma } from "@/lib/prisma";
import { normalizeRuPhone } from "@/lib/phone/phone-utils";
import { classifyDatabaseError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";
import { createServerTiming } from "@/lib/server-timing";

async function resolveBusinessId(value: string) {
  if (!value) return undefined;
  const business = await prisma.business.findFirst({
    where: {
      OR: [
        { id: value },
        { slug: value },
        { slug: { equals: value, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return business?.id;
}

export async function GET(request: NextRequest) {
  const finishTiming = createServerTiming("customer_profile");
  try {
    const initData = request.headers.get("x-telegram-init-data") || "";
    if (!initData) {
      return finishTiming(NextResponse.json({ ok: false, error: "Init data missing" }, { status: 401 }));
    }

    const businessSlug = new URL(request.url).searchParams.get("businessSlug") || "";
    const businessId = await resolveBusinessId(businessSlug);
    const session = await getTelegramSessionUser(initData, businessId);

    if (!session || !session.customer) {
      return finishTiming(NextResponse.json({ ok: false, error: "Not authorized" }, { status: 401 }));
    }

    return finishTiming(NextResponse.json({
      ok: true,
      customer: {
        ...session.customer,
        telegramUserId: session.customer.telegramUserId.toString(),
      },
      telegramName: session.name,
      telegramUsername: session.username,
    }));
  } catch (error) {
    const classification = classifyDatabaseError(error);
    warnPrismaSchemaDrift("GET /api/customer/profile failed", error);
    return finishTiming(NextResponse.json(
      { ok: false, code: classification.code, error: "Профиль временно недоступен. Причина записана в server logs." },
      { status: 503 }
    ));
  }
}

export async function POST(request: NextRequest) {
  const finishTiming = createServerTiming("customer_profile_update");
  try {
    const initData = request.headers.get("x-telegram-init-data") || "";
    if (!initData) {
      return finishTiming(NextResponse.json({ ok: false, error: "Init data missing" }, { status: 401 }));
    }

    const body = await request.json();
    const { businessSlug, phone, name, address } = body;
    const businessId = await resolveBusinessId(String(businessSlug || ""));
    const session = await getTelegramSessionUser(initData, businessId);

    if (!session || !session.customer) {
      return finishTiming(NextResponse.json({ ok: false, error: "Not authorized" }, { status: 401 }));
    }

    const normalizedPhone = phone ? normalizeRuPhone(phone) : null;
    if (phone && !normalizedPhone) {
      return finishTiming(NextResponse.json({ ok: false, error: "Введите корректный номер телефона." }, { status: 400 }));
    }

    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(session.telegramUserId) },
      select: { phone: true, phoneVerified: true },
    });
    const verifiedUserPhone = user?.phoneVerified ? normalizeRuPhone(user.phone) : null;
    const phoneToSave = verifiedUserPhone || normalizedPhone || session.customer.phone;
    const isNewPhone = Boolean(phoneToSave && phoneToSave !== session.customer.phone);
    const keepVerified = Boolean(
      (session.customer.phoneVerified && phoneToSave === session.customer.phone) ||
      (verifiedUserPhone && phoneToSave === verifiedUserPhone)
    );

    const updatedCustomer = await prisma.customer.update({
      where: { id: session.customer.id },
      data: {
        phone: phoneToSave,
        name: name || session.customer.name,
        ...(address !== undefined ? { address } : {}),
        ...(keepVerified
          ? { phoneVerified: true, verificationMethod: verifiedUserPhone ? "global_user_phone" : session.customer.verificationMethod }
          : isNewPhone
            ? { phoneVerified: false, verificationMethod: "none" }
            : {}),
      },
    });

    return finishTiming(NextResponse.json({
      ok: true,
      customer: {
        ...updatedCustomer,
        telegramUserId: updatedCustomer.telegramUserId.toString(),
      },
    }));
  } catch (error) {
    const classification = classifyDatabaseError(error);
    warnPrismaSchemaDrift("POST /api/customer/profile failed", error);
    return finishTiming(NextResponse.json(
      { ok: false, code: classification.code, error: "Профиль временно недоступен. Причина записана в server logs." },
      { status: 503 }
    ));
  }
}
