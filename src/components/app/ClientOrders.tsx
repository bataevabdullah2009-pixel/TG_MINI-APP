"use client";

import React, { useState, useEffect } from "react";
import { ClipboardList, Calendar, Check, X, Clock, HelpCircle } from "lucide-react";
import { miniAppFetch } from "@/lib/miniAppFetch";

interface ClientOrdersProps {
  telegramUserId?: string;
}

export function ClientOrders({ telegramUserId }: ClientOrdersProps) {
  const [activeTab, setActiveTab] = useState<"ORDERS" | "BOOKINGS">("ORDERS");
  const [data, setData] = useState<{ orders: any[]; bookings: any[] }>({ orders: [], bookings: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!telegramUserId) {
      setLoading(false);
      setError("История заказов доступна после загрузки Telegram-профиля.");
      return undefined;
    }

    setLoading(true);
    setError(null);
    const controller = new AbortController();
    miniAppFetch("/api/customer/orders?limit=10", { signal: controller.signal })
      .then(async (res) => {
        const resData = await res.json().catch(() => ({}));
        if (!res.ok || !resData.ok) {
          throw new Error(resData.error || "Не удалось загрузить историю заказов.");
        }
        setData({ orders: resData.orders || [], bookings: resData.bookings || [] });
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        console.error(e);
        setError(e instanceof Error && e.name === "AbortError"
          ? "История не ответила за 15 секунд."
          : e instanceof Error ? e.message : "Ошибка загрузки данных.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [telegramUserId, retryKey]);

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
          onClick={() => setActiveTab("ORDERS")}
          className={`rounded-xl py-2 text-xs font-black transition-all ${
            activeTab === "ORDERS" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
          }`}
        >
          Заказы ({data.orders.length})
        </button>
        <button
          onClick={() => setActiveTab("BOOKINGS")}
          className={`rounded-xl py-2 text-xs font-black transition-all ${
            activeTab === "BOOKINGS" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
          }`}
        >
          Записи ({data.bookings.length})
        </button>
      </div>

      {loading && (
        <div className="py-12 text-center">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-slate-900 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-400">Загрузка истории...</p>
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
        </div>
      )}
    </div>
  );
}
