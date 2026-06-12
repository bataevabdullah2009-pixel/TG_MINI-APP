type TimingMetadata = Record<string, string | number | boolean | null | undefined>;

export function createServerTiming(endpoint: string, metadata: TimingMetadata = {}) {
  const startedAt = performance.now();

  return function finish<T extends Response>(response: T) {
    const durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
    response.headers.set("Server-Timing", `${endpoint};dur=${durationMs}`);

    if (durationMs > 1000) {
      console.warn("[slow-api]", endpoint, durationMs, metadata);
    }

    return response;
  };
}
