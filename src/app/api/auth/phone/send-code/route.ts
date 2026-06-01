import { NextResponse } from "next/server";
import { getTelegramSessionUser } from "@/lib/auth-telegram";
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

    const res = await PhoneVerificationService.sendCode(session.customer.id, phone, "mock_sms");

    if (!res.success) {
      return NextResponse.json({ ok: false, error: PHONE_VERIFICATION_UNAVAILABLE }, { status: 503 });
    }

    return NextResponse.json({ ok: true, verificationId: res.verificationId });
  } catch (e) {
    console.error("[send-code api error]", e);
    return NextResponse.json({ ok: false, error: PHONE_VERIFICATION_UNAVAILABLE }, { status: 503 });
  }
}
