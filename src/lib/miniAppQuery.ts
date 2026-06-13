export type MiniAppQueryKeyPart = string | number | boolean | null | undefined;

type CacheEntry = {
  keyParts: string[];
  expiresAt: number;
  value: unknown;
};

type ActiveRequest = {
  controller: AbortController;
  key: string;
  token: symbol;
};

const queryCache = new Map<string, CacheEntry>();
const activeRequests = new Map<string, ActiveRequest>();

function normalizeKeyPart(value: MiniAppQueryKeyPart) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  return String(value);
}

export function createMiniAppQueryKey(keyParts: readonly MiniAppQueryKeyPart[]) {
  return JSON.stringify(keyParts.map(normalizeKeyPart));
}

export function readMiniAppQueryCache<T>(
  keyParts: readonly MiniAppQueryKeyPart[]
): T | undefined {
  const key = createMiniAppQueryKey(keyParts);
  const entry = queryCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    queryCache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function writeMiniAppQueryCache<T>(
  keyParts: readonly MiniAppQueryKeyPart[],
  value: T,
  ttlMs: number
) {
  const normalizedParts = keyParts.map(normalizeKeyPart);
  queryCache.set(JSON.stringify(normalizedParts), {
    keyParts: normalizedParts,
    expiresAt: Date.now() + Math.max(0, ttlMs),
    value,
  });
}

export function invalidateMiniAppQueryCache(
  prefixParts: readonly MiniAppQueryKeyPart[]
) {
  const normalizedPrefix = prefixParts.map(normalizeKeyPart);
  for (const [key, entry] of queryCache) {
    if (normalizedPrefix.every((part, index) => entry.keyParts[index] === part)) {
      queryCache.delete(key);
    }
  }
}

export function beginMiniAppQuery(
  scope: string,
  keyParts: readonly MiniAppQueryKeyPart[]
) {
  const key = createMiniAppQueryKey(keyParts);
  activeRequests.get(scope)?.controller.abort();

  const controller = new AbortController();
  const token = Symbol(key);
  activeRequests.set(scope, { controller, key, token });

  const isCurrent = () => activeRequests.get(scope)?.token === token;
  const finish = () => {
    if (isCurrent()) activeRequests.delete(scope);
  };
  const cancel = () => {
    if (isCurrent()) {
      controller.abort();
      activeRequests.delete(scope);
    }
  };

  return {
    key,
    signal: controller.signal,
    isCurrent,
    finish,
    cancel,
  };
}
