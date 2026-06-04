import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { isPrismaMissingColumnError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";

export interface EnsureTelegramUserInput {
  telegramId: string | number | bigint;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  phoneVerified: true,
  phoneVerifiedAt: true,
  telegramId: true,
  username: true,
  telegramLinkCode: true,
  telegramLinkExpiresAt: true,
  role: true,
  businessId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export async function trySyncUserPhone(
  userId: string,
  phone: string | null | undefined,
  options: { verified?: boolean; context?: string } = {}
) {
  if (!phone) return false;

  const data: Prisma.UserUpdateInput = { phone };
  if (options.verified !== undefined) {
    data.phoneVerified = options.verified;
    data.phoneVerifiedAt = options.verified ? new Date() : null;
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true },
    });
    return true;
  } catch (error) {
    if (
      isPrismaMissingColumnError(error, "User", "phone") ||
      isPrismaMissingColumnError(error, "User", "phoneVerified") ||
      isPrismaMissingColumnError(error, "User", "phoneVerifiedAt")
    ) {
      warnPrismaSchemaDrift(options.context || "User phone sync skipped", error);
      return false;
    }
    throw error;
  }
}

export async function ensureTelegramUser(input: EnsureTelegramUserInput) {
  const telegramIdBigInt = BigInt(input.telegramId);
  const name = [input.firstName, input.lastName].filter(Boolean).join(" ") || input.username || `User_${input.telegramId}`;

  // Find User by telegramId
  const existing = await prisma.user.findUnique({
    where: { telegramId: telegramIdBigInt },
    select: SAFE_USER_SELECT,
  });

  if (existing) {
    // Update existing user properties
    const updated = await prisma.user.update({
      where: { telegramId: telegramIdBigInt },
      data: {
        username: input.username || existing.username,
        name: name || existing.name,
      },
      select: SAFE_USER_SELECT,
    });

    await trySyncUserPhone(updated.id, input.phone, { context: "ensureTelegramUser existing user" });
    return { ...updated, phone: input.phone || null };
  }

  // Create new user
  const created = await prisma.user.create({
    data: {
      telegramId: telegramIdBigInt,
      username: input.username || null,
      name: name || null,
      role: "CUSTOMER",
    },
    select: SAFE_USER_SELECT,
  });

  await trySyncUserPhone(created.id, input.phone, { context: "ensureTelegramUser new user" });
  return { ...created, phone: input.phone || null };
}
