import { NextResponse } from "next/server";
import { getTelegramSessionUser } from "@/lib/auth-telegram";
import { toJsonSafe } from "@/lib/prisma-schema-guard";

export async function POST(req: Request) {
  try {
    const { initData, businessId } = await req.json();

    if (!initData) {
      return NextResponse.json({ ok: false, error: "Параметр initData отсутствует." }, { status: 400 });
    }

    const session = await getTelegramSessionUser(initData, businessId);

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Пользователь не авторизован или недействительная подпись Telegram." },
        { status: 401 }
      );
    }

    return NextResponse.json({ ok: true, data: toJsonSafe(session) });
  } catch (e) {
    console.error("[telegram-session api error]", e);
    return NextResponse.json({
      ok: false,
      error: "Профиль Telegram временно недоступен. Каталог можно открыть без профиля.",
    });
  }
}
