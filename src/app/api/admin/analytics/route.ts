import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
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

export async function GET(request: NextRequest) {
  const finishTiming = createServerTiming("seller_analytics");
  try {
  const session = await getAdminSession(request);
  if (!session) return finishTiming(jsonError("Нужен вход в панель продавца.", 401));
  if (session.role === "MANAGER") return finishTiming(jsonError("У менеджера нет доступа к аналитике.", 403));

  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get("businessId") || session.businessId;
  if (!businessId || !canUseBusiness(session, businessId)) {
    return finishTiming(jsonError("Нет доступа к аналитике этого бизнеса.", 403));
  }

  const period = parsePeriod(searchParams);
  if (!period) return finishTiming(jsonError("Проверьте выбранный период.", 400));

  const currentWhere: Prisma.OrderWhereInput = { businessId, createdAt: { gte: period.from, lt: period.to } };
  const previousWhere: Prisma.OrderWhereInput = { businessId, createdAt: { gte: period.previousFrom, lt: period.previousTo } };
  const validRevenueFilter: Prisma.OrderWhereInput = {
    status: { notIn: ["CANCELLED", "EXPIRED"] },
    AND: [
      {
        OR: [
          { paymentStatus: null },
          { paymentStatus: { notIn: [...INVALID_PAYMENT_STATUSES] } },
        ],
      },
      {
        OR: [
          { paymentStatus: "PAID" },
          { status: { in: [...COMPLETED_STATUSES] } },
        ],
      },
    ],
  };
  const completedWhere: Prisma.OrderWhereInput = { AND: [currentWhere, validRevenueFilter] };
  const previousCompletedWhere: Prisma.OrderWhereInput = { AND: [previousWhere, validRevenueFilter] };

  const [
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
  ] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { id: true, name: true, slug: true } }),
    prisma.order.count({ where: currentWhere }),
    prisma.order.aggregate({
      where: completedWhere,
      _count: { id: true },
      _sum: { totalPrice: true },
      _avg: { totalPrice: true },
    }),
    prisma.order.count({ where: { ...currentWhere, status: "CANCELLED" } }),
    prisma.customer.count({ where: { businessId, createdAt: { gte: period.from, lt: period.to } } }),
    prisma.order.groupBy({
      by: ["status"],
      where: currentWhere,
      _count: { id: true },
      _sum: { totalPrice: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.order.findMany({
      where: currentWhere,
      select: { createdAt: true, totalPrice: true, status: true, paymentStatus: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.orderItem.aggregate({
      where: { order: completedWhere },
      _sum: { quantity: true },
    }),
    prisma.orderItem.groupBy({
      by: ["itemId", "name"],
      where: { order: completedWhere },
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    }),
    prisma.order.groupBy({
      by: ["customerId", "customerName"],
      where: { ...completedWhere, customerId: { not: null } },
      _sum: { totalPrice: true },
      _count: { id: true },
      orderBy: { _sum: { totalPrice: "desc" } },
      take: 10,
    }),
    prisma.order.groupBy({
      by: ["customerId"],
      where: { ...completedWhere, customerId: { not: null } },
      _count: { id: true },
    }),
    prisma.order.groupBy({
      by: ["promoCode", "promoDiscountPercent"],
      where: { ...completedWhere, promoCode: { not: null } },
      _count: { id: true },
      _sum: { discountAmount: true, totalPrice: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }).catch((error) => {
      const classification = classifyDatabaseError(error);
      if (!["missing_column", "missing_table"].includes(classification.type)) throw error;
      warnPrismaSchemaDrift("Seller analytics loaded without promo usage", error);
      return [];
    }),
    prisma.order.aggregate({
      where: completedWhere,
      _sum: { discountAmount: true },
    }).catch((error) => {
      const classification = classifyDatabaseError(error);
      if (!["missing_column", "missing_table"].includes(classification.type)) throw error;
      warnPrismaSchemaDrift("Seller analytics loaded without discount totals", error);
      return { _sum: { discountAmount: 0 } };
    }),
    prisma.order.count({ where: previousWhere }),
    prisma.order.aggregate({
      where: previousCompletedWhere,
      _count: { id: true },
      _sum: { totalPrice: true },
      _avg: { totalPrice: true },
    }),
    prisma.customer.count({ where: { businessId, createdAt: { gte: period.previousFrom, lt: period.previousTo } } }),
  ]);

  if (!business) return finishTiming(jsonError("Бизнес не найден.", 404));

  const dailyMap = new Map<string, { date: string; revenue: number; orders: number }>();
  for (const order of dailySource) {
    const date = order.createdAt.toISOString().slice(0, 10);
    const entry = dailyMap.get(date) || { date, revenue: 0, orders: 0 };
    entry.orders += 1;
    const hasValidPayment = !INVALID_PAYMENT_STATUSES.includes(
      order.paymentStatus as (typeof INVALID_PAYMENT_STATUSES)[number]
    );
    const countsAsRevenue = hasValidPayment &&
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
      revenue: "Только оплаченные, завершённые или доставленные заказы без отмены и отклонённой оплаты.",
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
