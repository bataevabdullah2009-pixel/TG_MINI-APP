import { prisma } from "@/lib/prisma";
import { ensureTelegramUser } from "../auth/telegram-user-service";

export interface EnsureCustomerForTelegramUserInput {
  telegramId: string | number | bigint;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  businessId?: string | null;
}

export async function ensureCustomerForTelegramUser(input: EnsureCustomerForTelegramUserInput) {
  const telegramUserId = BigInt(input.telegramId);

  // 1. Ensure User is created first
  const user = await ensureTelegramUser({
    telegramId: input.telegramId,
    username: input.username,
    firstName: input.firstName,
    lastName: input.lastName,
  });

  const businessId = (input.businessId && input.businessId !== "global") ? input.businessId : null;

  if (businessId) {
    // Find customer by unique businessId and telegramUserId index
    const existing = await prisma.customer.findUnique({
      where: {
        businessId_telegramUserId: {
          businessId,
          telegramUserId,
        },
      },
    });

    if (existing) {
      return await prisma.customer.update({
        where: { id: existing.id },
        data: {
          userId: user.id,
          phone: input.phone ?? existing.phone,
          username: input.username || existing.username,
          name: [input.firstName, input.lastName].filter(Boolean).join(" ") || existing.name,
        },
      });
    }

    return await prisma.customer.create({
      data: {
        businessId,
        userId: user.id,
        telegramUserId,
        name: [input.firstName, input.lastName].filter(Boolean).join(" ") || input.username || `Customer_${input.telegramId}`,
        username: input.username || null,
        phone: input.phone || null,
        phoneVerified: false,
        verificationMethod: "none",
      },
    });
  } else {
    // Global customer lookup (where businessId is null)
    const existing = await prisma.customer.findFirst({
      where: {
        telegramUserId,
        businessId: null,
      },
    });

    if (existing) {
      return await prisma.customer.update({
        where: { id: existing.id },
        data: {
          userId: user.id,
          phone: input.phone ?? existing.phone,
          username: input.username || existing.username,
          name: [input.firstName, input.lastName].filter(Boolean).join(" ") || existing.name,
        },
      });
    }

    return await prisma.customer.create({
      data: {
        businessId: null,
        userId: user.id,
        telegramUserId,
        name: [input.firstName, input.lastName].filter(Boolean).join(" ") || input.username || `Customer_${input.telegramId}`,
        username: input.username || null,
        phone: input.phone || null,
        phoneVerified: false,
        verificationMethod: "none",
      },
    });
  }
}
