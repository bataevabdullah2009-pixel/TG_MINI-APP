import * as crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { trySyncUserPhone } from "@/lib/auth/telegram-user-service";
import { isStrictRuPhoneInput, normalizeRuPhone } from "@/lib/phone/phone-utils";

function codeHash(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function smsProviderName() {
  return (process.env.SMS_PROVIDER || "mock").trim().toLowerCase();
}

export function isMockSmsMode() {
  const provider = smsProviderName();
  return !provider || provider === "mock";
}

export function isPhoneTestCodeEnabled() {
  return process.env.PHONE_TEST_CODE_ENABLED === "true";
}

async function syncVerifiedPhoneToCustomerAndUser(customerId: string, phone: string, verificationMethod: string) {
  const normalizedPhone = normalizeRuPhone(phone);
  if (!normalizedPhone) {
    return { success: false, error: "Введите корректный номер телефона." };
  }

  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: {
      phone: normalizedPhone,
      phoneVerified: true,
      verificationMethod,
    },
    select: {
      id: true,
      userId: true,
      telegramUserId: true,
    },
  });

  const user = customer.userId
    ? await prisma.user.findUnique({ where: { id: customer.userId }, select: { id: true } })
    : await prisma.user.findUnique({ where: { telegramId: customer.telegramUserId }, select: { id: true } });

  if (user?.id) {
    await trySyncUserPhone(user.id, normalizedPhone, {
      verified: true,
      context: `phone verification sync via ${verificationMethod}`,
    });
  }

  return { success: true, phone: normalizedPhone };
}

export class PhoneVerificationService {
  static getPublicConfig() {
    const mockMode = isMockSmsMode();
    const testCodeEnabled = isPhoneTestCodeEnabled();
    return {
      smsProvider: smsProviderName(),
      mockMode,
      testCodeEnabled,
      canRequestCode: !mockMode || testCodeEnabled,
      message: mockMode && testCodeEnabled
        ? "Тестовый режим: введите код 1111"
        : "Подтвердите номер через Telegram contact в боте",
    };
  }

  static async sendCode(
    customerId: string,
    phone: string,
    provider: "telegram_contact" | "manual" | "mock_sms" | "sms"
  ): Promise<{ success: boolean; verificationId?: string; error?: string; code?: string }> {
    try {
      if (provider !== "telegram_contact" && !isStrictRuPhoneInput(phone)) {
        return { success: false, code: "INVALID_PHONE", error: "Введите номер в формате +7XXXXXXXXXX." };
      }
      const normalizedPhone = normalizeRuPhone(phone);
      if (!normalizedPhone) {
        return { success: false, code: "INVALID_PHONE", error: "Введите корректный номер телефона." };
      }

      const mockMode = isMockSmsMode();
      if (mockMode && !isPhoneTestCodeEnabled()) {
        return {
          success: false,
          code: "TELEGRAM_CONTACT_REQUIRED",
          error: "Подтвердите номер через Telegram contact в боте.",
        };
      }

      if (!mockMode) {
        return {
          success: false,
          code: "SMS_PROVIDER_NOT_IMPLEMENTED",
          error: "SMS-провайдер не подключён. Подтвердите номер через Telegram contact.",
        };
      }

      const code = "1111";
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const verification = await prisma.phoneVerification.create({
        data: {
          customerId,
          phone: normalizedPhone,
          codeHash: codeHash(code),
          status: "pending",
          provider: provider === "sms" ? "mock_sms" : provider,
          expiresAt,
        },
      });

      console.info("[PHONE TEST CODE] mock verification record created", {
        customerId,
        phone: normalizedPhone,
        testCodeEnabled: true,
      });

      return { success: true, verificationId: verification.id };
    } catch (e: any) {
      console.error("[PhoneVerificationService] sendCode error:", e);
      return { success: false, error: e.message };
    }
  }

  static async verifyCode(
    customerId: string,
    phone: string,
    code: string
  ): Promise<{ success: boolean; error?: string; phone?: string }> {
    try {
      if (!isStrictRuPhoneInput(phone)) {
        return { success: false, error: "Введите номер в формате +7XXXXXXXXXX." };
      }
      const normalizedPhone = normalizeRuPhone(phone);
      if (!normalizedPhone) {
        return { success: false, error: "Введите корректный номер телефона." };
      }

      const mockMode = isMockSmsMode();
      const allowTestCode = mockMode && isPhoneTestCodeEnabled();
      if (mockMode && (!allowTestCode || code !== "1111")) {
        return { success: false, error: "Неверный код подтверждения." };
      }

      const verification = await prisma.phoneVerification.findFirst({
        where: {
          customerId,
          phone: normalizedPhone,
          status: "pending",
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!verification) {
        if (allowTestCode && code === "1111") {
          return syncVerifiedPhoneToCustomerAndUser(customerId, normalizedPhone, "mock_sms");
        }
        return { success: false, error: "Код верификации не найден или истёк." };
      }

      if (verification.codeHash !== codeHash(code)) {
        return { success: false, error: "Неверный код подтверждения." };
      }

      await prisma.phoneVerification.update({
        where: { id: verification.id },
        data: { status: "verified" },
      });

      return syncVerifiedPhoneToCustomerAndUser(customerId, normalizedPhone, verification.provider);
    } catch (e: any) {
      console.error("[PhoneVerificationService] verifyCode error:", e);
      return { success: false, error: e.message };
    }
  }

  static async verifyViaTelegramContact(customerId: string, phone: string): Promise<{ success: boolean; error?: string; phone?: string }> {
    try {
      const normalizedPhone = normalizeRuPhone(phone);
      if (!normalizedPhone) {
        return { success: false, error: "Введите корректный номер телефона." };
      }

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.phoneVerification.create({
        data: {
          customerId,
          phone: normalizedPhone,
          codeHash: "telegram_contact",
          status: "verified",
          provider: "telegram_contact",
          expiresAt,
        },
      });

      return syncVerifiedPhoneToCustomerAndUser(customerId, normalizedPhone, "telegram_contact");
    } catch (e: any) {
      console.error("[PhoneVerificationService] verifyViaTelegramContact error:", e);
      return { success: false, error: e.message };
    }
  }
}
