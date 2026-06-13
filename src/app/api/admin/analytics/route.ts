import { NextRequest, NextResponse } from "next/server";
import {
  canUseBusiness,
  getAdminSession,
  getCurrentBusinessForSeller,
  jsonError,
} from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { createServerTiming } from "@/lib/server-timing";
import { classifyDatabaseError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";

const COMPLETED_STATUSES = ["COMPLETED", "DELIVERED"] as const;
const INVALID_PAYMENT_STATUSES = ["PAYMENT_REJECTED", "REJECTED", "FAILED", "REFUNDED"] as const;

const statusLabels: Record<string, string> = {
  NEW: "Новый",
  ACCEPTED: "Принят",
  PREPARING: "Готовится",
  READY: "Готов",
  READY_FOR_PICKUP: "Готов к самовывозу",
  READY_FOR_DELIVERY: "Ожидает курьера",
  COURIER_ASSIGNED: "Курьер назначен",
  PICKED_UP: "В пути",
  DELIVERING: "Доставляется",
  DELIVERED: "Доставлен",
  COMPLETED: "Завершён",
  CANCELLED: "Отменён",
  EXPIRED: "Истёк",
};

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endExclusive(date: Date) {
  const result = startOfDay(date);
  result.setDate(result.getDate() + 1);
  return result;
}

function parsePeriod(searchParams: URLSearchParams) {
  const now = new Date();
  const preset = searchParams.get("period") || "30";
  let from: Date;
  let to = endExclusive(now);

  if (preset === "today") {
    from = startOfDay(now);
  } else if (preset === "custom") {
    const rawFrom = new Date(String(searchParams.get("from") || ""));
    const rawTo = new Date(String(searchParams.get("to") || ""));
    if (Number.isNaN(rawFrom.getTime()) || Number.isNaN(rawTo.getTime())) return null;
    from = startOfDay(rawFrom);
    to = endExclusive(rawTo);
  } else {
    const days = [7, 30, 90].includes(Number(preset)) ? Number(preset) : 30;
    from = startOfDay(now);
    from.setDate(from.getDate() - days + 1);
  }

  if (from >= to) return null;
  const maxFrom = new Date(to);
  maxFrom.setDate(maxFrom.getDate() - 366);
  if (from < maxFrom) from = maxFrom;
  const duration = to.getTime() - from.getTime();

  return {
    preset,
    from,
    to,
    previousFrom: new Date(from.getTime() - duration),
    previousTo: from,
  };
}

function growth(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

type AnalyticsPeriod = NonNullable<ReturnType<typeof parsePeriod>>;

type AnalyticsOrder = {
  id: string;
  customerId: string | null;
  customerName: string;
  totalPrice: number;
  status: string;
  paymentStatus: string | null;
  promoCode: string | null;
  promoDiscountPercent: number | null;
  discountAmount: number;
  createdAt: Date;
  customer: { createdAt: Date } | null;
  items: Array<{
    itemId: string | null;
    name: string;
    quantity: number;
  }>;
};

const analyticsLegacyOrderSelect = {
  id: true,
  customerId: true,
  customerName: true,
  totalPrice: true,
  status: true,
  createdAt: true,
  customer: { select: { createdAt: true } },
  items: { select: { itemId: true, name: true, quantity: true } },
} as const;

const analyticsOrderSelect = {
  ...analyticsLegacyOrderSelect,
  paymentStatus: true,
  promoCode: true,
  promoDiscountPercent: true,
  discountAmount: true,
} as const;

async function loadAnalyticsData(businessId: string, period: AnalyticsPeriod, legacySchema: boolean) {
  const ordersPromise: Promise<AnalyticsOrder[]> = legacySchema
    ? prisma.order.findMany({
        where: {
          businessId,
          createdAt: { gte: period.previousFrom, lt: period.to },
        },
        select: analyticsLegacyOrderSelect,
        orderBy: { createdAt: "asc" },
      }).then((orders) => orders.map((order) => ({
        ...order,
        paymentStatus: null,
        promoCode: null,
        promoDiscountPercent: null,
        discountAmount: 0,
      })))
    : prisma.order.findMany({
        where: {
          businessId,
          createdAt: { gte: period.previousFrom, lt: period.to },
        },
        select: analyticsOrderSelect,
        orderBy: { createdAt: "asc" },
      });

  const [business, orders] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { id: true, name: true, slug: true } }),
    ordersPromise,
  ]);

  const inPeriod = (date: Date, from: Date, to: Date) => date >= from && date < to;
  const countsAsRevenue = (order: AnalyticsOrder) => {
    if (legacySchema) {
      return COMPLETED_STATUSES.includes(order.status as (typeof COMPLETED_STATUSES)[number]);
    }
    return (
      order.status !== "CANCELLED" &&
      order.status !== "EXPIRED" &&
      !INVALID_PAYMENT_STATUSES.includes(
        order.paymentStatus as (typeof INVALID_PAYMENT_STATUSES)[number]
      ) &&
      (order.paymentStatus === "PAID" ||
        COMPLETED_STATUSES.includes(order.status as (typeof COMPLETED_STATUSES)[number]))
    );
  };

  const currentOrders = orders.filter((order) => inPeriod(order.createdAt, period.from, period.to));
  const previousOrders = orders.filter((order) =>
    inPeriod(order.createdAt, period.previousFrom, period.previousTo)
  );
  const currentRevenueOrders = currentOrders.filter(countsAsRevenue);
  const previousRevenueOrders = previousOrders.filter(countsAsRevenue);
  const revenue = currentRevenueOrders.reduce((sum, order) => sum + order.totalPrice, 0);
  const previousRevenue = previousRevenueOrders.reduce((sum, order) => sum + order.totalPrice, 0);

  const customerCount = (source: AnalyticsOrder[], from: Date, to: Date) =>
    new Set(
      source
        .filter((order) =>
          Boolean(order.customerId && order.customer && inPeriod(order.customer.createdAt, from, to))
        )
        .map((order) => order.customerId as string)
    ).size;

  const statusMap = new Map<string, { count: number; amount: number }>();
  for (const order of currentOrders) {
    const entry = statusMap.get(order.status) || { count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += order.totalPrice;
    statusMap.set(order.status, entry);
  }
  const statusGroups = Array.from(statusMap, ([status, value]) => ({
    status,
    _count: { id: value.count },
    _sum: { totalPrice: value.amount },
  })).sort((left, right) => right._count.id - left._count.id);

  const productMap = new Map<string, {
    itemId: string | null;
    name: string;
    quantity: number;
    count: number;
  }>();
  let soldUnits = 0;
  for (const order of currentRevenueOrders) {
    for (const item of order.items) {
      soldUnits += item.quantity;
      const key = `${item.itemId || ""}\u0000${item.name}`;
      const entry = productMap.get(key) || {
        itemId: item.itemId,
        name: item.name,
        quantity: 0,
        count: 0,
      };
      entry.quantity += item.quantity;
      entry.count += 1;
      productMap.set(key, entry);
    }
  }
  const topProducts = Array.from(productMap.values())
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 10)
    .map((item) => ({
      itemId: item.itemId,
      name: item.name,
      _sum: { quantity: item.quantity },
      _count: { id: item.count },
    }));

  const customerMap = new Map<string, {
    customerId: string;
    customerName: string;
    revenue: number;
    orders: number;
  }>();
  for (const order of currentRevenueOrders) {
    if (!order.customerId) continue;
    const entry = customerMap.get(order.customerId) || {
      customerId: order.customerId,
      customerName: order.customerName,
      revenue: 0,
      orders: 0,
    };
    entry.revenue += order.totalPrice;
    entry.orders += 1;
    customerMap.set(order.customerId, entry);
  }
  const topCustomers = Array.from(customerMap.values())
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 10)
    .map((item) => ({
      customerId: item.customerId,
      customerName: item.customerName,
      _sum: { totalPrice: item.revenue },
      _count: { id: item.orders },
    }));
  const repeatCustomerGroups = Array.from(customerMap.values()).map((item) => ({
    customerId: item.customerId,
    _count: { id: item.orders },
  }));

  const promoMap = new Map<string, {
    promoCode: string;
    promoDiscountPercent: number | null;
    orders: number;
    discountAmount: number;
    revenue: number;
  }>();
  for (const order of currentRevenueOrders) {
    if (!order.promoCode) continue;
    const key = `${order.promoCode}\u0000${order.promoDiscountPercent ?? ""}`;
    const entry = promoMap.get(key) || {
      promoCode: order.promoCode,
      promoDiscountPercent: order.promoDiscountPercent,
      orders: 0,
      discountAmount: 0,
      revenue: 0,
    };
    entry.orders += 1;
    entry.discountAmount += order.discountAmount;
    entry.revenue += order.totalPrice;
    promoMap.set(key, entry);
  }
  const promoUsage = Array.from(promoMap.values())
    .sort((left, right) => right.orders - left.orders)
    .slice(0, 10)
    .map((item) => ({
      promoCode: item.promoCode,
      promoDiscountPercent: item.promoDiscountPercent,
      _count: { id: item.orders },
      _sum: { discountAmount: item.discountAmount, totalPrice: item.revenue },
    }));

  return {
    business,
    totalOrders: currentOrders.length,
    completed: {
      _count: { id: currentRevenueOrders.length },
      _sum: { totalPrice: revenue },
      _avg: {
        totalPrice: currentRevenueOrders.length ? revenue / currentRevenueOrders.length : 0,
      },
    },
    cancelledOrders: currentOrders.filter((order) => order.status === "CANCELLED").length,
    newCustomers: customerCount(currentOrders, period.from, period.to),
    statusGroups,
    dailySource: currentOrders.map((order) => ({
      createdAt: order.createdAt,
      totalPrice: order.totalPrice,
      status: order.status,
      paymentStatus: order.paymentStatus,
    })),
    soldItems: { _sum: { quantity: soldUnits } },
    topProducts,
    topCustomers,
    repeatCustomerGroups,
    promoUsage,
    discountAggregate: {
      _sum: {
        discountAmount: currentRevenueOrders.reduce(
          (sum, order) => sum + order.discountAmount,
          0
        ),
      },
    },
    previousTotalOrders: previousOrders.length,
    previousCompleted: {
      _count: { id: previousRevenueOrders.length },
      _sum: { totalPrice: previousRevenue },
      _avg: {
        totalPrice: previousRevenueOrders.length
          ? previousRevenue / previousRevenueOrders.length
          : 0,
      },
    },
    previousNewCustomers: customerCount(
      previousOrders,
      period.previousFrom,
      period.previousTo
    ),
    schemaFallback: legacySchema,
  };
}

