import { NextRequest, NextResponse } from "next/server";
import { getTelegramSessionUser } from "@/lib/auth-telegram";
import { prisma } from "@/lib/prisma";

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
      const biz = await prisma.business.findUnique({ where: { slug: businessSlug } });
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
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const initData = request.headers.get("x-telegram-init-data") || "";
    if (!initData) {
      return NextResponse.json({ ok: false, error: "Init data missing" }, { status: 401 });
    }

    const body = await request.json();
    const { businessSlug, phone, name } = body;

    let businessId = undefined;
    if (businessSlug) {
      const biz = await prisma.business.findUnique({ where: { slug: businessSlug } });
      businessId = biz?.id;
    }

    const session = await getTelegramSessionUser(initData, businessId);
    if (!session || !session.customer) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 401 });
    }

    const isNewPhone = phone && phone !== session.customer.phone;

    const updatedCustomer = await prisma.customer.update({
      where: { id: session.customer.id },
      data: {
        phone: phone || session.customer.phone,
        name: name || session.customer.name,
        ...(isNewPhone ? { phoneVerified: false, verificationMethod: null } : {}),
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
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
