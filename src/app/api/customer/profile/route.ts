import { NextRequest, NextResponse } from "next/server";
import { getTelegramSessionUser } from "@/lib/auth-telegram";
import { prisma } from "@/lib/prisma";
import { normalizeRuPhone } from "@/lib/phone/phone-utils";

export async function GET(request: NextRequest) {
  try {
    const initData = request.headers.get("x-telegram-init-data") || "";
    if (!initData) {
      return NextResponse.json({ ok: false, error: "Init data missing" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const businessSlug = searchParams.get("businessSlug") || "";

    let businessId = undefined;
    if (businessSlug) {
      const biz = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true } });
      businessId = biz?.id;
    }

    const session = await getTelegramSessionUser(initData, businessId);
    if (!session || !session.customer) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      customer: {
        ...session.customer,
        telegramUserId: session.customer.telegramUserId.toString(),
      },
      telegramName: session.name,
      telegramUsername: session.username,
    });
  } catch (error: any) {
    console.error("GET /api/customer/profile failed:", error);
    return NextResponse.json({ ok: false, error: "Profile is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const initData = request.headers.get("x-telegram-init-data") || "";
    if (!initData) {
      return NextResponse.json({ ok: false, error: "Init data missing" }, { status: 401 });
    }

    const body = await request.json();
    const { businessSlug, phone, name, address } = body;

    let businessId = undefined;
    if (businessSlug) {
      const biz = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true } });
      businessId = biz?.id;
    }

    const session = await getTelegramSessionUser(initData, businessId);
    if (!session || !session.customer) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 401 });
    }

    const normalizedPhone = phone ? normalizeRuPhone(phone) : null;
    if (phone && !normalizedPhone) {
      return NextResponse.json({ ok: false, error: "Введите корректный номер телефона." }, { status: 400 });
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

    return NextResponse.json({
      ok: true,
      customer: {
        ...updatedCustomer,
        telegramUserId: updatedCustomer.telegramUserId.toString(),
      },
    });
  } catch (error: any) {
    console.error("POST /api/customer/profile failed:", error);
    return NextResponse.json({ ok: false, error: "Profile is temporarily unavailable." }, { status: 503 });
  }
}
