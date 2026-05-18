import crypto from "crypto";

export function verifyTelegramWebAppData(initData: string, botToken: string): boolean {
  const URLSearchParams = require("url").URLSearchParams;
  const searchParams = new URLSearchParams(initData);

  const hash = searchParams.get("hash");
  searchParams.delete("hash");

  const dataCheckString = Array.from(searchParams.entries())
    .sort()
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const checkHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  return checkHash === hash;
}

export function generateJWT(payload: any, secret: string, expiresIn: string = "24h"): string {
  // Simple JWT generation (in production, use jsonwebtoken library)
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64");

  const message = `${header}.${body}`;
  const signature = crypto.createHmac("sha256", secret).update(message).digest("base64");

  return `${message}.${signature}`;
}

export function encryptToken(token: string, secret: string): string {
  const cipher = crypto.createCipher("aes192", secret);
  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

export function decryptToken(encrypted: string, secret: string): string {
  const decipher = crypto.createDecipher("aes192", secret);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function hashPassword(password: string): string {
  // This should use bcrypt in production
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
