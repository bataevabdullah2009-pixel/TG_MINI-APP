import { NextResponse } from "next/server";
import { getTelegramSessionUser } from "@/lib/auth-telegram";
import { trySyncUserPhone } from "@/lib/auth/telegram-user-service";
import { PhoneVerificationService } from "@/lib/phone/phone-verification-service";

const PHONE_VERIFICATION_UNAVAILABLE = "Подтверждение телефона временно недоступно.";

export async function POST(req: Request) {
  try {
    const { phone, initData, businessId } = await req.json();

    if (!phone || !initData || !businessId) {
      return NextResponse.json({ ok: false, error: "Переданы не все параметры." }, { status: 400 });
    }

    const session = await getTelegramSessionUser(initData, businessId);
    if (!session || !session.customer) {
      return NextResponse.json({ ok: false, error: "Нужна авторизация через Telegram." }, { status: 401 });
    }

    const res = await PhoneVerificationService.verifyViaTelegramContact(session.customer.id, phone);

    if (!res.success) {
      return NextResponse.json({ ok: false, error: PHONE_VERIFICATION_UNAVAILABLE }, { status: 503 });
    }

    if (session.adminUser?.id) {
      await trySyncUserPhone(session.adminUser.id, phone, {
        verified: true,
        context: "verify-contact user phone sync",
      });
    }

    return NextResponse.json({ ok: true, phone });
  } catch (e) {
    console.error("[verify-contact api error]", e);
    return NextResponse.json({ ok: false, error: PHONE_VERIFICATION_UNAVAILABLE }, { status: 503 });
  }
}
