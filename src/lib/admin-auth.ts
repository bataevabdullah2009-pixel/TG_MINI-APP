import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export type AdminSession = {
  id: string;
  email: string | null;
  role: "SUPER_ADMIN" | "BUSINESS_OWNER" | "MANAGER" | "CUSTOMER";
  businessId: string | null;
  businessSlug: string | null;
};

function safeJson(value?: string): any | null {
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value));
  } catch {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}

function tokenUserId(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : request.cookies.get("accessToken")?.value || "";
  const match = token.match(/^token-(.+)-\d+$/);
  return match?.[1] || null;
}

export async function getAdminSession(request: NextRequest): Promise<AdminSession | null> {
  // 1. Try authorizing via Telegram WebApp initData header or query parameter
  let tgInitData = request.headers.get("x-telegram-init-data") || "";
  if (!tgInitData) {
    try {
      const url = new URL(request.url);
      tgInitData = url.searchParams.get("initData") || "";
    } catch {}
  }

  if (tgInitData) {
    try {
      const { getTelegramSessionUser } = await import("@/lib/auth-telegram");
      const tgSession = await getTelegramSessionUser(tgInitData);
      
      if (tgSession && (tgSession.role === "SUPER_ADMIN" || tgSession.role === "BUSINESS_OWNER" || tgSession.role === "MANAGER")) {
        const adminUser = tgSession.adminUser;
        const bizId = tgSession.businessId || adminUser?.businessId || null;
        
        let businessSlug = adminUser?.business?.slug || null;
        if (!businessSlug && bizId) {
          const biz = await prisma.business.findUnique({ where: { id: bizId }, select: { slug: true } });
          businessSlug = biz?.slug || null;
        }

        return {
          id: adminUser?.id || `tg-${tgSession.telegramUserId}`,
          email: adminUser?.email || null,
          role: tgSession.role,
          businessId: bizId,
          businessSlug,
        };
      }
    } catch (err) {
      console.error("[getAdminSession] Failed to verify telegram session:", err);
    }
  }

  // 2. Fallback to standard cookie session
  const cookieUser = safeJson(request.cookies.get("adminUser")?.value);
  if (cookieUser?.id && cookieUser?.role) {
    return {
      id: cookieUser.id,
      email: cookieUser.email || null,
      role: cookieUser.role,
      businessId: cookieUser.businessId || null,
      businessSlug: cookieUser.businessSlug || null,
    };
  }

  // 3. Fallback to token header
  const id = tokenUserId(request);
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      businessId: true,
      isActive: true,
      business: { select: { id: true, slug: true } },
      ownedBusinesses: { select: { id: true, slug: true } },
    },
  });
  if (!user || !user.isActive || user.role === "CUSTOMER") return null;

  const business = user.business || user.ownedBusinesses[0] || null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    businessId: business?.id || null,
    businessSlug: business?.slug || null,
  };
}

export function jsonError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

export function businessScope(session: AdminSession, requestedBusinessId?: string | null) {
  if (session.role === "SUPER_ADMIN") {
    return requestedBusinessId ? { id: requestedBusinessId } : {};
  }

  if (!session.businessId) return { id: "__none__" };
  if (requestedBusinessId && requestedBusinessId !== session.businessId) return { id: "__forbidden__" };
  return { id: session.businessId };
}

export function canUseBusiness(session: AdminSession, businessId: string) {
  return session.role === "SUPER_ADMIN" || session.businessId === businessId;
}

export function requireRole(session: AdminSession, allowedRoles: ("SUPER_ADMIN" | "BUSINESS_OWNER" | "MANAGER" | "CUSTOMER")[]) {
  return allowedRoles.includes(session.role);
}

export async function getCurrentBusinessForSeller(session: AdminSession) {
  if (session.role === "SUPER_ADMIN") {
    const firstActive = await prisma.business.findFirst({ where: { isActive: true }, select: { id: true } });
    return session.businessId || firstActive?.id || null;
  }
  return session.businessId;
}
