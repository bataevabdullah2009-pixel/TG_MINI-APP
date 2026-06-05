import { NextResponse } from "next/server";
import { getTelegramSessionUser } from "@/lib/auth-telegram";
import { normalizeRuPhone } from "@/lib/phone/phone-utils";
import { prisma } from "@/lib/prisma";

const PHONE_VERIFICATION_UNAVAILABLE = "Подтверждение телефона временно недоступно.";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const initData = req.headers.get("x-telegram-init-data") || "";
    const businessId = String(body.businessId || "");

    if (!initData || !businessId) {
      return NextResponse.json({ ok: false, error: "Нужна авторизация через Telegram." }, { status: 401 });
    }

    const session = await getTelegramSessionUser(initData, businessId);
    if (!session || !session.customer) {
      return NextResponse.json({ ok: false, error: "Нужна авторизация через Telegram." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(session.telegramUserId) },
      select: { phone: true, phoneVerified: true },
    });
    const verifiedPhone = session.customer.phoneVerified
      ? normalizeRuPhone(session.customer.phone)
      : user?.phoneVerified
        ? normalizeRuPhone(user.phone)
        : null;

    if (!verifiedPhone) {
      return NextResponse.json(
        { ok: false, pending: true, error: "Ожидаем Telegram contact." },
        { status: 202 }
      );
    }

    if (!session.customer.phoneVerified || normalizeRuPhone(session.customer.phone) !== verifiedPhone) {
      await prisma.customer.update({
        where: { id: session.customer.id },
        data: {
          phone: verifiedPhone,
          phoneVerified: true,
          verificationMethod: session.customer.phoneVerified ? session.customer.verificationMethod : "global_user_phone",
        },
        select: { id: true },
      });
    }

    return NextResponse.json({ ok: true, phone: verifiedPhone });
  } catch (error) {
    console.error("[verify-contact api error]", error);
    return NextResponse.json({ ok: false, error: PHONE_VERIFICATION_UNAVAILABLE }, { status: 503 });
  }
}
