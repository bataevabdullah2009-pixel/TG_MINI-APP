import { NextRequest, NextResponse } from "next/server";
import { getTelegramSessionUser } from "@/lib/auth-telegram";
import { toJsonSafe } from "@/lib/prisma-schema-guard";

export async function GET(request: NextRequest) {
  try {
    const initData = request.headers.get("x-telegram-init-data") || "";
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId") || undefined;

    if (!initData) {
      return NextResponse.json({ ok: true, data: null });
    }

    const session = await getTelegramSessionUser(initData, businessId);
    return NextResponse.json({ ok: true, data: session ? toJsonSafe(session) : null });
  } catch (error) {
    console.error("GET /api/me failed:", error);
    return NextResponse.json({
      ok: true,
      data: null,
      warning: "Profile is temporarily unavailable.",
    });
  }
}
