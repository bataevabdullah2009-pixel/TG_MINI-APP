import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { ensureTelegramUser } from "./auth/telegram-user-service";
import { ensureCustomerForTelegramUser } from "./customer/customer-service";
import { isPrismaMissingColumnError, warnPrismaSchemaDrift } from "./prisma-schema-guard";
import { setSelectedBusinessContext } from "./ai/telegram-marketplace-agent";

export interface TelegramAuthUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

type AdminSessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  telegramId: bigint | null;
  username: string | null;
  role: "CUSTOMER" | "BUSINESS_OWNER" | "MANAGER" | "COURIER" | "SUPER_ADMIN";
  businessId: string | null;
  isActive: boolean;
  business: { id: string; slug: string; name: string } | null;
  ownedBusinesses: Array<{ id: string; slug: string; name: string }>;
};

export function parseTelegramInitData(initData: string): TelegramAuthUser | null {
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get("user");
    if (!userStr) return null;
    return JSON.parse(userStr) as TelegramAuthUser;
  } catch (e) {
    console.error("[parseTelegramInitData] Error parsing user from initData:", e);
    return null;
  }
}

export function verifyTelegramInitData(initData: string, botToken: string): boolean {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash || !botToken) return false;

    params.delete("hash");

    const dataCheckString = Array.from(params.entries())
      .sort()
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const checkHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    return checkHash === hash;
  } catch (e) {
    console.error("[verifyTelegramInitData] Verification failed:", e);
    return false;
  }
}

export async function getTelegramSessionUser(initData: string, businessId?: string) {
  if (!initData) return null;

  const tgUser = parseTelegramInitData(initData);
  if (!tgUser) return null;

  const telegramUserId = BigInt(tgUser.id);

  const shouldValidate = process.env.NODE_ENV === "production" || process.env.VALIDATE_TELEGRAM_DATA === "true";
  if (shouldValidate) {
    const tokens = [process.env.TELEGRAM_BOT_TOKEN || ""];
    
    if (businessId) {
      const biz = await prisma.business.findUnique({
        where: { id: businessId },
        select: { telegramBotToken: true },
      });
      if (biz?.telegramBotToken) {
        tokens.unshift(biz.telegramBotToken);
      }
    }

    const configuredTokens = Array.from(new Set(tokens.filter(Boolean)));
    if (configuredTokens.length === 0) {
      console.error("[TELEGRAM AUTH] No bot token is configured for initData validation.");
      return null;
    }
    if (!configuredTokens.some((token) => verifyTelegramInitData(initData, token))) {
      console.warn(`[getTelegramSessionUser] Invalid initData signature for user ${tgUser.id}`);
      return null;
    }
  }

  // 1. Ensure User exists and is synchronized
  const user = await ensureTelegramUser({
    telegramId: telegramUserId,
    username: tgUser.username,
    firstName: tgUser.first_name,
    lastName: tgUser.last_name,
  });

  if (businessId && businessId !== "global") {
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastBusinessId: businessId },
        select: { id: true },
      });
    } catch (error) {
      if (!isPrismaMissingColumnError(error, "User", "lastBusinessId")) throw error;
      warnPrismaSchemaDrift("Telegram business context was not persisted because User.lastBusinessId is missing", error);
    }
  }

  // Check if there is an Admin/Seller User (which is the same User object, check its role)
  let adminUser: AdminSessionUser | null;
  try {
    adminUser = await prisma.user.findUnique({
      where: { telegramId: telegramUserId },
      select: {
        id: true,
        email: true,
        name: true,
        telegramId: true,
        username: true,
        role: true,
        businessId: true,
        isActive: true,
        business: { select: { id: true, slug: true, name: true } },
        ownedBusinesses: { select: { id: true, slug: true, name: true } },
      },
    });
  } catch (error) {
    if (!isPrismaMissingColumnError(error)) throw error;
    warnPrismaSchemaDrift("Telegram session loaded without optional admin account fields", error);
    const legacyAdminUser = await prisma.user.findUnique({
      where: { telegramId: telegramUserId },
      select: {
        id: true,
        email: true,
        name: true,
        telegramId: true,
        username: true,
        role: true,
      },
    });
    adminUser = legacyAdminUser
      ? { ...legacyAdminUser, businessId: null, isActive: true, business: null, ownedBusinesses: [] }
      : null;
  }

  // 2. Fetch or create a Customer record for this Telegram user in the scope of the business (if businessId is provided and not "global")
  let customer = null;
  const effectiveBusinessId = (businessId && businessId !== "global") ? businessId : null;
  
  try {
    customer = await ensureCustomerForTelegramUser({
      telegramId: telegramUserId,
      username: tgUser.username,
      firstName: tgUser.first_name,
      lastName: tgUser.last_name,
      businessId: effectiveBusinessId,
      existingUser: user,
    });
    if (customer?.businessId) {
      await setSelectedBusinessContext(
        String(tgUser.id),
        customer.businessId,
        { ensureCustomer: false }
      );
    }
  } catch (error) {
    if (
      isPrismaMissingColumnError(error, "Customer", "phone") ||
      isPrismaMissingColumnError(error, "Customer", "phoneVerified") ||
      isPrismaMissingColumnError(error, "Customer", "verificationMethod") ||
      isPrismaMissingColumnError(error, "Customer", "userId")
    ) {
      warnPrismaSchemaDrift("Telegram customer session loaded without Customer profile", error);
      customer = null;
    } else {
      throw error;
    }
  }

  // 3. Determine the effective role
  // Default is CUSTOMER. But if they match the SUPER_ADMIN list, or have a specific User role, we upgrade.
  let role: "CUSTOMER" | "BUSINESS_OWNER" | "MANAGER" | "COURIER" | "SUPER_ADMIN" = "CUSTOMER";

  const superAdminIds = (process.env.TELEGRAM_SUPER_ADMIN_IDS || "")
    .split(",")
    .concat(process.env.TELEGRAM_ADMIN_CHAT_ID || "")
    .map((id) => id.trim())
    .filter(Boolean);

  if (superAdminIds.includes(tgUser.id.toString())) {
    role = "SUPER_ADMIN";
  } else if (adminUser) {
    if (adminUser.role === "SUPER_ADMIN") {
      role = "SUPER_ADMIN";
    } else if (adminUser.role === "BUSINESS_OWNER") {
      role = "BUSINESS_OWNER";
    } else if (adminUser.role === "MANAGER") {
      role = "MANAGER";
    } else if (adminUser.role === "COURIER") {
      role = "COURIER";
    }
  }

  let linkedBusinessId = adminUser?.businessId || adminUser?.ownedBusinesses?.[0]?.id || null;

  // Sync businessId back to user if it's null but they own a business
  if (adminUser && !adminUser.businessId && linkedBusinessId) {
    try {
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { businessId: linkedBusinessId },
        select: { id: true },
      });
    } catch (e) {
      console.error("[getTelegramSessionUser] Error syncing businessId to user:", e);
    }
  }

  return {
    telegramUserId: tgUser.id,
    username: tgUser.username || null,
    name: tgUser.first_name + (tgUser.last_name ? " " + tgUser.last_name : ""),
    role,
    adminUser: adminUser || null,
    customer: customer || null,
    businessId: linkedBusinessId,
  };
}
