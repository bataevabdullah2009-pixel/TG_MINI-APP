import { prisma } from "@/lib/prisma";

export interface EnsureTelegramUserInput {
  telegramId: string | number | bigint;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}

export async function ensureTelegramUser(input: EnsureTelegramUserInput) {
  const telegramIdBigInt = BigInt(input.telegramId);
  const name = [input.firstName, input.lastName].filter(Boolean).join(" ") || input.username || `User_${input.telegramId}`;

  // Find User by telegramId
  const existing = await prisma.user.findUnique({
    where: { telegramId: telegramIdBigInt },
  });

  if (existing) {
    // Update existing user properties
    return await prisma.user.update({
      where: { telegramId: telegramIdBigInt },
      data: {
        username: input.username || existing.username,
        name: name || existing.name,
        phone: input.phone || existing.phone,
      },
    });
  }

  // Create new user
  return await prisma.user.create({
    data: {
      telegramId: telegramIdBigInt,
      username: input.username || null,
      name: name || null,
      phone: input.phone || null,
      role: "CUSTOMER",
    },
  });
}
