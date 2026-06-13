"use client";

import React, { useState, useEffect } from "react";
import { ClipboardList, Calendar, Check, X, Clock, HelpCircle } from "lucide-react";
import { miniAppFetch } from "@/lib/miniAppFetch";
import {
  beginMiniAppQuery,
  readMiniAppQueryCache,
  writeMiniAppQueryCache,
} from "@/lib/miniAppQuery";

interface ClientOrdersProps {
  businessId?: string;
  telegramUserId?: string;
}

type ClientOrderTab = "ORDERS" | "BOOKINGS";

type HistoryPage = {
  items: any[];
  hasMore: boolean;
  nextOffset: number | null;
};

const PAGE_SIZE = 10;
const HISTORY_STATUS = "ALL";

export function ClientOrders({ businessId = "global", telegramUserId }: ClientOrdersProps) {
  const [activeTab, setActiveTab] = useState<"ORDERS" | "BOOKINGS">("ORDERS");
  const [data, setData] = useState<{ orders: any[]; bookings: any[] }>({ orders: [], bookings: [] });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [offsets, setOffsets] = useState<Record<ClientOrderTab, number>>({
    ORDERS: 0,
    BOOKINGS: 0,
  });
  const [hasMore, setHasMore] = useState<Record<ClientOrderTab, boolean>>({
    ORDERS: false,
    BOOKINGS: false,
  });

  useEffect(() => {
    if (!telegramUserId) {
      setData({ orders: [], bookings: [] });
      setLoading(false);
      setError("История заказов доступна после загрузки Telegram-профиля.");
      return undefined;
    }

    const offset = offsets[activeTab];
    const queryKey = [
      "client-orders",
      businessId,
      telegramUserId,
      activeTab,
      HISTORY_STATUS,
      offset,
      retryKey,
    ] as const;
    const request = beginMiniAppQuery(
      `client-orders:${businessId}:${telegramUserId}`,
      queryKey
    );
    const cached = readMiniAppQueryCache<HistoryPage>(queryKey);

    const applyPage = (page: HistoryPage) => {
      if (!request.isCurrent()) return;
      setData((current) => {
        const field = activeTab === "ORDERS" ? "orders" : "bookings";
        const currentItems = offset === 0 ? [] : current[field];
        const itemMap = new Map(currentItems.map((item) => [item.id, item]));
        for (const item of page.items) itemMap.set(item.id, item);
        return { ...current, [field]: Array.from(itemMap.values()) };
      });
      setHasMore((current) => ({ ...current, [activeTab]: page.hasMore }));
    };

    if (cached) {
      applyPage(cached);
      setError(null);
      setLoading(false);
      setLoadingMore(false);
      request.finish();
      return () => request.cancel();
    }

    if (offset === 0) {
      setLoading(true);
      setData((current) => ({
        ...current,
        [activeTab === "ORDERS" ? "orders" : "bookings"]: [],
      }));
    } else {
      setLoadingMore(true);
    }
    setError(null);
    setExpandedId(null);

    const query = new URLSearchParams({
      tab: activeTab.toLowerCase(),
      status: HISTORY_STATUS,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (businessId && businessId !== "global") {
      query.set("businessSlug", businessId);
    }

    miniAppFetch(`/api/customer/orders?${query.toString()}`, { signal: request.signal })
      .then(async (res) => {
        const resData = await res.json().catch(() => ({}));
        if (!res.ok || !resData.ok) {
          throw new Error(resData.error || "Не удалось загрузить историю заказов.");
        }

        const field = activeTab === "ORDERS" ? "orders" : "bookings";
        const pagination = resData.pagination?.[field] || {};
        const page: HistoryPage = {
          items: Array.isArray(resData[field]) ? resData[field].filter(Boolean) : [],
          hasMore: Boolean(pagination.hasMore),
          nextOffset: typeof pagination.nextOffset === "number" ? pagination.nextOffset : null,
        };
        applyPage(page);
        writeMiniAppQueryCache(queryKey, page, 15_000);
      })
      .catch((e) => {
        if (request.signal.aborted) return;
        console.error(e);
        if (request.isCurrent()) {
          setError(e instanceof Error && e.name === "AbortError"
            ? "История не ответила за 15 секунд."
            : e instanceof Error ? e.message : "Ошибка загрузки данных.");
        }
      })
      .finally(() => {
        if (request.isCurrent()) {
          setLoading(false);
          setLoadingMore(false);
        }
        request.finish();
      });

    return () => request.cancel();
  }, [activeTab, businessId, offsets, retryKey, telegramUserId]);

  const selectTab = (tab: ClientOrderTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setOffsets((current) => ({ ...current, [tab]: 0 }));
  };

  const loadMore = () => {
    if (loadingMore || !hasMore[activeTab]) return;
    setOffsets((current) => ({
      ...current,
      [activeTab]: current[activeTab] + PAGE_SIZE,
    }));
  };

  const getOrderStatus = (status: string) => {
    switch (status) {
      case "NEW":
        return { label: "Новый", color: "bg-blue-50 text-blue-700 ring-blue-200" };
      case "CONFIRMED":
        return { label: "Подтвержден", color: "bg-indigo-50 text-indigo-700 ring-indigo-200" };
      case "ACCEPTED":
        return { label: "Принят", color: "bg-indigo-50 text-indigo-700 ring-indigo-200" };
      case "PROCESSING":
        return { label: "В работе", color: "bg-amber-50 text-amber-700 ring-amber-200" };
      case "PREPARING":
        return { label: "Готовится", color: "bg-amber-50 text-amber-700 ring-amber-200" };
      case "READY":
        return { label: "Готов", color: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
      case "READY_FOR_PICKUP":
        return { label: "Готов к самовывозу", color: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
      case "READY_FOR_DELIVERY":
        return { label: "Ожидает курьера", color: "bg-cyan-50 text-cyan-700 ring-cyan-200" };
      case "COURIER_ASSIGNED":
        return { label: "Курьер назначен", color: "bg-blue-50 text-blue-700 ring-blue-200" };
      case "PICKED_UP":
        return { label: "В пути", color: "bg-indigo-50 text-indigo-700 ring-indigo-200" };
      case "DELIVERING":
      case "IN_DELIVERY":
        return { label: "В пути", color: "bg-indigo-50 text-indigo-700 ring-indigo-200" };
      case "DELIVERED":
        return { label: "Доставлен", color: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
      case "COMPLETED":
        return { label: "Завершён", color: "bg-slate-100 text-slate-700 ring-slate-200" };
      case "CANCELLED":
        return { label: "Отменён", color: "bg-rose-50 text-rose-700 ring-rose-200" };
      case "EXPIRED":
        return { label: "Истёк", color: "bg-slate-100 text-slate-700 ring-slate-200" };
      default:
        return { label: "Статус уточняется", color: "bg-slate-50 text-slate-600 ring-slate-200" };
    }
  };

  const getBookingStatus = (status: string) => {
    switch (status) {
      case "NEW":
        return { label: "Ожидает", color: "bg-blue-50 text-blue-700 ring-blue-200" };
      case "CONFIRMED":
        return { label: "Подтвержден", color: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
      case "COMPLETED":
        return { label: "Выполнен", color: "bg-slate-100 text-slate-700 ring-slate-200" };
      case "CANCELLED":
        return { label: "Отменен", color: "bg-rose-50 text-rose-700 ring-rose-200" };
      case "EXPIRED":
        return { label: "Истекла", color: "bg-slate-100 text-slate-700 ring-slate-200" };
      case "NO_SHOW":
        return { label: "Клиент не пришёл", color: "bg-rose-50 text-rose-700 ring-rose-200" };
      default:
        return { label: "Статус уточняется", color: "bg-slate-50 text-slate-600 ring-slate-200" };
    }
  };

  const getTransferPaymentStatus = (status: string) => {
    if (status === "PAID") return "Оплата подтверждена";
    if (status === "PAYMENT_REJECTED" || status === "REJECTED") return "Оплата отклонена";
    return "Ожидает проверки продавцом";
  };

  return (
    <div className="px-4 py-5 text-slate-900 pb-24">
      <div className="mb-5">
        <h1 className="text-2xl font-black tracking-tight">Мои заказы</h1>
        <p className="text-xs font-semibold text-slate-400 mt-0.5">История ваших покупок и записей</p>
      </div>

      {/* Selector */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 mb-5">
        <button
          type="button"
          onClick={() => selectTab("ORDERS")}
          className={`rounded-xl py-2 text-xs font-black transition-all ${
            activeTab === "ORDERS" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
          }`}
        >
          Заказы ({data.orders.length})
        </button>
        <button
          type="button"
          onClick={() => selectTab("BOOKINGS")}
          className={`rounded-xl py-2 text-xs font-black transition-all ${
            activeTab === "BOOKINGS" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
          }`}
        >
          Записи ({data.bookings.length})
        </button>
      </div>

      {loading && (
        <div className="grid animate-pulse gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 rounded-3xl bg-white ring-1 ring-slate-100" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-rose-50 p-4 text-center text-xs font-bold text-rose-700 ring-1 ring-rose-200/50">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setRetryKey((value) => value + 1)}
            className="mt-3 rounded-xl bg-rose-700 px-4 py-2 text-white"
          >
            Повторить
          </button>
        </div>
      )}

      {!loading && !error && (
        <div>
          {/* Orders */}
          {activeTab === "ORDERS" && (
            <div className="grid gap-3">
              {data.orders.length === 0 ? (
                <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-slate-100/80">
                  <ClipboardList className="mx-auto mb-3 text-slate-300" size={40} />
                  <h4 className="font-extrabold text-slate-800">Заказов пока нет</h4>
                  <p className="mt-1 text-xs text-slate-400">Здесь будут отображаться ваши покупки в магазинах.</p>
                </div>
              ) : (
                data.orders.map((order) => {
                  const stat = getOrderStatus(order.status);
                  const dateStr = new Date(order.createdAt).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const isExpanded = expandedId === order.id;

                  return (
                    <div
                      key={order.id}
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                      className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 active:ring-slate-200 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                            {order.business.name}
                          </span>
                          <h4 className="text-sm font-extrabold text-slate-900 mt-0.5">
                            Заказ #{order.id.slice(-6).toUpperCase()}
                          </h4>
                          <span className="text-[10px] font-bold text-slate-400 block mt-0.5">{dateStr}</span>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ring-1 ${stat.color}`}>
                          {stat.label}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-2.5">
                        <span className="text-xs font-bold text-slate-500">
                          {order.items.length} поз.
                        </span>
                        <strong className="text-sm font-black text-slate-900">
                          {order.totalPrice} ₽
                        </strong>
                      </div>

                      {/* Expandable items description */}
                      {isExpanded && (
                        <div className="mt-3 border-t border-slate-100 pt-3 text-xs space-y-2">
                          <div className="font-bold text-slate-400 uppercase tracking-wider text-[9px] mb-1.5">Состав заказа</div>
                          {order.items.map((it: any) => (
                            <div key={it.id} className="flex items-start justify-between gap-3 text-slate-700">
                              <span className="min-w-0 flex-1 break-words">{it.name} × {it.quantity}</span>
                              <span className="shrink-0 whitespace-nowrap font-bold">{it.price * it.quantity} ₽</span>
                            </div>
                          ))}
                          {order.customerAddress && (
                            <div className="mt-2 text-slate-500 bg-slate-50 p-2 rounded-xl">
                              <span className="font-bold block text-[9px] text-slate-400">АДРЕС ДОСТАВКИ</span>
                              {order.customerAddress}
                            </div>
                          )}
                          {order.deliveryType === "DELIVERY" && (
                            <div className="mt-2 grid gap-1 rounded-xl bg-slate-50 p-2 text-slate-500">
                              <div className="flex justify-between gap-3"><span className="min-w-0">Товары</span><span className="shrink-0 whitespace-nowrap">{order.itemsSubtotal || order.totalPrice - (order.deliveryFee || 0)} ₽</span></div>
                              {order.discountAmount > 0 && (
                                <div className="flex justify-between gap-3 text-emerald-700">
                                  <span className="min-w-0">Скидка {order.promoCode ? `(${order.promoCode})` : ""}</span>
                                  <span className="shrink-0 whitespace-nowrap">−{order.discountAmount} ₽</span>
                                </div>
                              )}
                              <div className="flex items-start justify-between gap-3"><span className="min-w-0">Доставка {order.deliveryZoneName ? `(${order.deliveryZoneName})` : ""}</span><span className="shrink-0 whitespace-nowrap">{order.deliveryFee || 0} ₽</span></div>
                              {order.deliveryAssignment?.courier && <div className="font-bold text-indigo-700">Курьер: {order.deliveryAssignment.courier.name}</div>}
                            </div>
                          )}
                          {order.paymentMethod === "TRANSFER" && (
                            <div className="mt-2 space-y-1 rounded-xl bg-amber-50 p-2 font-bold text-amber-900 ring-1 ring-amber-100">
                              <div>Оплата переводом</div>
                              <div>Ожидаемая сумма: {order.totalPrice} ₽</div>
                              <div>{getTransferPaymentStatus(order.paymentStatus)}</div>
                              {order.paymentProofUrl && (
                                <a
                                  href={order.paymentProofUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                  className="inline-flex text-indigo-600 underline"
                                >
                                  Открыть чек
                                </a>
                              )}
                              {(order.paymentStatus === "PAYMENT_REJECTED" || order.paymentStatus === "REJECTED") && order.paymentRejectReason && (
                                <div className="text-rose-700">{order.paymentRejectReason}</div>
                              )}
                            </div>
                          )}
                          {order.comment && (
                            <div className="mt-1 text-slate-500 bg-slate-50 p-2 rounded-xl italic">
                              <span className="font-bold block text-[9px] text-slate-400">КОММЕНТАРИЙ</span>
                              "{order.comment}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Bookings */}
          {activeTab === "BOOKINGS" && (
            <div className="grid gap-3">
              {data.bookings.length === 0 ? (
                <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-slate-100/80">
                  <Calendar className="mx-auto mb-3 text-slate-300" size={40} />
                  <h4 className="font-extrabold text-slate-800">Записей пока нет</h4>
                  <p className="mt-1 text-xs text-slate-400">Здесь будут отображаться ваши бронирования.</p>
                </div>
              ) : (
                data.bookings.map((booking) => {
                  const stat = getBookingStatus(booking.status);
                  const dateStr = new Date(booking.startTime).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    weekday: "short",
                  });
                  const timeStr = `${new Date(booking.startTime).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })} - ${new Date(booking.endTime).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`;
                  const isExpanded = expandedId === booking.id;

                  return (
                    <div
                      key={booking.id}
                      onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                      className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 active:ring-slate-200 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                            {booking.business.name}
                          </span>
                          <h4 className="text-sm font-extrabold text-slate-900 mt-0.5">
                            {booking.service?.name || "Услуга"}
                          </h4>
                          <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                            📅 {dateStr} в {timeStr}
                          </span>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ring-1 ${stat.color}`}>
                          {stat.label}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-2.5">
                        <span className="text-xs font-bold text-slate-500">
                          Мастер: {booking.staff?.name || "Любой"}
                        </span>
                        <strong className="text-sm font-black text-slate-900">
                          {booking.service?.price || 0} ₽
                        </strong>
                      </div>

                      {/* Expandable bookings details */}
                      {isExpanded && booking.comment && (
                        <div className="mt-3 border-t border-slate-100 pt-2.5 text-xs text-slate-500 bg-slate-50 p-2 rounded-xl italic">
                          <span className="font-bold block text-[9px] text-slate-400 not-italic">КОММЕНТАРИЙ</span>
                          "{booking.comment}"
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {hasMore[activeTab] && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black text-white disabled:opacity-50"
            >
              {loadingMore ? "Загрузка..." : "Показать ещё"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
