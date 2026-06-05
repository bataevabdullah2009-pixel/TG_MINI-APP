"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, MapPin, PackageCheck, Phone, RefreshCw, Store, Truck, User } from "lucide-react";
import { miniAppFetch } from "@/lib/miniAppFetch";

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value || 0);
}

function OrderCard({ order, action, loading }: { order: any; action: (id: string, action: string) => void; loading: string }) {
  const assignedStatus = ["ASSIGNED", "ACCEPTED_BY_COURIER", "PICKED_UP"].includes(order.deliveryAssignment?.status)
    ? order.deliveryAssignment.status
    : null;
  const pending = loading === order.id;
  const terminal = ["DELIVERED", "CANCELLED", "EXPIRED"].includes(order.deliveryStatus);
  return (
    <article className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">{order.business.name}</span>
          <h2 className="mt-1 text-sm font-black text-slate-950">Заказ #{order.id.slice(-6).toUpperCase()}</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-600">{order.deliveryStatus}</span>
      </div>

      <div className="mt-4 grid gap-2 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-700">
        <div className="flex gap-2"><Store size={15} className="shrink-0 text-slate-400" /><span><b>Забрать:</b> {order.business.address || "Адрес магазина не указан"}</span></div>
        <div className="flex gap-2"><MapPin size={15} className="shrink-0 text-slate-400" /><span><b>Доставить:</b> {order.deliveryCityArea ? `${order.deliveryCityArea}, ` : ""}{order.customerAddress}</span></div>
        <div className="flex gap-2"><User size={15} className="shrink-0 text-slate-400" /><span>{order.customerName}</span></div>
        <a href={`tel:${order.customerPhone}`} className="flex gap-2 text-indigo-700"><Phone size={15} className="shrink-0" /><span>{order.customerPhone}</span></a>
        {order.comment && <div className="rounded-xl bg-white p-2 text-slate-500">Комментарий: {order.comment}</div>}
      </div>

      <div className="mt-3 space-y-1 text-xs font-bold text-slate-600">
        {order.items?.map((item: any) => (
          <div key={item.id} className="flex justify-between gap-3"><span>{item.name} x {item.quantity}</span><span>{money(item.price * item.quantity)}</span></div>
        ))}
        <div className="mt-2 border-t pt-2">
          <div className="flex justify-between"><span>Товары</span><span>{money(order.itemsSubtotal || order.totalPrice - (order.deliveryFee || 0))}</span></div>
          <div className="flex justify-between"><span>Доставка</span><span>{money(order.deliveryFee)}</span></div>
          <div className="mt-1 flex justify-between text-sm font-black text-slate-950"><span>Итого</span><span>{money(order.totalPrice)}</span></div>
          <div className="mt-1 text-[10px] uppercase text-slate-400">Оплата: {order.paymentMethod}</div>
        </div>
      </div>

      {!terminal && <div className="mt-4">
        {!assignedStatus && (
          <button disabled={pending} onClick={() => action(order.id, "TAKE")} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black text-white disabled:opacity-50">
            <Truck size={16} /> Взять заказ
          </button>
        )}
        {assignedStatus === "ASSIGNED" && (
          <button disabled={pending} onClick={() => action(order.id, "ACCEPT")} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">
            <CheckCircle2 size={16} /> Принять доставку
          </button>
        )}
        {assignedStatus === "ACCEPTED_BY_COURIER" && (
          <button disabled={pending} onClick={() => action(order.id, "PICKED_UP")} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">
            <PackageCheck size={16} /> Забрал у продавца
          </button>
        )}
        {assignedStatus === "PICKED_UP" && (
          <button disabled={pending} onClick={() => action(order.id, "DELIVERED")} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">
            <CheckCircle2 size={16} /> Доставил клиенту
          </button>
        )}
      </div>}
    </article>
  );
}

export function CourierDashboard() {
  const [data, setData] = useState<any>({ available: [], assigned: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await miniAppFetch("/api/courier/orders");
      const result = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) {
        setDenied(true);
        return;
      }
      if (!response.ok) throw new Error(result.error || "Не удалось загрузить доставки.");
      setDenied(false);
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить доставки.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const telegram = (window as any).Telegram?.WebApp;
    telegram?.ready?.();
    telegram?.expand?.();
    load();
  }, [load]);

  const runAction = async (orderId: string, action: string) => {
    setActionLoading(orderId);
    setError("");
    try {
      const response = await miniAppFetch(`/api/courier/orders/${orderId}`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Не удалось обновить доставку.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Не удалось обновить доставку.");
    } finally {
      setActionLoading("");
    }
  };

  if (denied) {
    return <main className="grid min-h-[100dvh] place-items-center bg-slate-50 p-6 text-center"><div><Truck className="mx-auto text-slate-300" size={44} /><h1 className="mt-4 text-lg font-black">У вас нет доступа к кабинету курьера.</h1></div></main>;
  }

  return (
    <main className="mx-auto min-h-[100dvh] max-w-[480px] bg-slate-50 px-4 pb-10 text-slate-950">
      <header className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between bg-slate-950 px-4 py-4 text-white">
        <div><p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Кабинет курьера</p><h1 className="text-lg font-black">{data.courier?.name || "Доставки"}</h1></div>
        <button onClick={load} className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><RefreshCw size={17} /></button>
      </header>

      {error && <div className="mb-4 rounded-2xl bg-rose-50 p-3 text-xs font-bold text-rose-700 ring-1 ring-rose-100">{error}</div>}
      {loading ? <div className="grid place-items-center py-20 text-xs font-black text-slate-400"><Clock className="mb-2 animate-pulse" />Загрузка доставок...</div> : (
        <div className="space-y-5">
          <section><h2 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Мои доставки ({data.assigned?.length || 0})</h2><div className="grid gap-3">{data.assigned?.length ? data.assigned.map((order: any) => <OrderCard key={order.id} order={order} action={runAction} loading={actionLoading} />) : <div className="rounded-3xl bg-white p-6 text-center text-xs font-bold text-slate-400 ring-1 ring-slate-100">Нет активных доставок.</div>}</div></section>
          <section><h2 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Доступные ({data.available?.length || 0})</h2><div className="grid gap-3">{data.available?.length ? data.available.map((order: any) => <OrderCard key={order.id} order={order} action={runAction} loading={actionLoading} />) : <div className="rounded-3xl bg-white p-6 text-center text-xs font-bold text-slate-400 ring-1 ring-slate-100">Доступных доставок пока нет.</div>}</div></section>
          <section><h2 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Завершённые ({data.completed?.length || 0})</h2><div className="grid gap-3">{data.completed?.length ? data.completed.map((order: any) => <OrderCard key={order.id} order={order} action={runAction} loading={actionLoading} />) : <div className="rounded-3xl bg-white p-6 text-center text-xs font-bold text-slate-400 ring-1 ring-slate-100">Завершённых доставок пока нет.</div>}</div></section>
        </div>
      )}
    </main>
  );
}
