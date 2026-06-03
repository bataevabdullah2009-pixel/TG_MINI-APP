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
} as const;

export const favoriteItemInclude = {
  item: {
    include: {
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

function telegramUserIdFromInitData(initData: string | null) {
  if (!initData) return null;

  try {
    const params = new URLSearchParams(initData);
    const user = params.get("user");
    if (!user) return null;

    const parsed = JSON.parse(user) as { id?: number | string };
    return parsed.id === undefined ? null : parsed.id;
  } catch {
    return null;
  }
}

function toBigInt(value: unknown) {
  if (value === undefined || value === null || value === "") return null;

  try {
    return BigInt(String(value));
  } catch {
    return null;
  }
}

export function resolveFavoriteTelegramUserId(request: Request, values: FavoriteIdentityValues = {}) {
  const headerUserId = telegramUserIdFromInitData(request.headers.get("x-telegram-init-data"));
  return toBigInt(headerUserId ?? values.telegramUserId ?? values.tgId ?? values.userId);
}

export function identityValuesFromSearch(searchParams: URLSearchParams): FavoriteIdentityValues {
  return {
    telegramUserId: searchParams.get("telegramUserId"),
    tgId: searchParams.get("tgId"),
    userId: searchParams.get("userId"),
  };
}

