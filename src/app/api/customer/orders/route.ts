import { NextRequest, NextResponse } from "next/server";
import { getTelegramSessionUser } from "@/lib/auth-telegram";
import { prisma } from "@/lib/prisma";
import { classifyDatabaseError, toJsonSafe, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";

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
  paymentProofAiStatus: true,
  paymentProofAiSummary: true,
  paymentProofAiConfidence: true,
  paymentReviewedAt: true,
  paymentReviewedBy: true,
  paymentRejectReason: true,
  expiredAt: true,
  expireReason: true,
  itemsSubtotal: true,
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
  service: true,
  staff: true,
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

async function loadHistory(customerIds: string[], useLegacySelect: boolean) {
  const [orders, bookings] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: { in: customerIds } },
      select: useLegacySelect ? orderHistoryLegacySelect : orderHistorySelect,
      orderBy: { createdAt: "desc" },
    }),
    prisma.booking.findMany({
      where: { customerId: { in: customerIds } },
      select: useLegacySelect ? bookingHistoryLegacySelect : bookingHistorySelect,
      orderBy: { startTime: "desc" },
    }),
  ]);

  return { orders, bookings };
}

export async function GET(request: NextRequest) {
  try {
    const initData = request.headers.get("x-telegram-init-data") || "";
    if (!initData) {
      return NextResponse.json({ ok: false, error: "Нужна авторизация через Telegram." }, { status: 401 });
    }

    const businessSlug = new URL(request.url).searchParams.get("businessSlug") || "";
    const businessId = await resolveBusinessId(businessSlug);
    const session = await getTelegramSessionUser(initData, businessId);

    if (!session) {
      return NextResponse.json({ ok: false, error: "Нужна авторизация через Telegram." }, { status: 401 });
    }

    const customers = await prisma.customer.findMany({
      where: {
        telegramUserId: BigInt(session.telegramUserId),
        ...(businessId ? { businessId } : {}),
      },
      select: { id: true },
    });

    if (customers.length === 0) {
      return NextResponse.json({ ok: true, orders: [], bookings: [] });
    }

    const customerIds = customers.map((customer) => customer.id);
    let schemaFallback = false;
    let history;

    try {
      history = await loadHistory(customerIds, false);
    } catch (error) {
      const classification = classifyDatabaseError(error);
      if (classification.type !== "missing_table" && classification.type !== "missing_column") throw error;
      schemaFallback = true;
      warnPrismaSchemaDrift("Customer order history retried without optional payment/delivery schema", error);
      history = await loadHistory(customerIds, true);
    }

    return NextResponse.json(toJsonSafe({
      ok: true,
      orders: history.orders,
      bookings: history.bookings,
      schemaFallback,
    }));
  } catch (error) {
    const classification = classifyDatabaseError(error);
    warnPrismaSchemaDrift("GET /api/customer/orders failed", error);
    return NextResponse.json(
      { ok: false, code: classification.code, error: "Не удалось загрузить историю заказов и записей. Причина записана в server logs." },
      { status: 503 }
    );
  }
}
