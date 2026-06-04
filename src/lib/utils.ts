import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number, currency: string = "RUB"): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
  }).format(price);
}

export function formatDate(date: Date | string, locale: string = "ru-RU"): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string, locale: string = "ru-RU"): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getBusinessTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    CAFE: "☕ Кафе",
    BARBERSHOP: "✂️ Барбершоп",
    CARWASH: "🚗 Автомойка",
    SHOP: "🛍️ Магазин",
    COURSES: "📚 Курсы",
    CUSTOM: "⚙️ Другое",
  };
  return labels[type] || type;
}

export function getOrderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    NEW: "🆕 Новый",
    ACCEPTED: "✅ Принят",
    PREPARING: "👨‍🍳 Готовится",
    READY_FOR_PICKUP: "📦 Готов к самовывозу",
    READY_FOR_DELIVERY: "🚚 Ожидает курьера",
    COURIER_ASSIGNED: "🛵 Курьер назначен",
    PICKED_UP: "🚚 Заказ в пути",
    DELIVERED: "✅ Доставлен",
    READY: "📦 Готово",
    DELIVERING: "🚚 В пути",
    COMPLETED: "✔️ Завершен",
    CANCELLED: "❌ Отменен",
    EXPIRED: "⏱️ Истёк",
  };
  return labels[status] || status;
}

export function getBookingStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: "🕓 Ожидает",
    NEW: "🆕 Новая",
    CONFIRMED: "✅ Подтверждена",
    COMPLETED: "✔️ Завершена",
    CANCELLED: "❌ Отменена",
    EXPIRED: "⏱️ Истекла",
    NO_SHOW: "⏭️ Клиент не пришёл",
  };
  return labels[status] || status;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export function getContrastColor(hexColor: string): string {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return "#000000";

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

export function generateOrderNumber(): string {
  return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function parseModulesEnabled(modulesString: string): string[] {
  try {
    return modulesString.split(",").filter(Boolean);
  } catch {
    return [];
  }
}

export function isModuleEnabled(modules: string, moduleName: string): boolean {
  return parseModulesEnabled(modules).includes(moduleName);
}
