import { NextResponse } from "next/server";
import { getTelegramSessionUser } from "@/lib/auth-telegram";
import { classifyDatabaseError, toJsonSafe, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";

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
    const classification = classifyDatabaseError(e);
    warnPrismaSchemaDrift("Telegram session/profile sync failed", e);
    return NextResponse.json(
      {
        ok: false,
        code: classification.code,
        error: "Не удалось загрузить профиль Telegram. Повторите попытку; причина записана в server logs.",
      },
      { status: 503 }
    );
  }
}
