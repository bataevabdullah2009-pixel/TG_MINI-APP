"use client";

import React, { useState, useEffect } from "react";
import { ClipboardList, Calendar, Search, CheckCircle, RefreshCw, PhoneCall, AlertCircle } from "lucide-react";

interface ManagerWorkPanelProps {
  session: any;
  businessId: string;
}

export function ManagerWorkPanel({ session, businessId }: ManagerWorkPanelProps) {
  const [activeQueue, setActiveQueue] = useState<"ORDERS" | "BOOKINGS">("ORDERS");
  const [orders, setOrders] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveQueues();
  }, [businessId]);

  const fetchActiveQueues = async () => {
    setLoading(true);
    try {
      const ordRes = await fetch(`/api/orders?businessId=${businessId}`);
      const bookRes = await fetch(`/api/bookings?businessId=${businessId}`);
      if (ordRes.ok) setOrders(await ordRes.json());
      if (bookRes.ok) setBookings(await bookRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    setActionLoading(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setSuccess("Статус заказа обновлен!");
        setTimeout(() => setSuccess(null), 3000);
        fetchActiveQueues();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateBookingStatus = async (bookingId: string, newStatus: string) => {
    setActionLoading(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setSuccess("Запись обновлена!");
        setTimeout(() => setSuccess(null), 3000);
        fetchActiveQueues();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  // Filter lists based on search phone or name
  const filteredOrders = orders.filter((o) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      o.customerName.toLowerCase().includes(q) ||
      o.customerPhone.includes(q) ||
      o.id.toLowerCase().includes(q)
    );
  });

  const filteredBookings = bookings.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      b.customerName.toLowerCase().includes(q) ||
      b.customerPhone.includes(q) ||
      b.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="pb-24 text-slate-900 min-h-screen bg-slate-50">
      
      {/* Title block */}
      <section className="bg-indigo-900 text-white px-5 pb-6 pt-5">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-indigo-300">Рабочая Панель Менеджера</p>
            <h1 className="text-xl font-black">Обработка заявок</h1>
          </div>
          <button
            onClick={fetchActiveQueues}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white active:scale-90 transition"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Search */}
        <label className="flex items-center gap-2.5 rounded-xl bg-white/10 px-3.5 py-2.5 ring-1 ring-white/15 mt-4">
          <Search size={15} className="text-indigo-300" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Имя, телефон клиента или номер..."
            className="w-full bg-transparent text-xs font-semibold text-white outline-none placeholder:text-indigo-300/70"
          />
        </label>
      </section>

      {/* Floating Success notifications */}
      {success && (
        <div className="fixed top-4 inset-x-4 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 p-3 text-xs font-bold text-white shadow-xl animate-fade-in">
          <CheckCircle size={15} />
          <span>{success}</span>
        </div>
      )}

      {/* Selector and queues */}
      <div className="p-4 max-w-md mx-auto">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 mb-4">
          <button
            onClick={() => setActiveQueue("ORDERS")}
            className={`rounded-xl py-2 text-xs font-black transition-all ${
              activeQueue === "ORDERS" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
            }`}
          >
            Активные заказы ({filteredOrders.length})
          </button>
          <button
            onClick={() => setActiveQueue("BOOKINGS")}
            className={`rounded-xl py-2 text-xs font-black transition-all ${
              activeQueue === "BOOKINGS" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
            }`}
          >
            Записи ({filteredBookings.length})
          </button>
        </div>

        {loading && (
          <div className="py-12 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900 mx-auto" />
          </div>
        )}

        {!loading && (
          <div className="space-y-3.5">
            
            {/* Orders queue */}
            {activeQueue === "ORDERS" && (
              filteredOrders.length === 0 ? (
                <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-slate-100/80">
                  <ClipboardList className="mx-auto mb-2 text-slate-300" size={32} />
                  <p className="text-xs text-slate-400 font-bold">Очередь заказов пуста</p>
                </div>
              ) : (
                filteredOrders.map((o) => (
                  <div key={o.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">Заказ #{o.id.slice(-6).toUpperCase()}</h4>
                        <span className="text-[9px] font-bold text-slate-400 block mt-0.5">{o.customerName}</span>
                      </div>
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-black bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                        {o.status}
                      </span>
                    </div>

                    <div className="text-xs font-medium text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {o.items.map((it: any) => (
                        <div key={it.id} className="flex justify-between">
                          <span>{it.name} × {it.quantity}</span>
                          <span className="font-bold">{it.price * it.quantity} ₽</span>
                        </div>
                      ))}
                      <div className="mt-2 border-t border-dashed pt-1.5 flex justify-between font-black text-slate-800">
                        <span>Итого:</span>
                        <span>{o.totalPrice} ₽</span>
                      </div>
                    </div>

                    {/* Manager Status controls */}
                    <div className="flex gap-2 border-t border-slate-50 pt-3">
                      {o.status === "NEW" && (
                        <button
                          onClick={() => handleUpdateOrderStatus(o.id, "PROCESSING")}
                          disabled={actionLoading === o.id}
                          className="flex-1 rounded-xl bg-amber-600 text-white py-2 text-xs font-black hover:bg-slate-900 active:scale-95 transition"
                        >
                          В работу
                        </button>
                      )}
                      {(o.status === "NEW" || o.status === "PROCESSING") && (
                        <button
                          onClick={() => handleUpdateOrderStatus(o.id, "READY")}
                          disabled={actionLoading === o.id}
                          className="flex-1 rounded-xl bg-emerald-600 text-white py-2 text-xs font-black hover:bg-slate-900 active:scale-95 transition"
                        >
                          Готов к выдаче
                        </button>
                      )}
                      {o.status === "READY" && (
                        <button
                          onClick={() => handleUpdateOrderStatus(o.id, "COMPLETED")}
                          disabled={actionLoading === o.id}
                          className="flex-1 rounded-xl bg-slate-900 text-white py-2 text-xs font-black hover:bg-slate-850 active:scale-95 transition"
                        >
                          Выдать / Закрыть
                        </button>
                      )}
                      <button
                        onClick={() => handleUpdateOrderStatus(o.id, "CANCELLED")}
                        disabled={actionLoading === o.id}
                        className="rounded-xl border border-rose-200 text-rose-600 px-3 py-2 text-xs font-black hover:bg-rose-50 transition"
                      >
                        Отменить
                      </button>
                    </div>
                  </div>
                ))
              )
            )}

            {/* Bookings Queue */}
            {activeQueue === "BOOKINGS" && (
              filteredBookings.length === 0 ? (
                <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-slate-100/80">
                  <Calendar className="mx-auto mb-2 text-slate-300" size={32} />
                  <p className="text-xs text-slate-400 font-bold">Очередь записей пуста</p>
                </div>
              ) : (
                filteredBookings.map((b) => {
                  const time = new Date(b.startTime).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div key={b.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900">{b.service?.name || "Услуга"}</h4>
                          <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                            Клиент: {b.customerName} · {b.customerPhone}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 mt-1 block">
                            🕒 Сегодня в {time} (Мастер: {b.staff?.name || "Любой"})
                          </span>
                        </div>
                        <span className="rounded-full px-2 py-0.5 text-[9px] font-black bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                          {b.status}
                        </span>
                      </div>

                      {/* Booking Manager Action Controls */}
                      <div className="flex gap-2 border-t border-slate-50 pt-3">
                        {b.status === "NEW" && (
                          <button
                            onClick={() => handleUpdateBookingStatus(b.id, "CONFIRMED")}
                            disabled={actionLoading === b.id}
                            className="flex-1 rounded-xl bg-emerald-600 text-white py-2 text-xs font-black hover:bg-slate-900 active:scale-95 transition"
                          >
                            Подтвердить запись
                          </button>
                        )}
                        {b.status === "CONFIRMED" && (
                          <button
                            onClick={() => handleUpdateBookingStatus(b.id, "COMPLETED")}
                            disabled={actionLoading === b.id}
                            className="flex-1 rounded-xl bg-slate-900 text-white py-2 text-xs font-black hover:bg-slate-850 active:scale-95 transition"
                          >
                            Завершить сеанс
                          </button>
                        )}
                        <button
                          onClick={() => handleUpdateBookingStatus(b.id, "CANCELLED")}
                          disabled={actionLoading === b.id}
                          className="rounded-xl border border-rose-200 text-rose-600 px-3 py-2 text-xs font-black hover:bg-rose-50 transition"
                        >
                          Отклонить
                        </button>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
