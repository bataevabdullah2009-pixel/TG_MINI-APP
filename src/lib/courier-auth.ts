import { NextRequest } from "next/server";
import { getTelegramSessionUser } from "@/lib/auth-telegram";
import { prisma } from "@/lib/prisma";

export async function getCourierAccess(request: NextRequest) {
  const initData = request.headers.get("x-telegram-init-data") || "";
  if (!initData) return { authenticated: false as const, session: null, courier: null };

  const session = await getTelegramSessionUser(initData);
  if (!session) return { authenticated: false as const, session: null, courier: null };

  const telegramId = BigInt(session.telegramUserId);
  const courier = await prisma.courier.findFirst({
    where: {
      isActive: true,
      OR: [
        ...(session.adminUser?.id ? [{ userId: session.adminUser.id }] : []),
        { telegramId },
      ],
    },
    include: {
      business: { select: { id: true, slug: true, name: true, address: true, phone: true } },
    },
  });

  return {
    authenticated: true as const,
    session,
    courier: session.role === "COURIER" ? courier : null,
  };
}
