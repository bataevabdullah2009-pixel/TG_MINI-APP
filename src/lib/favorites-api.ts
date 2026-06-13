import { parseTelegramInitData, verifyTelegramInitData } from "@/lib/auth-telegram";

export const favoriteBusinessSelect = {
  id: true,
  slug: true,
  name: true,
  type: true,
  templateKey: true,
  description: true,
  logoUrl: true,
  coverImageUrl: true,
  address: true,
  primaryColor: true,
  accentColor: true,
  isOpen: true,
  isActive: true,
  accessStatus: true,
  archivedAt: true,
} as const;

export const favoriteItemInclude = {
  item: {
    select: {
      id: true,
      businessId: true,
      name: true,
      description: true,
      price: true,
      imageUrl: true,
      type: true,
      durationMinutes: true,
      stockMode: true,
      stock: true,
      isAvailable: true,
      archivedAt: true,
      category: { select: { id: true, name: true } },
    },
  },
  business: { select: favoriteBusinessSelect },
} as const;

type FavoriteIdentityValues = {
  telegramUserId?: unknown;
  tgId?: unknown;
  userId?: unknown;
};

function toBigInt(value: unknown) {
  if (value === undefined || value === null || value === "") return null;

  try {
    return BigInt(String(value));
  } catch {
    return null;
  }
}

export async function resolveFavoriteTelegramUserId(request: Request, values: FavoriteIdentityValues = {}) {
  const initData = request.headers.get("x-telegram-init-data");
  if (initData) {
    const user = parseTelegramInitData(initData);
    if (!user) return null;

    const shouldValidate = process.env.NODE_ENV === "production" || process.env.VALIDATE_TELEGRAM_DATA === "true";
    if (shouldValidate) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
      if (!botToken || !verifyTelegramInitData(initData, botToken)) return null;
    }

    return toBigInt(user.id);
  }

  if (process.env.NODE_ENV === "production") return null;
  return toBigInt(values.telegramUserId ?? values.tgId ?? values.userId);
}

export function identityValuesFromSearch(searchParams: URLSearchParams): FavoriteIdentityValues {
  return {
    telegramUserId: searchParams.get("telegramUserId"),
    tgId: searchParams.get("tgId"),
    userId: searchParams.get("userId"),
  };
}
