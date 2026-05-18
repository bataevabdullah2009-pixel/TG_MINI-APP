import { NextResponse } from "next/server";
import { getTelegramSessionUser } from "@/lib/auth-telegram";
import { PhoneVerificationService } from "@/lib/phone/phone-verification-service";

export async function POST(req: Request) {
  try {
    const { phone, initData, businessId } = await req.json();

    if (!phone || !initData || !businessId) {
      return NextResponse.json({ ok: false, error: "Не все параметры переданы." }, { status: 400 });
    }

    // Resolve user
    const session = await getTelegramSessionUser(initData, businessId);
    if (!session || !session.customer) {
      return NextResponse.json({ ok: false, error: "Пользователь не авторизован через Telegram." }, { status: 401 });
    }

    // Call service to send code
    const res = await PhoneVerificationService.sendCode(session.customer.id, phone, "mock_sms");

    if (!res.success) {
      return NextResponse.json({ ok: false, error: res.error || "Не удалось отправить код." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, verificationId: res.verificationId });
  } catch (e: any) {
    console.error("[send-code api error]", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
