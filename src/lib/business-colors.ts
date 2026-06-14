export const DEFAULT_PRIMARY_COLOR = "#0F172A";

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const LIGHT_PRIMARY_COLORS = new Set([
  "#ffffff",
  "#f8fafc",
  "#f1f5f9",
  "#e2e8f0",
]);

const BUSINESS_COLOR_DEFAULTS: Record<string, { primaryColor: string; accentColor: string }> = {
  cafe: { primaryColor: "#0F172A", accentColor: "#F59E0B" },
  shop: { primaryColor: "#1D4ED8", accentColor: "#7C3AED" },
  grocery: { primaryColor: "#047857", accentColor: "#84CC16" },
  hardware_store: { primaryColor: "#111827", accentColor: "#F97316" },
};

function expandShortHex(color: string) {
  if (color.length !== 4) return color;
  return `#${color
    .slice(1)
    .split("")
    .map((character) => character.repeat(2))
    .join("")}`;
}

export function getSafePrimaryColor(primaryColor?: string | null) {
  const normalized = String(primaryColor || "").trim();
  if (!HEX_COLOR_PATTERN.test(normalized)) return DEFAULT_PRIMARY_COLOR;

  const comparableColor = expandShortHex(normalized).toLowerCase();
  if (LIGHT_PRIMARY_COLORS.has(comparableColor)) return DEFAULT_PRIMARY_COLOR;

  return normalized;
}

export function getBusinessColorDefaults(type?: string | null) {
  const normalizedType = String(type || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return (
    BUSINESS_COLOR_DEFAULTS[normalizedType] || {
      primaryColor: DEFAULT_PRIMARY_COLOR,
      accentColor: "#3B82F6",
    }
  );
}
