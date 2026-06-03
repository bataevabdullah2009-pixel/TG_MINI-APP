import { prisma } from "@/lib/prisma";
import { generateNotice, noticeReasons } from "@/lib/ai/generateNotice";
import { NotificationService } from "@/lib/notifications/notification-service";

const BOOKING_EXPIRE_AFTER_MS = 5 * 60 * 1000;
const PICKUP_ORDER_EXPIRE_AFTER_MS = 24 * 60 * 60 * 1000;
const BOOKING_ACTIVE_STATUSES = ["PENDING", "NEW", "CONFIRMED"] as const;
const ORDER_FINAL_STATUSES = ["COMPLETED", "CANCELLED", "EXPIRED"] as const;

function formatTime(date: Date, timezone?: string | null) {
  try {
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone || "Europe/Moscow",
    });
  } catch {
    return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
}

function orderCode(orderId: string) {
  return orderId.slice(-6).toUpperCase();
}

async function notifyExpiredBooking(input: {
  id: string;
  startTime: Date;
  business: { name: string; timezone: string };
}) {
  const timeText = formatTime(input.startTime, input.business.timezone);
  const [customer, seller] = await Promise.all([
    generateNotice({
      kind: "booking_expired_customer",
      timeText,
      businessName: input.business.name,
    }),
    generateNotice({
      kind: "booking_expired_seller",
      timeText,
      businessName: input.business.name,
    }),
  ]);

  await NotificationService.notifyBookingExpired(input.id, { customer, seller });
}

async function notifyExpiredPickupOrder(input: {
  id: string;
  business: { name: string };
}) {
  const code = orderCode(input.id);
  const [customer, seller] = await Promise.all([
    generateNotice({
      kind: "pickup_order_expired_customer",
      orderCode: code,
      businessName: input.business.name,
    }),
    generateNotice({
      kind: "pickup_order_expired_seller",
      orderCode: code,
      businessName: input.business.name,
    }),
  ]);

  await NotificationService.notifyPickupOrderExpired(input.id, { customer, seller });
}

export async function expireBookingsAndPickupOrders(now = new Date()) {
  const bookingCutoff = new Date(now.getTime() - BOOKING_EXPIRE_AFTER_MS);
  const pickupOrderCutoff = new Date(now.getTime() - PICKUP_ORDER_EXPIRE_AFTER_MS);

  const bookings = await prisma.booking.findMany({
    where: {
      startTime: { lt: bookingCutoff },
      status: { in: [...BOOKING_ACTIVE_STATUSES] },
      expiredAt: null,
    },
    select: {
      id: true,
      startTime: true,
      business: { select: { name: true, timezone: true } },
    },
  });

  let expiredBookings = 0;
  for (const booking of bookings) {
    const updated = await prisma.booking.updateMany({
      where: {
        id: booking.id,
        status: { in: [...BOOKING_ACTIVE_STATUSES] },
        expiredAt: null,
      },
      data: {
        status: "NO_SHOW",
        expiredAt: now,
        expireReason: noticeReasons.booking,
      },
    });

    if (updated.count === 0) continue;
    expiredBookings += updated.count;

    try {
      await notifyExpiredBooking(booking);
    } catch (error) {
      console.warn(`Expired booking notification failed for ${booking.id}:`, error);
    }
  }

  const pickupOrders = await prisma.order.findMany({
    where: {
      deliveryType: "PICKUP",
      createdAt: { lt: pickupOrderCutoff },
      status: { notIn: [...ORDER_FINAL_STATUSES] },
      expiredAt: null,
    },
    select: {
      id: true,
      business: { select: { name: true } },
    },
  });

  let expiredPickupOrders = 0;
  for (const order of pickupOrders) {
    const updated = await prisma.order.updateMany({
      where: {
        id: order.id,
        deliveryType: "PICKUP",
        status: { notIn: [...ORDER_FINAL_STATUSES] },
        expiredAt: null,
      },
      data: {
        status: "EXPIRED",
        expiredAt: now,
        expireReason: noticeReasons.pickupOrder,
      },
    });

    if (updated.count === 0) continue;
    expiredPickupOrders += updated.count;

    try {
      await notifyExpiredPickupOrder(order);
    } catch (error) {
      console.warn(`Expired pickup order notification failed for ${order.id}:`, error);
    }
  }

  return {
    expiredBookings,
    expiredPickupOrders,
  };
}
