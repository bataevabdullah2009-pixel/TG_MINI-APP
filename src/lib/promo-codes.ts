import { prisma } from "@/lib/prisma";

export function normalizePromoCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function isValidPromoCodeFormat(code: string) {
  return /^[A-Z0-9_-]{3,32}$/.test(code);
}

export async function getApplicablePromoCode(businessId: string, rawCode: unknown, now = new Date()) {
  const code = normalizePromoCode(rawCode);
  if (!code) return { ok: false as const, code: "", error: "Введите промокод." };
  if (!isValidPromoCodeFormat(code)) {
    return { ok: false as const, code, error: "Промокод должен содержать 3–32 латинских символа, цифры, _ или -." };
  }

  const promo = await prisma.promoCode.findUnique({
    where: { businessId_code: { businessId, code } },
    select: {
      id: true,
      code: true,
      discountPercent: true,
      isActive: true,
      startsAt: true,
      expiresAt: true,
      usageLimit: true,
      usageCount: true,
      archivedAt: true,
    },
  });

  if (!promo || promo.archivedAt || !promo.isActive) {
    return { ok: false as const, code, error: "Промокод не найден или выключен." };
  }
  if (promo.startsAt && promo.startsAt > now) {
    return { ok: false as const, code, error: "Промокод ещё не начал действовать." };
  }
  if (promo.expiresAt && promo.expiresAt < now) {
    return { ok: false as const, code, error: "Срок действия промокода истёк." };
  }
  if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
    return { ok: false as const, code, error: "Лимит использований промокода исчерпан." };
  }

  return { ok: true as const, promo };
}
