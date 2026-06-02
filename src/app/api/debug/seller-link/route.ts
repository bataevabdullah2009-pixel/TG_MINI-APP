import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, jsonError, requireRole } from "@/lib/admin-auth";
import { normalizeSellerLinkCode } from "@/lib/seller-link";

export async function GET(request: NextRequest) {
  const session = await getAdminSession(request);
  if (process.env.NODE_ENV === "production" && (!session || !requireRole(session, ["SUPER_ADMIN"]))) {
    return jsonError("Недостаточно прав.", 403);
  }

  const { searchParams } = new URL(request.url);
  const code = normalizeSellerLinkCode(searchParams.get("code") || "");

  if (!code) {
    return jsonError("Укажите код продавца из 6 символов.", 400);
  }

  const user = await prisma.user.findUnique({
    where: { telegramLinkCode: code },
    select: {
      id: true,
      email: true,
      role: true,
      businessId: true,
      telegramLinkExpiresAt: true,
    },
  });

  const now = new Date();

  return NextResponse.json({
    exists: Boolean(user),
    expired: user ? !user.telegramLinkExpiresAt || user.telegramLinkExpiresAt <= now : false,
    userId: user?.id || null,
    email: user?.email || null,
    role: user?.role || null,
    businessId: user?.businessId || null,
    expiresAt: user?.telegramLinkExpiresAt?.toISOString() || null,
  });
}
