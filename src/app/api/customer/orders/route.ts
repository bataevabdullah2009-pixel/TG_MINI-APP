import { NextRequest, NextResponse } from "next/server";
import { BookingStatus, OrderStatus } from "@prisma/client";
import { getTelegramSessionUser } from "@/lib/auth-telegram";
import { prisma } from "@/lib/prisma";
import { classifyDatabaseError, toJsonSafe, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";
import { createServerTiming } from "@/lib/server-timing";

const orderHistoryLegacySelect = {
  id: true,
  businessId: true,
  customerId: true,
  customerName: true,
  customerPhone: true,
  customerAddress: true,
  totalPrice: true,
  status: true,
  deliveryType: true,
  comment: true,
  internalNotes: true,
  createdAt: true,
  updatedAt: true,
  business: { select: { id: true, slug: true, name: true, primaryColor: true, accentColor: true } },
  items: true,
} as const;

const orderHistorySelect = {
  ...orderHistoryLegacySelect,
  paymentMethod: true,
  paymentStatus: true,
  paymentProofUrl: true,
  paymentProofFileName: true,
  paymentProofMimeType: true,
  paymentReviewedAt: true,
  paymentReviewedBy: true,
  paymentRejectReason: true,
  expiredAt: true,
  expireReason: true,
  itemsSubtotal: true,
  promoCode: true,
  promoDiscountPercent: true,
  discountAmount: true,
  deliveryFee: true,
  deliveryStatus: true,
  deliveryZoneId: true,
  deliveryZoneName: true,
  deliveryCityArea: true,
  deliveryAssignment: { select: { courier: { select: { name: true, phone: true } } } },
} as const;

const bookingHistoryLegacySelect = {
  id: true,
  businessId: true,
  customerId: true,
  serviceId: true,
  staffId: true,
  customerName: true,
  customerPhone: true,
  startTime: true,
  endTime: true,
  status: true,
  comment: true,
  internalNotes: true,
  reminderSent: true,
  reminderSentAt: true,
  createdAt: true,
  updatedAt: true,
  business: { select: { id: true, slug: true, name: true, primaryColor: true, accentColor: true } },
  service: { select: { id: true, name: true, price: true } },
  staff: { select: { id: true, name: true } },
} as const;

const bookingHistorySelect = {
  ...bookingHistoryLegacySelect,
  expiredAt: true,
  expireReason: true,
} as const;

async function resolveBusinessId(value: string) {
  if (!value) return undefined;
  const business = await prisma.business.findFirst({
    where: {
      OR: [
        { id: value },
        { slug: value },
        { slug: { equals: value, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return business?.id;
}

type HistoryTab = "all" | "orders" | "bookings";

type HistoryOptions = {
  limit: number;
  offset: number;
  tab: HistoryTab;
  status: string;
};

function parseOrderStatus(status: string) {
  return Object.values(OrderStatus).includes(status as OrderStatus)
    ? status as OrderStatus
    : undefined;
}

function parseBookingStatus(status: string) {
  return Object.values(BookingStatus).includes(status as BookingStatus)
    ? status as BookingStatus
    : undefined;
}

async function loadHistory(
  customerIds: string[],
  useLegacySelect: boolean,
  options: HistoryOptions
) {
  const orderStatus = options.status === "ALL" ? undefined : parseOrderStatus(options.status);
  const bookingStatus = options.status === "ALL" ? undefined : parseBookingStatus(options.status);
  const take = options.limit + 1;

  const [orders, bookings] = await Promise.all([
    options.tab === "bookings"
      ? Promise.resolve([])
      : prisma.order.findMany({
          where: {
            customerId: { in: customerIds },
            ...(orderStatus ? { status: orderStatus } : {}),
          },
          select: useLegacySelect ? orderHistoryLegacySelect : orderHistorySelect,
          orderBy: { createdAt: "desc" },
          skip: options.offset,
          take,
        }),
    options.tab === "orders"
      ? Promise.resolve([])
      : prisma.booking.findMany({
          where: {
            customerId: { in: customerIds },
            ...(bookingStatus ? { status: bookingStatus } : {}),
          },
          select: useLegacySelect ? bookingHistoryLegacySelect : bookingHistorySelect,
          orderBy: { startTime: "desc" },
          skip: options.offset,
          take,
        }),
  ]);

  return {
    orders: orders.slice(0, options.limit),
    bookings: bookings.slice(0, options.limit),
    pagination: {
      orders: {
        offset: options.offset,
        limit: options.limit,
        hasMore: orders.length > options.limit,
        nextOffset: orders.length > options.limit ? options.offset + options.limit : null,
      },
      bookings: {
        offset: options.offset,
        limit: options.limit,
        hasMore: bookings.length > options.limit,
        nextOffset: bookings.length > options.limit ? options.offset + options.limit : null,
      },
    },
  };
}

export async function GET(request: NextRequest) {
  const finishTiming = createServerTiming("customer_order_history");
  try {
    const initData = request.headers.get("x-telegram-init-data") || "";
    if (!initData) {
      return finishTiming(NextResponse.json({ ok: false, error: "Нужна авторизация через Telegram." }, { status: 401 }));
    }

    const { searchParams } = new URL(request.url);
    const businessSlug = searchParams.get("businessSlug") || "";
    const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit")) || 10));
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
    const requestedTab = String(searchParams.get("tab") || "all").toLowerCase();
    const tab: HistoryTab = requestedTab === "orders" || requestedTab === "bookings"
      ? requestedTab
      : "all";
    const status = String(searchParams.get("status") || "ALL").toUpperCase();
    const businessId = await resolveBusinessId(businessSlug);
    if (businessSlug && !businessId) {
      return finishTiming(NextResponse.json(
        { ok: false, code: "BUSINESS_NOT_FOUND", error: "Бизнес не найден." },
        { status: 404 }
      ));
    }
    const session = await getTelegramSessionUser(initData, businessId);

    if (!session) {
      return finishTiming(NextResponse.json({ ok: false, error: "Нужна авторизация через Telegram." }, { status: 401 }));
    }

    const customers = await prisma.customer.findMany({
      where: {
        telegramUserId: BigInt(session.telegramUserId),
        ...(businessId ? { businessId } : {}),
      },
      select: { id: true },
    });

    if (customers.length === 0) {
      return finishTiming(NextResponse.json({
        ok: true,
        orders: [],
        bookings: [],
        pagination: {
          orders: { offset, limit, hasMore: false, nextOffset: null },
          bookings: { offset, limit, hasMore: false, nextOffset: null },
        },
      }));
    }

    const customerIds = customers.map((customer) => customer.id);
    let schemaFallback = false;
    let history;

    try {
      history = await loadHistory(customerIds, false, { limit, offset, tab, status });
    } catch (error) {
      const classification = classifyDatabaseError(error);
      if (classification.type !== "missing_table" && classification.type !== "missing_column") throw error;
      schemaFallback = true;
      warnPrismaSchemaDrift("Customer order history retried without optional payment/delivery schema", error);
      history = await loadHistory(customerIds, true, { limit, offset, tab, status });
    }

    return finishTiming(NextResponse.json(toJsonSafe({
      ok: true,
      orders: history.orders,
      bookings: history.bookings,
      pagination: history.pagination,
      schemaFallback,
    })));
  } catch (error) {
    const classification = classifyDatabaseError(error);
    warnPrismaSchemaDrift("GET /api/customer/orders failed", error);
    return finishTiming(NextResponse.json(
      { ok: false, code: classification.code, error: "Не удалось загрузить историю заказов и записей. Причина записана в server logs." },
      { status: 503 }
    ));
  }
}
