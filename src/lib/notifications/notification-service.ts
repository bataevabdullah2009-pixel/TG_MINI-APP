import { prisma } from "@/lib/prisma";
import { telegramBot } from "@/lib/telegram-bot-service";
import {
  buildCourierPanelUrl,
  buildMiniAppUrl,
  buildSellerPanelUrl,
  buildTelegramBotStartUrl,
} from "@/lib/production-url";

const orderStatusRu: Record<string, string> = {
  NEW: "Новый",
  ACCEPTED: "Принят",
  PREPARING: "Готовится",
  READY_FOR_PICKUP: "Готов к самовывозу",
  READY_FOR_DELIVERY: "Ожидает курьера",
  COURIER_ASSIGNED: "Курьер назначен",
  PICKED_UP: "Курьер забрал заказ",
  DELIVERED: "Доставлен",
  READY: "Готов",
  DELIVERING: "В пути",
  COMPLETED: "Завершён",
  CANCELLED: "Отменён",
  EXPIRED: "Истёк",
};

const bookingStatusRu: Record<string, string> = {
  PENDING: "Ожидает",
  NEW: "Новая",
  CONFIRMED: "Подтверждена",
  COMPLETED: "Завершена",
  CANCELLED: "Отменена",
  EXPIRED: "Истекла",
  NO_SHOW: "Клиент не пришёл",
};

const notificationBusinessSelect = {
  id: true,
  slug: true,
  name: true,
  telegramBotUsername: true,
  telegramAdminChatId: true,
  owner: { select: { telegramId: true } },
} as const;

