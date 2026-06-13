"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  PackageOpen,
  RefreshCw,
  Route,
  Truck,
} from "lucide-react";
import { miniAppFetch } from "@/lib/miniAppFetch";
import { CourierOrderCard } from "./CourierOrderCard";
import type {
  CourierAction,
  CourierDashboardData,
  CourierOrder,
} from "./courier-types";

type CourierTab = "ASSIGNED" | "AVAILABLE" | "COMPLETED";

const EMPTY_DATA: CourierDashboardData = {
  courier: null,
  available: [],
  assigned: [],
  completed: [],
};

const tabs: Array<{ value: CourierTab; label: string }> = [
  { value: "ASSIGNED", label: "Мои доставки" },
  { value: "AVAILABLE", label: "Доступные" },
  { value: "COMPLETED", label: "Завершённые" },
];

function completedToday(order: CourierOrder) {
  const value = order.deliveryAssignment?.deliveredAt || order.updatedAt;
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function CourierDashboard() {
  const [data, setData] = useState<CourierDashboardData>(EMPTY_DATA);
  const [activeTab, setActiveTab] = useState<CourierTab>("ASSIGNED");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
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
      setData({
        courier: result.courier || null,
        available: Array.isArray(result.available) ? result.available.filter(Boolean) : [],
        assigned: Array.isArray(result.assigned) ? result.assigned.filter(Boolean) : [],
        completed: Array.isArray(result.completed) ? result.completed.filter(Boolean) : [],
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить доставки."
      );
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

  const completedCountToday = useMemo(
    () => data.completed.filter(completedToday).length,
    [data.completed]
  );

  const visibleOrders = useMemo(() => {
    if (activeTab === "AVAILABLE") return data.available;
    if (activeTab === "COMPLETED") return data.completed;
    return data.assigned;
  }, [activeTab, data.assigned, data.available, data.completed]);

  const updateOrderCollections = (order: CourierOrder, action: CourierAction) => {
    setData((current) => {
      const withoutOrder = (orders: CourierOrder[]) =>
        orders.filter((entry) => entry.id !== order.id);

      if (action === "DELIVERED") {
        return {
          ...current,
          assigned: withoutOrder(current.assigned),
          available: withoutOrder(current.available),
          completed: [order, ...withoutOrder(current.completed)],
        };
      }

      return {
        ...current,
        available: withoutOrder(current.available),
        completed: withoutOrder(current.completed),
        assigned: [
          order,
          ...withoutOrder(current.assigned),
        ],
      };
    });
  };

  const runAction = async (orderId: string, action: CourierAction) => {
    if (actionLoading) return;
    setActionLoading(orderId);
    setError("");
    try {
      const response = await miniAppFetch(`/api/courier/orders/${orderId}`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.order) {
        throw new Error(result.error || "Не удалось обновить доставку.");
      }
      updateOrderCollections(result.order, action);
      const message =
        action === "DELIVERED"
          ? "Доставка завершена"
          : action === "DELIVERING"
            ? "Курьер в пути"
          : action === "PICKED_UP"
            ? "Заказ отмечен как забранный"
            : "Доставка принята";
      setToast(message);
      window.setTimeout(() => setToast(""), 2500);
      if (action === "DELIVERED") setActiveTab("COMPLETED");
      else setActiveTab("ASSIGNED");
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Не удалось обновить доставку."
      );
    } finally {
      setActionLoading("");
    }
  };

  if (denied) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-slate-50 p-6 text-center">
        <div>
          <Truck className="mx-auto text-slate-300" size={44} />
          <h1 className="mt-4 text-lg font-black">
            У вас нет доступа к кабинету курьера.
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[100dvh] max-w-[520px] bg-slate-50 pb-12 text-slate-950">
      <header className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 pb-5 pt-5 text-white shadow-xl shadow-slate-950/15">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">
              Кабинет курьера
            </p>
            <h1 className="mt-1 truncate text-xl font-black">
              {data.courier?.name || "Курьер"}
            </h1>
            {data.courier?.cityArea && (
              <p className="mt-1 text-xs font-bold text-white/55">
                Зона: {data.courier.cityArea}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="Обновить доставки"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15 disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <section className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
            <Route size={16} className="text-indigo-300" />
            <strong className="mt-2 block text-xl font-black">{data.assigned.length}</strong>
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/50">Активные</span>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
            <PackageOpen size={16} className="text-amber-300" />
            <strong className="mt-2 block text-xl font-black">{data.available.length}</strong>
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/50">Доступные</span>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
            <CheckCircle2 size={16} className="text-emerald-300" />
            <strong className="mt-2 block text-xl font-black">{completedCountToday}</strong>
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/50">Сегодня</span>
          </div>
        </section>
      </header>

      <div className="px-4">
        <nav className="-mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200/70">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`min-h-11 rounded-xl px-2 text-[10px] font-black leading-tight transition ${
                activeTab === tab.value
                  ? "bg-slate-950 text-white"
                  : "text-slate-500"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {toast && (
          <div className="fixed left-4 right-4 top-4 z-50 mx-auto max-w-md rounded-2xl bg-emerald-600 px-4 py-3 text-center text-xs font-black text-white shadow-xl">
            {toast}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-2xl bg-rose-50 p-3 text-xs font-bold text-rose-700 ring-1 ring-rose-100">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid place-items-center py-24 text-center text-xs font-black text-slate-400">
            <Clock3 className="mb-3 animate-pulse" />
            Загрузка доставок...
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="mt-5 rounded-[28px] bg-white p-8 text-center ring-1 ring-slate-100">
            <Truck className="mx-auto text-slate-300" size={38} />
            <h2 className="mt-3 text-sm font-black text-slate-800">
              Доставок в этом разделе нет
            </h2>
            <p className="mt-1 text-xs font-bold text-slate-400">
              Обновите список немного позже.
            </p>
          </div>
        ) : (
          <section className="mt-5 grid gap-4">
            {visibleOrders.filter(Boolean).map((order) => (
              <CourierOrderCard
                key={order.id}
                order={order}
                courierAvailable={Boolean(data.courier)}
                loading={actionLoading === order.id}
                onAction={runAction}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
