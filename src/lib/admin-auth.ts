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

  const id = tokenUserId(request);
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    include: { business: true, ownedBusinesses: true },
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
