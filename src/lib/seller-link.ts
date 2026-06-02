import crypto from "crypto";

const SELLER_LINK_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export type SellerLinkParseResult = {
  attempt: boolean;
  code: string | null;
};

export function generateSellerLinkCode() {
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += SELLER_LINK_CHARS[crypto.randomInt(SELLER_LINK_CHARS.length)];
  }
  return code;
}

export function normalizeSellerLinkCode(value: string) {
  const code = value.toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}

export function parseSellerLinkText(text: string): SellerLinkParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { attempt: false, code: null };

  const parts = trimmed.split(/\s+/);
  const command = parts[0] || "";
  const payload = parts.slice(1).join("");

  if (/^\/link(?:@\S+)?$/i.test(command)) {
    return { attempt: true, code: normalizeSellerLinkCode(payload) };
  }

  if (/^\/link/i.test(command)) {
    const inlineCode = command.replace(/^\/link/i, "");
    return { attempt: true, code: normalizeSellerLinkCode(inlineCode || payload) };
  }

  if (/^link$/i.test(command)) {
    return { attempt: true, code: normalizeSellerLinkCode(payload) };
  }

  if (/^\/start(?:@\S+)?$/i.test(command) && payload) {
    if (/^link[-_]/i.test(payload)) {
      return {
        attempt: true,
        code: normalizeSellerLinkCode(payload.replace(/^link[-_]/i, "")),
      };
    }

    const payloadCode = normalizeSellerLinkCode(payload);
    if (payloadCode) return { attempt: true, code: payloadCode };
  }

  const bareCode = normalizeSellerLinkCode(trimmed);
  if (bareCode) return { attempt: true, code: bareCode };

  return { attempt: false, code: null };
}

export function looksLikeSellerLinkAttempt(text: string) {
  return parseSellerLinkText(text).attempt;
}

export function getConfiguredTelegramBotUsername() {
  const username = process.env.TELEGRAM_BOT_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "";
  return username.trim().replace(/^@/, "");
}

export function buildSellerDeepLink(code: string) {
  const botUsername = getConfiguredTelegramBotUsername();
  if (!botUsername) return null;
  return `https://t.me/${botUsername}?start=link-${code}`;
}
