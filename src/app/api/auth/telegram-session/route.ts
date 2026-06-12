import { NextResponse } from "next/server";
import { getTelegramSessionUser } from "@/lib/auth-telegram";
import { classifyDatabaseError, toJsonSafe, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";
import { createServerTiming } from "@/lib/server-timing";

export async function POST(req: Request) {
  const finishTiming = createServerTiming("telegram_session");
  try {
    const { initData, businessId } = await req.json();

    if (!initData) {
      return finishTiming(NextResponse.json({ ok: false, error: "Параметр initData отсутствует." }, { status: 400 }));
    }

    const session = await getTelegramSessionUser(initData, businessId);

    if (!session) {
      return finishTiming(NextResponse.json(
        { ok: false, error: "Пользователь не авторизован или недействительная подпись Telegram." },
        { status: 401 }
      ));
    }

    return finishTiming(NextResponse.json({ ok: true, data: toJsonSafe(session) }));
  } catch (e) {
    const classification = classifyDatabaseError(e);
    warnPrismaSchemaDrift("Telegram session/profile sync failed", e);
    return finishTiming(NextResponse.json(
      {
        ok: false,
        code: classification.code,
        error: "Не удалось загрузить профиль Telegram. Повторите попытку; причина записана в server logs.",
      },
      { status: 503 }
    ));
  }
}