export async function GET(request: NextRequest) {
  const finishTiming = createServerTiming("seller_analytics");
  try {
    const session = await getAdminSession(request);
    if (!session) return finishTiming(jsonError("Нужен вход в панель продавца.", 401));
    if (session.role === "MANAGER") return finishTiming(jsonError("У менеджера нет доступа к аналитике.", 403));

    const { searchParams } = new URL(request.url);
    const businessId =
      searchParams.get("businessId") ||
      session.businessId ||
      await getCurrentBusinessForSeller(session);
    if (!businessId || !canUseBusiness(session, businessId)) {
      return finishTiming(jsonError("Нет доступа к аналитике этого бизнеса.", 403));
    }

    const period = parsePeriod(searchParams);
    if (!period) return finishTiming(jsonError("Проверьте выбранный период.", 400));

    let analytics;
    try {
      analytics = await loadAnalyticsData(businessId, period, false);
    } catch (error) {
      const classification = classifyDatabaseError(error);
      if (classification.type !== "missing_column" && classification.type !== "missing_table") throw error;
      warnPrismaSchemaDrift("Seller analytics retried with legacy order schema", error);
      analytics = await loadAnalyticsData(businessId, period, true);
    }

    const {
      business,
      totalOrders,
      completed,
      cancelledOrders,
      newCustomers,
      statusGroups,
      dailySource,
      soldItems,
      topProducts,
      topCustomers,
      repeatCustomerGroups,
      promoUsage,
      discountAggregate,
      previousTotalOrders,
      previousCompleted,
      previousNewCustomers,
      schemaFallback,
    } = analytics;

    if (!business) return finishTiming(jsonError("Бизнес не найден.", 404));

    const dailyMap = new Map<string, { date: string; revenue: number; orders: number }>();
    for (const order of dailySource) {
      const date = order.createdAt.toISOString().slice(0, 10);
      const entry = dailyMap.get(date) || { date, revenue: 0, orders: 0 };
      entry.orders += 1;
      const hasValidPayment = !INVALID_PAYMENT_STATUSES.includes(
        order.paymentStatus as (typeof INVALID_PAYMENT_STATUSES)[number]
      );
      const countsAsRevenue = schemaFallback
        ? COMPLETED_STATUSES.includes(order.status as (typeof COMPLETED_STATUSES)[number])
        : hasValidPayment &&
          order.status !== "CANCELLED" &&
          order.status !== "EXPIRED" &&
          (order.paymentStatus === "PAID" ||
            COMPLETED_STATUSES.includes(order.status as (typeof COMPLETED_STATUSES)[number]));
      if (countsAsRevenue) {
        entry.revenue += order.totalPrice;
      }
      dailyMap.set(date, entry);
    }

    const revenue = completed._sum.totalPrice || 0;
    const previousRevenue = previousCompleted._sum.totalPrice || 0;
    const averageCheck = completed._avg.totalPrice || 0;
    const previousAverageCheck = previousCompleted._avg.totalPrice || 0;

    return finishTiming(NextResponse.json({
      ok: true,
      business,
      schemaFallback,
      period: { preset: period.preset, from: period.from.toISOString(), to: period.to.toISOString() },
      metrics: {
        revenue,
        orders: totalOrders,
        completedOrders: completed._count.id,
        averageCheck,
        newCustomers,
        repeatCustomers: repeatCustomerGroups.filter((item) => item._count.id > 1).length,
        cancelledOrders,
        completionPercent: totalOrders ? Math.round((completed._count.id / totalOrders) * 1000) / 10 : 0,
        soldUnits: soldItems._sum.quantity || 0,
        discountAmount: discountAggregate._sum.discountAmount || 0,
      },
      explanations: {
        revenue: schemaFallback
          ? "Выручка по завершённым и доставленным заказам. Обновите SQL-схему для учёта статуса оплаты."
          : "Только оплаченные, завершённые или доставленные заказы без отмены и отклонённой оплаты.",
        averageCheck: "Среднее только по заказам, вошедшим в выручку.",
        conversion: "Доля оплаченных, завершённых или доставленных заказов от всех заказов периода.",
        topProducts: "По количеству проданных единиц из заказов, вошедших в выручку.",
        cancelled: "Отменённые заказы показаны отдельно и не входят в выручку.",
      },
      growth: {
        revenue: growth(revenue, previousRevenue),
        orders: growth(totalOrders, previousTotalOrders),
        averageCheck: growth(averageCheck, previousAverageCheck),
        newCustomers: growth(newCustomers, previousNewCustomers),
      },
      daily: Array.from(dailyMap.values()),
      statuses: statusGroups.map((item) => ({
        status: item.status,
        label: statusLabels[item.status] || item.status,
        count: item._count.id,
        amount: item._sum.totalPrice || 0,
      })),
      topProducts: topProducts.map((item) => ({
        itemId: item.itemId,
        name: item.name,
        quantity: item._sum.quantity || 0,
      })),
      topCustomers: topCustomers.map((item) => ({
        customerId: item.customerId,
        name: item.customerName,
        orders: item._count.id,
        revenue: item._sum.totalPrice || 0,
      })),
      promoUsage: promoUsage.map((item) => ({
        code: item.promoCode,
        discountPercent: item.promoDiscountPercent,
        orders: item._count.id,
        discountAmount: item._sum.discountAmount || 0,
        revenue: item._sum.totalPrice || 0,
      })),
    }));
  } catch (error) {
    const classification = classifyDatabaseError(error);
    warnPrismaSchemaDrift("GET /api/admin/analytics failed", error);
    return finishTiming(NextResponse.json(
      {
        ok: false,
        code: classification.code,
        error: "Не удалось загрузить аналитику. Повторите попытку.",
      },
      { status: 503 }
    ));
  }
}
