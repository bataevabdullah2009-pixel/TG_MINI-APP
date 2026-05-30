/**
 * Common fetch helper for the Telegram Mini App environment.
 * Automatically appends the standard session authorization headers.
 */
export async function miniAppFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const tg = typeof window !== "undefined" ? (window as any).Telegram?.WebApp : null;
  
  // Resolve Telegram WebApp initialization data
  const tgInitData = tg?.initData || (typeof window !== "undefined" ? sessionStorage.getItem("tgInitData") : "") || "";

  const headers = new Headers(init?.headers);

  // Set standard Telegram session header
  if (tgInitData) {
    headers.set("x-telegram-init-data", tgInitData);
  }

  // Set JWT bearer if present in localstorage
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Inject application/json Content-Type if body exists and is not FormData
  if (init?.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
