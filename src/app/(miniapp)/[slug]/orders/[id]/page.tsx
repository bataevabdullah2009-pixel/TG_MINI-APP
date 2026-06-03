"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Business } from "@/types";
import { apiClient } from "@/lib/api-client";
import { formatPrice, formatDateTime, getOrderStatusLabel } from "@/lib/utils";
import Link from "next/link";

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  businessId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  totalPrice: number;
  status: string;
  deliveryType: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

const STATUS_STEPS = [
  { key: "NEW", label: "🆕 Принят", desc: "Заказ получен" },
  { key: "ACCEPTED", label: "✅ Подтверждён", desc: "Бизнес принял заказ" },
  { key: "PREPARING", label: "👨‍🍳 Готовится", desc: "Идёт подготовка" },
  { key: "READY", label: "📦 Готов", desc: "Можно забирать/ждите" },
  { key: "DELIVERING", label: "🚚 В пути", desc: "Курьер в дороге" },
  { key: "COMPLETED", label: "✔️ Завершён", desc: "Выполнен!" },
  { key: "EXPIRED", label: "⏱️ Истёк", desc: "Срок истёк" },
];

const STATUS_ORDER = ["NEW", "ACCEPTED", "PREPARING", "READY", "DELIVERING", "COMPLETED", "EXPIRED"];

export default function OrderStatusPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [orderRes, businessRes] = await Promise.all([
          apiClient.get(`/orders/${orderId}`),
          apiClient.get(`/businesses/${slug}`),
        ]);
        setOrder(orderRes.data);
        setBusiness(businessRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    // Poll for status updates every 15s
    const interval = setInterval(async () => {
      try {
        const res = await apiClient.get(`/orders/${orderId}`);
        setOrder(res.data);
      } catch {}
    }, 15000);

    return () => clearInterval(interval);
  }, [orderId, slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
          <p className="mt-4 text-muted-foreground">Загрузка заказа...</p>
        </div>
      </div>
    );
  }

  if (!order || !business) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-xl font-bold mb-2">Заказ не найден</h2>
          <Link href={`/${slug}`}>
            <Button variant="outline">На главную</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isCancelled = order.status === "CANCELLED" || order.status === "EXPIRED";
  const currentStepIdx = STATUS_ORDER.indexOf(order.status);

  const shortId = order.id.slice(-6).toUpperCase();

  return (
    <div className="pb-24">
      {/* Header */}
      <div
        className="relative p-6 text-white"
        style={{
          background: isCancelled
            ? "linear-gradient(135deg, #ef4444, #dc2626)"
            : `linear-gradient(135deg, ${business.primaryColor}, ${business.accentColor})`,
        }}
      >
        <button
          onClick={() => router.push(`/${slug}`)}
          className="text-white/80 hover:text-white mb-4 flex items-center gap-1 text-sm"
        >
          ← На главную
        </button>
        <h1 className="text-2xl font-bold mb-1">Заказ #{shortId}</h1>
        <p className="text-white/80 text-sm">
          от {formatDateTime(order.createdAt)}
        </p>
        {!isCancelled && (
          <div className="mt-3 inline-flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-2 rounded-full">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-sm font-medium">
              {getOrderStatusLabel(order.status)}
            </span>
          </div>
        )}
        {isCancelled && (
          <div className="mt-3 inline-flex items-center gap-2 bg-red-800/40 px-4 py-2 rounded-full">
            <span className="text-sm font-medium">{order.status === "EXPIRED" ? "⏱️ Заказ истёк" : "❌ Заказ отменён"}</span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Status Timeline */}
        {!isCancelled && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="font-bold mb-4">📍 Статус заказа</h2>
            <div className="space-y-3">
              {STATUS_STEPS.filter((s) => order.deliveryType === "PICKUP"
                ? s.key !== "DELIVERING"
                : true
              ).map((step, idx) => {
                const stepIdx = STATUS_ORDER.indexOf(step.key);
                const isDone = stepIdx <= currentStepIdx;
                const isCurrent = step.key === order.status;

                return (
                  <div key={step.key} className="flex items-start gap-3">
                    <div className="relative flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all ${
                          isCurrent
                            ? "ring-4 ring-offset-2 text-white"
                            : isDone
                            ? "text-white"
                            : "bg-gray-100 text-gray-400"
                        }`}
                        style={
                          isDone || isCurrent
                            ? { backgroundColor: business.primaryColor }
                            : {}
                        }
                      >
                        {isDone ? "✓" : idx + 1}
                      </div>
                    </div>
                    <div className={`pb-3 flex-1 ${isCurrent ? "font-semibold" : ""}`}>
                      <p className={`text-sm ${isDone ? "" : "text-muted-foreground"}`}>
                        {step.label}
                      </p>
                      {isCurrent && (
                        <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order Items */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold mb-3">📋 Состав заказа</h2>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between items-center text-sm">
                <span className="flex-1">
                  {item.name} × {item.quantity}
                </span>
                <span className="font-semibold ml-2">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-bold text-base">
              <span>Итого</span>
              <span style={{ color: business.primaryColor }}>
                {formatPrice(order.totalPrice)}
              </span>
            </div>
          </div>
        </div>

        {/* Delivery Info */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold mb-3">📦 Информация</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Способ</span>
              <span className="font-medium">
                {order.deliveryType === "DELIVERY" ? "🚚 Доставка" : "🏪 Самовывоз"}
              </span>
            </div>
            {order.customerAddress && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Адрес</span>
                <span className="font-medium text-right max-w-[60%]">
                  {order.customerAddress}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Клиент</span>
              <span className="font-medium">{order.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Телефон</span>
              <a
                href={`tel:${order.customerPhone}`}
                className="font-medium"
                style={{ color: business.primaryColor }}
              >
                {order.customerPhone}
              </a>
            </div>
            {order.comment && (
              <div>
                <span className="text-muted-foreground block mb-1">Комментарий</span>
                <p className="bg-gray-50 rounded-lg px-3 py-2">{order.comment}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 max-w-md mx-auto flex gap-3">
        {business.phone && (
          <a href={`tel:${business.phone}`} className="flex-1">
            <Button variant="outline" className="w-full">
              📞 Позвонить
            </Button>
          </a>
        )}
        <Link href={`/${slug}/catalog`} className="flex-1">
          <Button
            className="w-full text-white"
            style={{ backgroundColor: business.primaryColor }}
          >
            🛍️ Ещё заказать
          </Button>
        </Link>
      </div>
    </div>
  );
}
