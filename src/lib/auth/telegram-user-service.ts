import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isPrismaMissingColumnError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";

export interface EnsureTelegramUserInput {
  telegramId: string | number | bigint;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  phoneVerified?: boolean;
}

const LEGACY_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  telegramId: true,
  username: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const PROFILE_USER_SELECT = {
  ...LEGACY_USER_SELECT,
  phone: true,
  phoneVerified: true,
} satisfies Prisma.UserSelect;

const CURRENT_USER_SELECT = {
  ...PROFILE_USER_SELECT,
  businessId: true,
  isActive: true,
} satisfies Prisma.UserSelect;

type TelegramUserRecord = Prisma.UserGetPayload<{ select: typeof LEGACY_USER_SELECT }> & {
  businessId: string | null;
  isActive: boolean;
  phone: string | null;
  phoneVerified: boolean;
  phoneVerifiedAt: Date | null;
  telegramLinkCode: string | null;
  telegramLinkExpiresAt: Date | null;
};

function withLegacyDefaults(user: Prisma.UserGetPayload<{ select: typeof LEGACY_USER_SELECT }>): TelegramUserRecord {
  return {
    ...user,
    businessId: null,
    isActive: true,
    phone: null,
    phoneVerified: false,
    phoneVerifiedAt: null,
    telegramLinkCode: null,
    telegramLinkExpiresAt: null,
  };
}

function withProfileDefaults(
  user: Prisma.UserGetPayload<{ select: typeof PROFILE_USER_SELECT }>
): TelegramUserRecord {
  return {
    ...user,
    businessId: null,
    isActive: true,
    phoneVerifiedAt: null,
    telegramLinkCode: null,
    telegramLinkExpiresAt: null,
  };
}

function withCurrentDefaults(
  user: Prisma.UserGetPayload<{ select: typeof CURRENT_USER_SELECT }>
): TelegramUserRecord {
  return {
    ...user,
    phoneVerifiedAt: null,
    telegramLinkCode: null,
    telegramLinkExpiresAt: null,
  };
}

async function findTelegramUser(telegramId: bigint): Promise<TelegramUserRecord | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: CURRENT_USER_SELECT,
    });
    return user ? withCurrentDefaults(user) : null;
  } catch (error) {
    if (!isPrismaMissingColumnError(error)) throw error;
    warnPrismaSchemaDrift("Telegram user loaded without optional account columns", error);
    try {
      const profileUser = await prisma.user.findUnique({ where: { telegramId }, select: PROFILE_USER_SELECT });
      return profileUser ? withProfileDefaults(profileUser) : null;
    } catch (profileError) {
      if (!isPrismaMissingColumnError(profileError)) throw profileError;
      const legacyUser = await prisma.user.findUnique({ where: { telegramId }, select: LEGACY_USER_SELECT });
      return legacyUser ? withLegacyDefaults(legacyUser) : null;
    }
  }
}

async function updateTelegramUser(
  telegramId: bigint,
  data: Prisma.UserUpdateInput
): Promise<TelegramUserRecord> {
  try {
    const user = await prisma.user.update({
      where: { telegramId },
      data,
      select: CURRENT_USER_SELECT,
    });
    return withCurrentDefaults(user);
  } catch (error) {
    if (!isPrismaMissingColumnError(error)) throw error;
    warnPrismaSchemaDrift("Telegram user updated without optional account columns", error);
    try {
      return withProfileDefaults(await prisma.user.update({ where: { telegramId }, data, select: PROFILE_USER_SELECT }));
    } catch (profileError) {
      if (!isPrismaMissingColumnError(profileError)) throw profileError;
      return withLegacyDefaults(await prisma.user.update({ where: { telegramId }, data, select: LEGACY_USER_SELECT }));
    }
  }
}

async function createTelegramUser(
  telegramId: bigint,
  name: string,
  username?: string | null
): Promise<TelegramUserRecord> {
  try {
    const user = await prisma.user.create({
      data: {
        telegramId,
        username: username || null,
        name: name || null,
        role: "CUSTOMER",
      },
      select: CURRENT_USER_SELECT,
    });
    return withCurrentDefaults(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrentUser = await findTelegramUser(telegramId);
      if (concurrentUser) {
        return updateTelegramUser(telegramId, {
          username: username || concurrentUser.username,
          name: name || concurrentUser.name,
        });
      }
    }
    if (!isPrismaMissingColumnError(error)) throw error;
    warnPrismaSchemaDrift("Telegram user created without optional account columns", error);
    const data = { telegramId, username: username || null, name: name || null, role: "CUSTOMER" as const };
    try {
      return withProfileDefaults(await prisma.user.create({ data, select: PROFILE_USER_SELECT }));
    } catch (profileError) {
      if (!isPrismaMissingColumnError(profileError)) throw profileError;
      return withLegacyDefaults(await prisma.user.create({ data, select: LEGACY_USER_SELECT }));
    }
  }
}

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
    if (options.verified !== undefined && isPrismaMissingColumnError(error, "User", "phoneVerifiedAt")) {
      warnPrismaSchemaDrift(options.context || "User phone sync retried without phoneVerifiedAt", error);
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { phone, phoneVerified: options.verified },
          select: { id: true },
        });
        return true;
      } catch (retryError) {
        if (!isPrismaMissingColumnError(retryError)) throw retryError;
        warnPrismaSchemaDrift(options.context || "User phone sync skipped", retryError);
        return false;
      }
    }
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

export async function ensureTelegramUser(input: EnsureTelegramUserInput): Promise<TelegramUserRecord> {
  const telegramId = BigInt(input.telegramId);
  const name = [input.firstName, input.lastName].filter(Boolean).join(" ") || input.username || `User_${input.telegramId}`;
  const existing = await findTelegramUser(telegramId);

  const user = existing
    ? (input.username || existing.username) !== existing.username || (name || existing.name) !== existing.name
      ? await updateTelegramUser(telegramId, {
          username: input.username || existing.username,
          name: name || existing.name,
        })
      : existing
    : await createTelegramUser(telegramId, name, input.username);

  if (input.phone) {
    const synced = await trySyncUserPhone(user.id, input.phone, {
      verified: input.phoneVerified ? true : undefined,
      context: existing ? "ensureTelegramUser existing user" : "ensureTelegramUser new user",
    });
    if (synced) {
      const refreshed = await findTelegramUser(telegramId);
      if (refreshed) return refreshed;
    }
  }

  return user;
}