function formatDateTime(date: Date) {
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sellerChatId(business: { slug: string; telegramAdminChatId?: bigint | null; owner?: { telegramId?: bigint | null } | null }) {
  return business.telegramAdminChatId?.toString() || business.owner?.telegramId?.toString() || process.env.TELEGRAM_ADMIN_CHAT_ID;
}

function escapeTelegramHtml(message: string) {
  return message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function courierChatId(courier: { telegramId?: bigint | null; user?: { telegramId?: bigint | null } | null }) {
  return courier.telegramId?.toString() || courier.user?.telegramId?.toString() || null;
}

export class NotificationService {
  static async notifyBusinessOwnerNewOrder(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { business: { select: notificationBusinessSelect }, items: true },
    });

    if (!order) return;

    const chatId = sellerChatId(order.business);
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
      order.deliveryType === "DELIVERY" ? `Зона: ${order.deliveryZoneName || order.deliveryCityArea || "не указана"}` : "",
      order.deliveryType === "DELIVERY" ? `Стоимость доставки: ${order.deliveryFee} ₽` : "",
      "",
      "Товары:",
      itemsText || "- Позиции не указаны",
      "",
      `Комментарий: ${order.comment || "нет"}`,
    ].filter(Boolean).join("\n");

    const sent = await telegramBot.sendNotification(chatId, text, {
      reply_markup: {
        inline_keyboard: [
          [{
            text: "Открыть заказ",
            web_app: {
              url: buildSellerPanelUrl(order.business.slug, {
                tab: "orders",
                orderId: order.id,
              }),
            },
          }],
          [{
            text: "Открыть панель продавца",
            web_app: { url: buildSellerPanelUrl(order.business.slug) },
          }],
        ],
      },
    });
    if (!sent) {
      const fallbackUrl = buildTelegramBotStartUrl(
        "seller",
        order.business.telegramBotUsername || undefined
      );
      if (fallbackUrl) {
        await telegramBot.sendNotification(chatId, "Откройте заказ через Telegram-бота.", {
          reply_markup: {
            inline_keyboard: [[{
              text: "Открыть панель продавца",
              url: fallbackUrl,
            }]],
          },
        });
      }
    }
  }

  static async notifyBusinessOwnerNewBooking(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { business: { select: notificationBusinessSelect }, service: true, staff: true },
    });

    if (!booking) return;

    const chatId = sellerChatId(booking.business);
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
        inline_keyboard: [[{
          text: "Открыть панель продавца",
          web_app: {
            url: buildSellerPanelUrl(booking.business.slug, { tab: "bookings" }),
          },
        }]],
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
      include: { business: { select: notificationBusinessSelect }, customer: true },
    });

    if (!order?.customer?.telegramUserId) {
      console.warn(`Customer order status notification skipped for order ${orderId}: no telegram user id.`);
      return;
    }

    await telegramBot.sendNotification(
      order.customer.telegramUserId.toString(),
      `${order.business.name}: статус вашего заказа #${order.id.slice(-6).toUpperCase()} изменён на: ${orderStatusRu[order.status] || order.status}`,
      {
        reply_markup: {
          inline_keyboard: [[{
            text: "Открыть мои заказы",
            web_app: { url: buildMiniAppUrl("/app?tab=orders") },
          }]],
        },
      }
    );
  }

  static async notifyCustomerBookingStatus(customerId: string | null | undefined, bookingId: string) {
    if (!customerId) {
      console.warn(`Customer booking status notification skipped for booking ${bookingId}: no customer id.`);
      return;
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { business: { select: notificationBusinessSelect }, customer: true },
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

  static async notifyCouriersNewDelivery(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        business: { select: notificationBusinessSelect },
        deliveryZone: true,
      },
    });
    if (!order || !["NEW", "WAITING_COURIER"].includes(order.deliveryStatus)) return;

    const couriers = await prisma.courier.findMany({
      where: { businessId: order.businessId, isActive: true },
      include: { user: { select: { telegramId: true } } },
    });

    const area = (order.deliveryCityArea || "").toLowerCase();
    for (const courier of couriers) {
      if (courier.cityArea && !area.includes(courier.cityArea.toLowerCase())) continue;
      const chatId = courierChatId(courier);
      if (!chatId) {
        console.warn(`New delivery notification skipped for courier ${courier.id}: no telegram id.`);
        continue;
      }
      await telegramBot.sendNotification(
        chatId,
        [
          `<b>Новая доступная доставка</b>`,
          `Магазин: ${escapeTelegramHtml(order.business.name)}`,
          `Район: ${escapeTelegramHtml(order.deliveryCityArea || order.deliveryZone?.cityArea || "не указан")}`,
          `Адрес: ${escapeTelegramHtml(order.customerAddress || "не указан")}`,
          `Итого: ${order.totalPrice} ₽`,
        ].join("\n"),
        { reply_markup: { inline_keyboard: [[{ text: "Открыть доставки", web_app: { url: buildCourierPanelUrl(courier.id) } }]] } }
      );
    }
  }

  static async notifyCourierAssigned(orderId: string, courierId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        business: { select: notificationBusinessSelect },
        customer: true,
        deliveryAssignment: { include: { courier: { include: { user: { select: { telegramId: true } } } } } },
      },
    });
    if (!order?.deliveryAssignment || order.deliveryAssignment.courierId !== courierId) return;

    const courier = order.deliveryAssignment.courier;
    const courierName = escapeTelegramHtml(courier.name);
    const courierChat = courierChatId(courier);
    const seller = sellerChatId(order.business);

    if (courierChat) {
      await telegramBot.sendNotification(
        courierChat,
        `<b>Заказ назначен вам</b>\nЗаказ #${order.id.slice(-6).toUpperCase()}\nАдрес: ${escapeTelegramHtml(order.customerAddress || "не указан")}`,
        { reply_markup: { inline_keyboard: [[{ text: "Принять доставку", web_app: { url: buildCourierPanelUrl(courier.id) } }]] } }
      );
    } else {
      console.warn(`Courier assigned notification skipped for courier ${courier.id}: no telegram id.`);
    }
    if (seller) {
      await telegramBot.sendNotification(seller, `Курьер <b>${courierName}</b> назначен на заказ #${order.id.slice(-6).toUpperCase()}.`);
    }
    if (order.customer?.telegramUserId) {
      await telegramBot.sendNotification(order.customer.telegramUserId.toString(), `${escapeTelegramHtml(order.business.name)}: на ваш заказ назначен курьер ${courierName}.`);
    } else {
      console.warn(`Courier assigned customer notification skipped for order ${order.id}: no telegram id.`);
    }
  }

  static async notifyCourierPickedUp(orderId: string, courierId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        business: { select: notificationBusinessSelect },
        customer: true,
        deliveryAssignment: { include: { courier: true } },
      },
    });
    if (!order?.deliveryAssignment || order.deliveryAssignment.courierId !== courierId) return;

    const seller = sellerChatId(order.business);
    if (seller) {
      await telegramBot.sendNotification(seller, `Курьер <b>${escapeTelegramHtml(order.deliveryAssignment.courier.name)}</b> забрал заказ #${order.id.slice(-6).toUpperCase()}.`);
    }
    if (order.customer?.telegramUserId) {
      await telegramBot.sendNotification(order.customer.telegramUserId.toString(), `${escapeTelegramHtml(order.business.name)}: ваш заказ в пути.`);
    } else {
      console.warn(`Picked up customer notification skipped for order ${order.id}: no telegram id.`);
    }
  }

  static async notifyCourierDelivered(orderId: string, courierId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        business: { select: notificationBusinessSelect },
        customer: true,
        deliveryAssignment: { include: { courier: true } },
      },
    });
    if (!order?.deliveryAssignment || order.deliveryAssignment.courierId !== courierId) return;

    const seller = sellerChatId(order.business);
    if (seller) {
      await telegramBot.sendNotification(seller, `Заказ #${order.id.slice(-6).toUpperCase()} доставлен курьером <b>${escapeTelegramHtml(order.deliveryAssignment.courier.name)}</b>.`);
    }
    if (order.customer?.telegramUserId) {
      await telegramBot.sendNotification(order.customer.telegramUserId.toString(), `${escapeTelegramHtml(order.business.name)}: заказ доставлен. Спасибо за заказ!`);
    } else {
      console.warn(`Delivered customer notification skipped for order ${order.id}: no telegram id.`);
    }
  }

  static async notifyCourierAssignmentReleased(courierId: string, orderId: string) {
    const courier = await prisma.courier.findUnique({
      where: { id: courierId },
      include: { user: { select: { telegramId: true } } },
    });
    if (!courier) return;
    const chatId = courierChatId(courier);
    if (!chatId) {
      console.warn(`Released assignment notification skipped for courier ${courierId}: no telegram id.`);
      return;
    }
    await telegramBot.sendNotification(chatId, `Заказ #${orderId.slice(-6).toUpperCase()} снова доступен другим курьерам: время на получение истекло.`);
  }

  static async notifyCourierOrderCancelled(orderId: string) {
    const assignment = await prisma.deliveryAssignment.findUnique({
      where: { orderId },
      include: { courier: { include: { user: { select: { telegramId: true } } } } },
    });
    if (!assignment) return;
    const chatId = courierChatId(assignment.courier);
    if (!chatId) {
      console.warn(`Cancelled delivery notification skipped for courier ${assignment.courierId}: no telegram id.`);
      return;
    }
    await telegramBot.sendNotification(chatId, `Заказ #${orderId.slice(-6).toUpperCase()} отменён продавцом.`);
  }

  static async notifyBookingExpired(bookingId: string, messages: { customer: string; seller: string }) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { business: { select: notificationBusinessSelect }, customer: true },
    });

    if (!booking) return;

    if (booking.customer?.telegramUserId) {
      await telegramBot.sendNotification(booking.customer.telegramUserId.toString(), escapeTelegramHtml(messages.customer));
    } else {
      console.warn(`Expired booking customer notification skipped for ${bookingId}: no telegram user id.`);
    }

    const chatId = sellerChatId(booking.business);
    if (chatId) {
      await telegramBot.sendNotification(chatId, escapeTelegramHtml(messages.seller));
    } else {
      console.warn(`Expired booking seller notification skipped for business ${booking.business.slug}: no seller chat id.`);
    }
  }

  static async notifyPickupOrderExpired(orderId: string, messages: { customer: string; seller: string }) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { business: { select: notificationBusinessSelect }, customer: true },
    });

    if (!order) return;

    if (order.customer?.telegramUserId) {
      await telegramBot.sendNotification(order.customer.telegramUserId.toString(), escapeTelegramHtml(messages.customer));
    } else {
      console.warn(`Expired pickup order customer notification skipped for ${orderId}: no telegram user id.`);
    }

    const chatId = sellerChatId(order.business);
    if (chatId) {
      await telegramBot.sendNotification(chatId, escapeTelegramHtml(messages.seller));
    } else {
      console.warn(`Expired pickup order seller notification skipped for business ${order.business.slug}: no seller chat id.`);
    }
  }
}
