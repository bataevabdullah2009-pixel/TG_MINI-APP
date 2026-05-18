"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Business } from "@/types";
import { apiClient } from "@/lib/api-client";
import { formatPrice, formatDate, formatTime, getOrderStatusLabel, getBookingStatusLabel } from "@/lib/utils";
import { BottomNavigation } from "@/components/mini-app/BottomNavigation";
import { useTelegram } from "@/hooks/useTelegram";
import Link from "next/link";

interface Order {
  id: string;
  totalPrice: number;
  status: string;
  deliveryType: string;
  createdAt: string;
  items: Array<{ name: string; quantity: number; price: number }>;
}

interface Booking {
  id: string;
  service?: { name: string; price: number };
  staff?: { name: string };
  startTime: string;
  status: string;
  customerName: string;
}

export default function ProfilePage() {
  const params = useParams();
  const slug = params.slug as string;
  const tg = useTelegram();

  const [business, setBusiness] = useState<Business | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"orders" | "bookings">("orders");

  const telegramUser = tg?.initDataUnsafe?.user;
  const userName = telegramUser
    ? [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ")
    : "Гость";

  useEffect(() => {
    async function fetchData() {
      try {
        const businessRes = await apiClient.get(`/businesses/${slug}`);
        setBusiness(businessRes.data);

        // Try to get orders & bookings if we know the business
        const biz = businessRes.data;
        if (biz?.id) {
          const [ordersRes, bookingsRes] = await Promise.all([
            apiClient.get(`/orders?businessId=${biz.id}&limit=10`).catch(() => ({ data: [] })),
            apiClient.get(`/bookings?businessId=${biz.id}&limit=10`).catch(() => ({ data: [] })),
          ]);
          setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : ordersRes.data?.data || []);
          setBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : bookingsRes.data?.data || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!business) return null;

  const primaryColor = business.primaryColor;
  const totalSpent = orders.reduce((sum, o) => sum + o.totalPrice, 0);

  const STATUS_COLORS: Record<string, string> = {
    NEW: "#3B82F6",
    ACCEPTED: "#10B981",
    PREPARING: "#F59E0B",
    READY: "#8B5CF6",
    DELIVERING: "#F59E0B",
    COMPLETED: "#10B981",
    CANCELLED: "#EF4444",
    CONFIRMED: "#10B981",
    NO_SHOW: "#9CA3AF",
  };

  return (
    <div className="pb-24">
      {/* Header */}
      <div
        className="px-4 pt-6 pb-8 text-white"
        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${business.accentColor})` }}
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl">
            {telegramUser ? "👤" : "🙋"}
          </div>
          <div>
            <h1 className="text-xl font-bold">{userName}</h1>
            {telegramUser?.username && (
              <p className="text-white/80 text-sm">@{telegramUser.username}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { label: "Заказов", value: orders.length },
            { label: "Записей", value: bookings.length },
            { label: "Потрачено", value: formatPrice(totalSpent) },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-lg font-bold leading-tight">{stat.value}</p>
              <p className="text-xs text-white/75 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b sticky top-0 z-10">
        {[
          { key: "orders" as const, label: "📦 Заказы", count: orders.length },
          { key: "bookings" as const, label: "📅 Записи", count: bookings.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2`}
            style={{
              borderColor: activeTab === tab.key ? primaryColor : "transparent",
              color: activeTab === tab.key ? primaryColor : undefined,
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className="text-xs rounded-full px-2 py-0.5 text-white font-bold"
                style={{ backgroundColor: activeTab === tab.key ? primaryColor : "#9CA3AF" }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div className="space-y-3">
            {orders.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-3">📭</div>
                <p className="font-semibold text-lg mb-2">Заказов пока нет</p>
                <p className="text-muted-foreground text-sm mb-5">
                  Сделайте первый заказ в нашем каталоге
                </p>
                <Link href={`/${slug}/catalog`}>
                  <Button style={{ backgroundColor: primaryColor }} className="text-white">
                    Перейти в каталог
                  </Button>
                </Link>
              </div>
            ) : (
              orders.map((order) => (
                <Link key={order.id} href={`/${slug}/orders/${order.id}`}>
                  <div className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-sm">
                          Заказ #{order.id.slice(-6).toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <span
                        className="text-xs px-2 py-1 rounded-full font-semibold"
                        style={{
                          backgroundColor: `${STATUS_COLORS[order.status] || "#9CA3AF"}20`,
                          color: STATUS_COLORS[order.status] || "#9CA3AF",
                        }}
                      >
                        {getOrderStatusLabel(order.status)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {order.items.slice(0, 2).map((i) => i.name).join(", ")}
                      {order.items.length > 2 && ` +${order.items.length - 2} ещё`}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        {order.deliveryType === "DELIVERY" ? "🚚 Доставка" : "🏪 Самовывоз"}
                      </span>
                      <span className="font-bold text-sm" style={{ color: primaryColor }}>
                        {formatPrice(order.totalPrice)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === "bookings" && (
          <div className="space-y-3">
            {bookings.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-3">📅</div>
                <p className="font-semibold text-lg mb-2">Записей пока нет</p>
                <p className="text-muted-foreground text-sm mb-5">
                  Запишитесь на услугу прямо сейчас
                </p>
                <Link href={`/${slug}/booking`}>
                  <Button style={{ backgroundColor: primaryColor }} className="text-white">
                    Записаться
                  </Button>
                </Link>
              </div>
            ) : (
              bookings.map((booking) => (
                <div key={booking.id} className="bg-white rounded-xl border p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-sm">
                        {booking.service?.name || "Услуга"}
                      </p>
                      {booking.staff && (
                        <p className="text-xs text-muted-foreground">
                          👤 {booking.staff.name}
                        </p>
                      )}
                    </div>
                    <span
                      className="text-xs px-2 py-1 rounded-full font-semibold"
                      style={{
                        backgroundColor: `${STATUS_COLORS[booking.status] || "#9CA3AF"}20`,
                        color: STATUS_COLORS[booking.status] || "#9CA3AF",
                      }}
                    >
                      {getBookingStatusLabel(booking.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>📅 {formatDate(booking.startTime)}</span>
                    <span>·</span>
                    <span>⏰ {formatTime(booking.startTime)}</span>
                  </div>
                  {booking.service?.price && (
                    <p className="text-sm font-bold mt-2" style={{ color: primaryColor }}>
                      {formatPrice(booking.service.price)}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <BottomNavigation businessSlug={slug} primaryColor={primaryColor} />
    </div>
  );
}
