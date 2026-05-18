import { NextResponse } from "next/server";
import { getTelegramSessionUser } from "@/lib/auth-telegram";
import { PhoneVerificationService } from "@/lib/phone/phone-verification-service";

export async function POST(req: Request) {
  try {
    const { phone, code, initData, businessId } = await req.json();

    if (!phone || !code || !initData || !businessId) {
      return NextResponse.json({ ok: false, error: "Не все параметры переданы." }, { status: 400 });
    }

    // Resolve user
    const session = await getTelegramSessionUser(initData, businessId);
    if (!session || !session.customer) {
      return NextResponse.json({ ok: false, error: "Пользователь не авторизован через Telegram." }, { status: 401 });
    }

    // Call service to verify code
    const res = await PhoneVerificationService.verifyCode(session.customer.id, phone, code);

    if (!res.success) {
      return NextResponse.json({ ok: false, error: res.error || "Неверный код." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[verify-code api error]", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
