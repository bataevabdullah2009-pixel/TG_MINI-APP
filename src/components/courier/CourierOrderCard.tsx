"use client";

import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  Store,
  Truck,
  User,
} from "lucide-react";
import {
  formatDeliveryStatusRu,
  formatPaymentMethodRu,
  formatPaymentStatusRu,
} from "@/lib/utils";
import type { CourierAction, CourierOrder } from "./courier-types";

type CourierOrderCardProps = {
  order: CourierOrder;
  courierAvailable: boolean;
  loading: boolean;
  onAction: (orderId: string, action: CourierAction) => void;
};

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function openExternal(url: string) {
  const telegram = (window as any).Telegram?.WebApp;
  if (telegram?.openLink) {
    telegram.openLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function CourierOrderCard({
  order,
  courierAvailable,
  loading,
  onAction,
}: CourierOrderCardProps) {
  if (!order?.business) return null;

  const assignmentStatus = order.deliveryAssignment?.status || null;
  const address = [order.deliveryCityArea, order.customerAddress].filter(Boolean).join(", ");
  const itemsSubtotal =
    order.itemsSubtotal ?? Math.max(0, order.totalPrice - (order.deliveryFee || 0));
  const terminal = ["DELIVERED", "CANCELLED", "EXPIRED"].includes(order.deliveryStatus);
  const available = !assignmentStatus && !terminal;
  const mapUrl = address
    ? `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`
    : "";

  const reportProblem = () => {
    const sellerPhone = order.business.phone;
    if (sellerPhone) {
      window.location.href = `tel:${sellerPhone}`;
      return;
    }
    const telegram = (window as any).Telegram?.WebApp;
    telegram?.showPopup?.({
      title: "Проблема с доставкой",
      message: "Свяжитесь с продавцом через Telegram-бота или диспетчера.",
      buttons: [{ type: "ok" }],
    });
  };

  return (
    <article className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200/70">
      <header className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 py-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-indigo-300">
              {order.business.name}
            </p>
            <h2 className="mt-1 text-base font-black">
              Заказ #{order.id.slice(-6).toUpperCase()}
            </h2>
          </div>
          <span className="max-w-[145px] shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-right text-[9px] font-black leading-tight text-white ring-1 ring-white/15">
            {order.status === "DELIVERING"
              ? "В пути"
              : formatDeliveryStatusRu(order.deliveryStatus)}
          </span>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <section className="grid gap-2.5 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-700">
          <div className="flex gap-2.5">
            <Store size={16} className="mt-0.5 shrink-0 text-indigo-500" />
            <span className="min-w-0">
              <b className="block text-[10px] uppercase tracking-wider text-slate-400">Адрес забора</b>
              {order.business.address || "Адрес продавца не указан"}
            </span>
          </div>
          <div className="flex gap-2.5">
            <MapPin size={16} className="mt-0.5 shrink-0 text-rose-500" />
            <span className="min-w-0">
              <b className="block text-[10px] uppercase tracking-wider text-slate-400">Адрес доставки</b>
              {address || "Адрес доставки не указан"}
            </span>
          </div>
          <div className="flex gap-2.5">
            <User size={16} className="mt-0.5 shrink-0 text-slate-400" />
            <span className="min-w-0">
              <b className="block text-[10px] uppercase tracking-wider text-slate-400">Клиент</b>
              {order.customerName || "Имя не указано"}
            </span>
          </div>
          {order.customerPhone && (
            <a
              href={`tel:${order.customerPhone}`}
              className="flex gap-2.5 text-indigo-700 underline-offset-2 hover:underline"
            >
              <Phone size={16} className="shrink-0" />
              <span>{order.customerPhone}</span>
            </a>
          )}
          {order.comment && (
            <div className="rounded-xl bg-white p-2.5 text-[11px] leading-relaxed text-slate-500 ring-1 ring-slate-100">
              Комментарий: {order.comment}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Состав заказа
          </h3>
          <div className="space-y-2 text-xs font-bold text-slate-600">
            {(order.items || []).filter(Boolean).map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">
                  {item.name || "Товар"} × {item.quantity}
                </span>
                <span className="shrink-0 whitespace-nowrap text-slate-900">
                  {money(item.price * item.quantity)}
                </span>
              </div>
            ))}
            {(order.items || []).length === 0 && (
              <p className="text-slate-400">Состав заказа не указан.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 p-3 text-xs font-bold text-slate-600">
          <div className="flex justify-between gap-3">
            <span>Товары</span>
            <span className="shrink-0 whitespace-nowrap">{money(itemsSubtotal)}</span>
          </div>
          <div className="mt-1.5 flex justify-between gap-3">
            <span>Доставка</span>
            <span className="shrink-0 whitespace-nowrap">{money(order.deliveryFee)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-3 border-t border-dashed pt-2 text-sm font-black text-slate-950">
            <span>Итого</span>
            <span className="shrink-0 whitespace-nowrap">{money(order.totalPrice)}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded-xl bg-slate-50 p-2">
              <span className="block text-slate-400">Метод оплаты</span>
              <strong className="mt-0.5 block text-slate-800">
                {formatPaymentMethodRu(order.paymentMethod)}
              </strong>
            </div>
            <div className="rounded-xl bg-slate-50 p-2">
              <span className="block text-slate-400">Статус оплаты</span>
              <strong className="mt-0.5 block text-slate-800">
                {formatPaymentStatusRu(order.paymentStatus)}
              </strong>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2">
          {order.customerPhone && (
            <a
              href={`tel:${order.customerPhone}`}
              className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-100 px-3 text-xs font-black text-slate-800"
            >
              <Phone size={15} />
              Позвонить клиенту
            </a>
          )}
          {mapUrl && (
            <button
              type="button"
              onClick={() => openExternal(mapUrl)}
              className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-100 px-3 text-xs font-black text-slate-800"
            >
              <Navigation size={15} />
              Открыть в картах
            </button>
          )}
        </div>

        {!terminal && courierAvailable && (
          <div className="grid gap-2">
            {available && (
              <button
                type="button"
                disabled={loading}
                onClick={() => onAction(order.id, "TAKE")}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-black text-white disabled:opacity-50"
              >
                <Truck size={17} />
                Принять доставку
              </button>
            )}
            {assignmentStatus === "ASSIGNED" && (
              <button
                type="button"
                disabled={loading}
                onClick={() => onAction(order.id, "ACCEPT")}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-xs font-black text-white disabled:opacity-50"
              >
                <CheckCircle2 size={17} />
                Принять доставку
              </button>
            )}
            {assignmentStatus === "ACCEPTED_BY_COURIER" && (
              <button
                type="button"
                disabled={loading}
                onClick={() => onAction(order.id, "PICKED_UP")}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 text-xs font-black text-white disabled:opacity-50"
              >
                <PackageCheck size={17} />
                Забрал у продавца
              </button>
            )}
            {assignmentStatus === "PICKED_UP" && order.status !== "DELIVERING" && (
              <button
                type="button"
                disabled={loading}
                onClick={() => onAction(order.id, "DELIVERING")}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-xs font-black text-white disabled:opacity-50"
              >
                <Navigation size={17} />
                В пути
              </button>
            )}
            {assignmentStatus === "PICKED_UP" && order.status === "DELIVERING" && (
              <button
                type="button"
                disabled={loading}
                onClick={() => onAction(order.id, "DELIVERED")}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-xs font-black text-white disabled:opacity-50"
              >
                <CheckCircle2 size={17} />
                Доставил клиенту
              </button>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={reportProblem}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-xs font-black text-amber-800 disabled:opacity-50"
            >
              <AlertTriangle size={16} />
              Проблема
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
