import { NextResponse } from "next/server";
import { getTelegramSessionUser } from "@/lib/auth-telegram";
import { PhoneVerificationService } from "@/lib/phone/phone-verification-service";
import { prisma } from "@/lib/prisma";

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

    // Call service to verify via Telegram Contact
    const res = await PhoneVerificationService.verifyViaTelegramContact(session.customer.id, phone);

    if (!res.success) {
      return NextResponse.json({ ok: false, error: res.error || "Не удалось сохранить телефон." }, { status: 500 });
    }

    if (session.adminUser?.id) {
      await prisma.user.update({
        where: { id: session.adminUser.id },
        data: { phone },
      });
    }

    return NextResponse.json({ ok: true, phone });
  } catch (e: any) {
    console.error("[verify-contact api error]", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
