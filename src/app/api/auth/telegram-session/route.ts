import { NextResponse } from "next/server";
import { getTelegramSessionUser } from "@/lib/auth-telegram";

export async function POST(req: Request) {
  try {
    const { initData, businessId } = await req.json();

    if (!initData) {
      return NextResponse.json({ ok: false, error: "Параметр initData отсутствует." }, { status: 400 });
    }

    const session = await getTelegramSessionUser(initData, businessId);

    if (!session) {
      return NextResponse.json({ ok: false, error: "Пользователь не авторизован или недействительная подпись Telegram." }, { status: 401 });
    }

    // Convert BigInt to string/number safely in JSON response
    const safeSession = JSON.parse(
      JSON.stringify(session, (key, value) => (typeof value === "bigint" ? value.toString() : value))
    );

    return NextResponse.json({ ok: true, data: safeSession });
  } catch (e: any) {
    console.error("[telegram-session api error]", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
