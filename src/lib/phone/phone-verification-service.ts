import { prisma } from "@/lib/prisma";
import { MockSMSProvider } from "./providers/mock-sms-provider";
import * as crypto from "crypto";

const smsProvider = new MockSMSProvider();

export class PhoneVerificationService {
  static async sendCode(
    customerId: string,
    phone: string,
    provider: "telegram_contact" | "manual" | "mock_sms" | "sms"
  ): Promise<{ success: boolean; verificationId?: string; error?: string }> {
    try {
      // 1. Generate code (4 digits, e.g. "1111" or random in production)
      const isDevOrMock = process.env.NODE_ENV !== "production" && (process.env.SMS_PROVIDER === "mock" || !process.env.SMS_PROVIDER);
      const code = isDevOrMock ? "1111" : Math.floor(1000 + Math.random() * 9000).toString();

      const codeHash = crypto.createHash("sha256").update(code).digest("hex");
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

      // 2. Create the PhoneVerification in DB
      const verification = await prisma.phoneVerification.create({
        data: {
          customerId,
          phone,
          codeHash,
          status: "pending",
          provider,
          expiresAt,
        },
      });

      // 3. Send SMS if needed
      if (provider === "mock_sms" || provider === "sms") {
        await smsProvider.sendVerificationCode(phone, code);
      }

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
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const codeHash = crypto.createHash("sha256").update(code).digest("hex");
      const isDevOrMock = process.env.NODE_ENV !== "production" && (process.env.SMS_PROVIDER === "mock" || !process.env.SMS_PROVIDER);

      // Find pending verification
      const verification = await prisma.phoneVerification.findFirst({
        where: {
          customerId,
          phone,
          status: "pending",
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!verification) {
        // Fallback for easy testing in dev/mock without active verification records
        if (code === "1111" && isDevOrMock) {
          await prisma.customer.updateMany({
            where: { id: customerId },
            data: {
              phone,
              phoneVerified: true,
              verificationMethod: "mock_sms",
            },
          });
          return { success: true };
        }
        return { success: false, error: "Код верификации не найден или истек." };
      }

      // Check hash (allow fallback to 1111 in dev/mock)
      const isDevFallback = code === "1111" && isDevOrMock;
      const isMatch = verification.codeHash === codeHash || isDevFallback;

      if (!isMatch) {
        return { success: false, error: "Неверный код верификации." };
      }

      // Mark verified
      await prisma.phoneVerification.update({
        where: { id: verification.id },
        data: { status: "verified" },
      });

      // Update customer verification status
      await prisma.customer.updateMany({
        where: { id: customerId },
        data: {
          phone,
          phoneVerified: true,
          verificationMethod: verification.provider,
        },
      });

      return { success: true };
    } catch (e: any) {
      console.error("[PhoneVerificationService] verifyCode error:", e);
      return { success: false, error: e.message };
    }
  }

  static async verifyViaTelegramContact(customerId: string, phone: string): Promise<{ success: boolean; error?: string }> {
    try {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.phoneVerification.create({
        data: {
          customerId,
          phone,
          codeHash: "telegram_contact",
          status: "verified",
          provider: "telegram_contact",
          expiresAt,
        },
      });

      // Update customer
      await prisma.customer.updateMany({
        where: { id: customerId },
        data: {
          phone,
          phoneVerified: true,
          verificationMethod: "telegram_contact",
        },
      });

      return { success: true };
    } catch (e: any) {
      console.error("[PhoneVerificationService] verifyViaTelegramContact error:", e);
      return { success: false, error: e.message };
    }
  }
}
