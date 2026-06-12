"use client";

import type { ReactNode } from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BarChart3, CalendarDays, ReceiptText, ShoppingBag, TrendingDown, TrendingUp, Users } from "lucide-react";
import { miniAppFetch } from "@/lib/miniAppFetch";

type AnalyticsData = {
  business: { name: string };
  metrics: {
    revenue: number;
    orders: number;
    completedOrders: number;
    averageCheck: number;
    newCustomers: number;
    repeatCustomers: number;
    cancelledOrders: number;
    completionPercent: number;
    soldUnits: number;
    discountAmount: number;
  };
  growth: { revenue: number; orders: number; averageCheck: number; newCustomers: number };
  daily: Array<{ date: string; revenue: number; orders: number }>;
  statuses: Array<{ status: string; label: string; count: number; amount: number }>;
  topProducts: Array<{ itemId: string | null; name: string; quantity: number }>;
  topCustomers: Array<{ customerId: string | null; name: string; orders: number; revenue: number }>;
  promoUsage: Array<{ code: string; discountPercent: number; orders: number; discountAmount: number; revenue: number }>;
};

const periods = [
  { value: "today", label: "Сегодня" },
  { value: "7", label: "7 дней" },
  { value: "30", label: "30 дней" },
  { value: "90", label: "90 дней" },
  { value: "custom", label: "Период" },
];

