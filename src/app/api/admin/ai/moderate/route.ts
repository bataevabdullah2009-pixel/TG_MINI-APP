import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, jsonError } from "@/lib/admin-auth";
import { canBusinessOperate } from "@/lib/subscriptions/business-subscription-service";

const risky = ["гарантируем лечение", "100% результат", "самый дешёвый в мире", "лучший на рынке"];

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);
    if (session.role !== "SUPER_ADMIN" && session.businessId) {
      const access = await canBusinessOperate(session.businessId);
      if (!access.canUseAI) {
        return jsonError(access.reason || "ИИ временно недоступен.", 403);
      }
    }

    const { text = "", action = "improve" } = await request.json();
    const warnings: string[] = [];
    let improved = String(text).trim().replace(/!{2,}/g, "!");

    for (const phrase of risky) {
      const regexp = new RegExp(phrase, "ig");
      if (regexp.test(improved)) {
        warnings.push(`Убрано рискованное обещание: «${phrase}».`);
        improved = improved.replace(regexp, "поможем подобрать подходящее решение");
      }
    }

    if (action === "shorten") improved = improved.split(/\s+/).slice(0, 45).join(" ");
    if (action === "telegram") improved = `${improved}\n\nНапишите нам в Telegram, чтобы уточнить детали.`;
    if (action === "selling") improved = `${improved}\n\nПредложение действует при наличии свободных позиций.`;
    if (action === "story") improved = improved.split(".").filter(Boolean).slice(0, 2).join(". ") + ".";

    if (!warnings.length) warnings.push("Критичных рисков не найдено.");
    return NextResponse.json({ ok: true, improved, warnings });
  } catch (error) {
    console.error("POST /api/admin/ai/moderate failed:", error);
    return jsonError("Не удалось проверить текст.", 500);
  }
}
