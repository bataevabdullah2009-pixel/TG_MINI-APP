import { prisma } from "@/lib/prisma";
import { telegramBot } from "@/lib/telegram-bot-service";
import { getAppBaseUrl } from "@/lib/production-url";

const orderStatusRu: Record<string, string> = {
  NEW: "Новый",
  ACCEPTED: "Принят",
  PREPARING: "Готовится",
  READY: "Готов",
  DELIVERING: "В пути",
  COMPLETED: "Завершён",
  CANCELLED: "Отменён",
};

const bookingStatusRu: Record<string, string> = {
  NEW: "Новая",
  CONFIRMED: "Подтверждена",
  COMPLETED: "Завершена",
  CANCELLED: "Отменена",
  NO_SHOW: "Не явился",
};

function adminUrl(path: string) {
  return `${getAppBaseUrl()}${path}`;
}

function formatDateTime(date: Date) {
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export class NotificationService {
  static async notifyBusinessOwnerNewOrder(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { business: true, items: true },
    });

    if (!order) return;

    const chatId = order.business.telegramAdminChatId?.toString() || process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!chatId) {
      console.warn(`Order notification skipped: business ${order.business.slug} has no admin chat id.`);
      return;
    }

    const itemsText = order.items.map((item) => `- ${item.name} x ${item.quantity}`).join("\n");
    const deliveryType = order.deliveryType === "DELIVERY" ? "Доставка" : order.deliveryType === "PICKUP" ? "Самовывоз" : "Не указан";
    const text = [
      `🏪 <b>${order.business.name}</b>`,
      `📦 Новый заказ #${order.id.slice(-6).toUpperCase()}`,
      "",
      `Клиент: ${order.customerName}`,
      `Телефон: ${order.customerPhone}`,
      `Сумма: ${order.totalPrice} ₽`,
      `Получение: ${deliveryType}`,
      "",
      "Товары:",
      itemsText || "- Позиции не указаны",
      "",
      `Комментарий: ${order.comment || "нет"}`,
    ].join("\n");

    await telegramBot.sendNotification(chatId, text, {
      reply_markup: {
        inline_keyboard: [[{ text: "Открыть в админке", url: adminUrl("/admin/orders") }]],
      },
    });
  }

  static async notifyBusinessOwnerNewBooking(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { business: true, service: true, staff: true },
    });

    if (!booking) return;

    const chatId = booking.business.telegramAdminChatId?.toString() || process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!chatId) {
      console.warn(`Booking notification skipped: business ${booking.business.slug} has no admin chat id.`);
      return;
    }

    const text = [
      `🏪 <b>${booking.business.name}</b>`,
      "📅 Новая запись",
      "",
      `Клиент: ${booking.customerName}`,
      `Телефон: ${booking.customerPhone}`,
      `Услуга: ${booking.service?.name || "Услуга"}`,
      `Мастер: ${booking.staff?.name || "Не выбран"}`,
      `Дата: ${booking.startTime.toLocaleDateString("ru-RU")}`,
      `Время: ${booking.startTime.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`,
      booking.comment ? `Комментарий: ${booking.comment}` : "",
    ].filter(Boolean).join("\n");

    await telegramBot.sendNotification(chatId, text, {
      reply_markup: {
        inline_keyboard: [[{ text: "Открыть в админке", url: adminUrl("/admin/bookings") }]],
      },
    });
  }

  static async notifyCustomerOrderStatus(customerId: string | null | undefined, orderId: string) {
    if (!customerId) {
      console.warn(`Customer order status notification skipped for order ${orderId}: no customer id.`);
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { business: true, customer: true },
    });

    if (!order?.customer?.telegramUserId) {
      console.warn(`Customer order status notification skipped for order ${orderId}: no telegram user id.`);
      return;
    }

    await telegramBot.sendNotification(
      order.customer.telegramUserId.toString(),
      `${order.business.name}: статус вашего заказа #${order.id.slice(-6).toUpperCase()} изменён на: ${orderStatusRu[order.status] || order.status}`
    );
  }

  static async notifyCustomerBookingStatus(customerId: string | null | undefined, bookingId: string) {
    if (!customerId) {
      console.warn(`Customer booking status notification skipped for booking ${bookingId}: no customer id.`);
      return;
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { business: true, customer: true },
    });

    if (!booking?.customer?.telegramUserId) {
      console.warn(`Customer booking status notification skipped for booking ${bookingId}: no telegram user id.`);
      return;
    }

    await telegramBot.sendNotification(
      booking.customer.telegramUserId.toString(),
      `${booking.business.name}: ваша запись на ${formatDateTime(booking.startTime)} теперь: ${bookingStatusRu[booking.status] || booking.status}`
    );
  }
}