function money(value: number) {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

function Growth({ value }: { value: number }) {
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black ${positive ? "text-emerald-600" : "text-rose-600"}`}>
      <Icon size={11} /> {positive ? "+" : ""}{value}%
    </span>
  );
}

function SellerAnalyticsContent() {
  const searchParams = useSearchParams();
  const businessId = searchParams.get("businessId") || "";
  const [period, setPeriod] = useState("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (period === "custom" && (!from || !to)) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const query = new URLSearchParams({ period });
    if (businessId) query.set("businessId", businessId);
    if (period === "custom") {
      query.set("from", from);
      query.set("to", to);
    }

    setLoading(true);
    setError("");
    miniAppFetch(`/api/admin/analytics?${query.toString()}`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Не удалось загрузить аналитику.");
        return body;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Не удалось загрузить аналитику.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [businessId, period, from, to]);

  const maxRevenue = useMemo(() => Math.max(1, ...(data?.daily.map((item) => item.revenue) || [1])), [data]);

  return (
    <main className="min-h-screen bg-slate-50 pb-10 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Link href="/app?mode=seller" className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-700">
            <ArrowLeft size={19} />
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Управление бизнесом</p>
            <h1 className="truncate text-lg font-black">Аналитика{data?.business?.name ? ` · ${data.business.name}` : ""}</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-5 p-4">
        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {periods.map((item) => (
              <button key={item.value} type="button" onClick={() => setPeriod(item.value)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black ${period === item.value ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>
                {item.label}
              </button>
            ))}
          </div>
          {period === "custom" && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="rounded-xl bg-slate-50 p-3 text-[10px] font-black text-slate-400">С
                <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block w-full bg-transparent text-xs text-slate-900 outline-none" />
              </label>
              <label className="rounded-xl bg-slate-50 p-3 text-[10px] font-black text-slate-400">По
                <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block w-full bg-transparent text-xs text-slate-900 outline-none" />
              </label>
            </div>
          )}
        </section>

        {loading && <div className="grid grid-cols-2 gap-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-3xl bg-white ring-1 ring-slate-100" />)}</div>}
        {error && <div className="rounded-3xl bg-rose-50 p-5 text-sm font-bold text-rose-700 ring-1 ring-rose-100">{error}</div>}

        {!loading && !error && data && (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "Выручка", value: money(data.metrics.revenue), growth: data.growth.revenue, icon: BarChart3 },
                { label: "Заказы", value: data.metrics.orders, growth: data.growth.orders, icon: ShoppingBag },
                { label: "Средний чек", value: money(data.metrics.averageCheck), growth: data.growth.averageCheck, icon: ReceiptText },
                { label: "Новые клиенты", value: data.metrics.newCustomers, growth: data.growth.newCustomers, icon: Users },
              ].map((metric) => {
                const Icon = metric.icon;
                return (
                  <article key={metric.label} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                    <div className="flex items-center justify-between"><Icon size={17} className="text-indigo-600" /><Growth value={metric.growth} /></div>
                    <p className="mt-4 text-[10px] font-black uppercase text-slate-400">{metric.label}</p>
                    <strong className="mt-1 block text-xl font-black">{metric.value}</strong>
                  </article>
                );
              })}
            </section>

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                ["Завершено", data.metrics.completedOrders],
                ["Повторные клиенты", data.metrics.repeatCustomers],
                ["Отменено", data.metrics.cancelledOrders],
                ["Конверсия", `${data.metrics.completionPercent}%`],
                ["Скидки", money(data.metrics.discountAmount)],
              ].map(([label, value]) => (
                <article key={String(label)} className="rounded-2xl bg-slate-900 p-4 text-white">
                  <p className="text-[9px] font-black uppercase text-slate-400">{label}</p>
                  <strong className="mt-1 block text-lg font-black">{value}</strong>
                </article>
              ))}
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <div className="mb-4 flex items-center gap-2"><CalendarDays size={17} /><h2 className="text-sm font-black">Динамика выручки</h2></div>
              {data.daily.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 p-6 text-center text-xs font-bold text-slate-400">За выбранный период завершённых заказов нет.</p>
              ) : (
                <div className="flex h-48 items-end gap-2 overflow-x-auto">
                  {data.daily.map((item) => (
                    <div key={item.date} className="flex min-w-12 flex-1 flex-col items-center justify-end gap-2">
                      <span className="text-[9px] font-black text-slate-500">{money(item.revenue)}</span>
                      <div className="w-full rounded-t-xl bg-indigo-500" style={{ height: `${Math.max(6, (item.revenue / maxRevenue) * 130)}px` }} />
                      <span className="text-[9px] font-bold text-slate-400">{new Date(item.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <ListCard title="Заказы по статусам" empty="Заказов за период нет.">
                {data.statuses.map((item) => <Row key={item.status} label={item.label} value={`${item.count} · ${money(item.amount)}`} />)}
              </ListCard>
              <ListCard title="Топ товаров" empty="Продаж товаров за период нет.">
                {data.topProducts.map((item) => <Row key={`${item.itemId}-${item.name}`} label={item.name} value={`${item.quantity} шт.`} />)}
              </ListCard>
              <ListCard title="Топ клиентов" empty="Завершённых заказов клиентов пока нет.">
                {data.topCustomers.map((item) => <Row key={`${item.customerId}-${item.name}`} label={item.name} value={`${item.orders} заказов · ${money(item.revenue)}`} />)}
              </ListCard>
              <ListCard title="Промокоды" empty="Промокоды за период не использовались.">
                {data.promoUsage.map((item) => <Row key={item.code} label={`${item.code} · ${item.discountPercent}%`} value={`${item.orders} заказов · скидка ${money(item.discountAmount)}`} />)}
              </ListCard>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default function SellerAnalyticsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 p-6 text-sm font-bold text-slate-500">Загрузка аналитики...</div>}>
      <SellerAnalyticsContent />
    </Suspense>
  );
}

function ListCard({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <h2 className="mb-3 text-sm font-black">{title}</h2>
      {hasChildren ? <div className="divide-y divide-slate-100">{children}</div> : <p className="rounded-2xl bg-slate-50 p-5 text-center text-xs font-bold text-slate-400">{empty}</p>}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 py-3 text-xs"><span className="min-w-0 truncate font-bold text-slate-700">{label}</span><span className="shrink-0 font-black text-slate-950">{value}</span></div>;
}
