import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { ensureTelegramUser } from "./auth/telegram-user-service";
import { ensureCustomerForTelegramUser } from "./customer/customer-service";

export interface TelegramAuthUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

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

  // In production, we optionally validate
  if (process.env.NODE_ENV === "production" && process.env.VALIDATE_TELEGRAM_DATA === "true") {
    let token = process.env.TELEGRAM_BOT_TOKEN || "";
    
    // If businessId is specified, fetch its bot token for white-label validation
    if (businessId) {
      const biz = await prisma.business.findUnique({ where: { id: businessId } });
      if (biz?.telegramBotToken) {
        token = biz.telegramBotToken;
      }
    }

    if (token) {
      const isValid = verifyTelegramInitData(initData, token);
      if (!isValid) {
        console.warn(`[getTelegramSessionUser] Invalid initData signature for user ${tgUser.id}`);
        return null;
      }
    }
  }

  // 1. Ensure User exists and is synchronized
  const user = await ensureTelegramUser({
    telegramId: telegramUserId,
    username: tgUser.username,
    firstName: tgUser.first_name,
    lastName: tgUser.last_name,
  });

  // Check if there is an Admin/Seller User (which is the same User object, check its role)
  const adminUser = await prisma.user.findUnique({
    where: { telegramId: telegramUserId },
    include: { business: true },
  });

  // 2. Fetch or create a Customer record for this Telegram user in the scope of the business (if businessId is provided and not "global")
  let customer = null;
  const effectiveBusinessId = (businessId && businessId !== "global") ? businessId : null;
  
  customer = await ensureCustomerForTelegramUser({
    telegramId: telegramUserId,
    username: tgUser.username,
    firstName: tgUser.first_name,
    lastName: tgUser.last_name,
    businessId: effectiveBusinessId,
  });

  // 3. Determine the effective role
  // Default is CUSTOMER. But if they match the SUPER_ADMIN list, or have a specific User role, we upgrade.
  let role: "CUSTOMER" | "BUSINESS_OWNER" | "MANAGER" | "SUPER_ADMIN" = "CUSTOMER";
  let linkedBusinessId = adminUser?.businessId || null;

  const superAdminIds = (process.env.TELEGRAM_SUPER_ADMIN_IDS || "")
    .split(",")
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
