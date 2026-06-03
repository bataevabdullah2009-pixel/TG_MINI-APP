"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { formatPrice, formatDateTime, getOrderStatusLabel, getBookingStatusLabel } from "@/lib/utils";

interface Stats {
  totalBusinesses: number;
  totalOrders: number;
  totalBookings: number;
  totalCustomers: number;
  revenue: number;
  recentOrders: Array<{
    id: string;
    customerName: string;
    totalPrice: number;
    status: string;
    createdAt: string;
    business?: { name: string; slug: string };
  }>;
  recentBookings: Array<{
    id: string;
    customerName: string;
    startTime: string;
    status: string;
    service?: { name: string };
    business?: { name: string };
  }>;
  ordersByStatus: Array<{ status: string; _count: { id: number }; _sum: { totalPrice: number } }>;
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "#3B82F6",
  ACCEPTED: "#10B981",
  PREPARING: "#F59E0B",
  READY: "#8B5CF6",
  DELIVERING: "#F59E0B",
  COMPLETED: "#10B981",
  CANCELLED: "#EF4444",
  EXPIRED: "#64748B",
};

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminUser, setAdminUser] = useState<{ email: string; role: string; businessId?: string } | null>(null);

  useEffect(() => {
    const user = localStorage.getItem("adminUser");
    if (!user) {
      router.push("/admin/login");
      return;
    }
    const parsed = JSON.parse(user);
    if (parsed.role === "MANAGER") {
      router.push("/admin/orders");
      return;
    }
    setAdminUser(parsed);
    fetchStats(parsed);
  }, [router]);

  async function fetchStats(user: any) {
    try {
      const url = user?.role === "SUPER_ADMIN"
        ? "/admin/stats"
        : `/admin/stats?businessId=${user?.businessId || ""}`;
      const res = await apiClient.get(url);
      setStats(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("adminUser");
    localStorage.removeItem("accessToken");
    document.cookie = "adminUser=; path=/; max-age=0";
    document.cookie = "accessToken=; path=/; max-age=0";
    router.push("/admin/login");
  };

  const isSuper = adminUser?.role === "SUPER_ADMIN";
  const isManager = adminUser?.role === "MANAGER";

  const links = isSuper
    ? [
        { href: "/admin", icon: "🏠", label: "Панель" },
        { href: "/admin/super", icon: "👑", label: "SaaS Панель" },
        { href: "/admin/super/businesses", icon: "🏪", label: "Все бизнесы" },
        { href: "/admin/orders", icon: "📦", label: "Заказы" },
        { href: "/admin/bookings", icon: "📅", label: "Записи" },
        { href: "/admin/items", icon: "🛍️", label: "Товары" },
        { href: "/admin/customers", icon: "👥", label: "Клиенты" },
      ]
    : [
        { href: "/admin", icon: "🏠", label: "Панель" },
        { href: "/admin/orders", icon: "📦", label: "Заказы" },
        { href: "/admin/bookings", icon: "📅", label: "Записи" },
        { href: "/admin/items", icon: "🛍️", label: "Товары" },
        { href: "/admin/categories", icon: "📁", label: "Категории" },
        { href: "/admin/customers", icon: "👥", label: "Клиенты" },
        { href: "/admin/ai", icon: "🤖", label: "ИИ-Маркетинг" },
        ...(!isManager ? [{ href: "/admin/settings", icon: "⚙️", label: "Настройки" }] : []),
      ];
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка панели...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-905 bg-slate-900 text-white flex flex-col transform transition-transform duration-300 md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="p-5 border-b border-white/10">
          <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <img src="/logo.svg" alt="" className="h-6 w-6 rounded-lg" /> Vitrina AI
          </h1>
          <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider mt-0.5">Control Center</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
            >
              <span>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
              {adminUser?.email?.[0]?.toUpperCase() || "A"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{adminUser?.email}</p>
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">{adminUser?.role || "Admin"}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors text-left"
          >
            🚪 Выйти
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-1 rounded text-muted-foreground hover:text-foreground"
            >
              ☰
            </button>
            <h2 className="font-semibold">Dashboard</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={fetchStats}>
              🔄 Обновить
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {/* Welcome */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Добро пожаловать 👋</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Вот что происходит на вашей платформе сегодня
            </p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {[
              { label: "🏪 Бизнесов", value: stats?.totalBusinesses || 0, href: "/admin/businesses", color: "#6366F1" },
              { label: "📦 Заказов", value: stats?.totalOrders || 0, href: "/admin/orders", color: "#3B82F6" },
              { label: "📅 Записей", value: stats?.totalBookings || 0, href: "/admin/bookings", color: "#10B981" },
              { label: "👥 Клиентов", value: stats?.totalCustomers || 0, href: "/admin/customers", color: "#F59E0B" },
              { label: "💰 Выручка", value: formatPrice(stats?.revenue || 0), href: "/admin/orders", color: "#8B5CF6" },
            ].map((card) => (
              <Link key={card.label} href={card.href}>
                <div className="bg-white rounded-xl border p-4 hover:shadow-md transition-all group cursor-pointer">
                  <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
                  <p
                    className="text-2xl font-bold group-hover:scale-105 transition-transform"
                    style={{ color: card.color }}
                  >
                    {card.value}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {/* Orders Status Breakdown */}
          {stats?.ordersByStatus && stats.ordersByStatus.length > 0 && (
            <div className="bg-white rounded-xl border p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold">📊 Заказы по статусам</h2>
                <Link href="/admin/orders" className="text-sm text-blue-600 hover:underline">
                  Все заказы →
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {stats.ordersByStatus.map((s) => (
                  <div
                    key={s.status}
                    className="p-3 rounded-xl text-center"
                    style={{ backgroundColor: `${STATUS_COLORS[s.status] || "#9CA3AF"}15` }}
                  >
                    <p
                      className="text-xl font-bold"
                      style={{ color: STATUS_COLORS[s.status] || "#9CA3AF" }}
                    >
                      {s._count.id}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getOrderStatusLabel(s.status)}
                    </p>
                    {s._sum.totalPrice > 0 && (
                      <p className="text-xs font-medium mt-0.5" style={{ color: STATUS_COLORS[s.status] }}>
                        {formatPrice(s._sum.totalPrice)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recent Orders */}
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h2 className="font-bold">📦 Последние заказы</h2>
                <Link href="/admin/orders" className="text-sm text-blue-600 hover:underline">
                  Все →
                </Link>
              </div>
              {!stats?.recentOrders?.length ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Заказов ещё нет
                </div>
              ) : (
                <div className="divide-y">
                  {stats.recentOrders.map((order) => (
                    <Link
                      key={order.id}
                      href="/admin/orders"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{order.customerName}</p>
                          <span className="text-xs text-muted-foreground font-mono">
                            #{order.id.slice(-4).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {order.business?.name} · {formatDateTime(order.createdAt)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-sm">{formatPrice(order.totalPrice)}</p>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${STATUS_COLORS[order.status] || "#9CA3AF"}20`,
                            color: STATUS_COLORS[order.status] || "#9CA3AF",
                          }}
                        >
                          {getOrderStatusLabel(order.status)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Bookings */}
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h2 className="font-bold">📅 Предстоящие записи</h2>
                <Link href="/admin/bookings" className="text-sm text-blue-600 hover:underline">
                  Все →
                </Link>
              </div>
              {!stats?.recentBookings?.length ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Записей ещё нет
                </div>
              ) : (
                <div className="divide-y">
                  {stats.recentBookings.map((booking) => (
                    <Link
                      key={booking.id}
                      href="/admin/bookings"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex-shrink-0 flex flex-col items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: "#10B981" }}
                      >
                        <span>{new Date(booking.startTime).getDate()}</span>
                        <span className="text-xs opacity-80">
                          {new Date(booking.startTime).toLocaleString("ru-RU", { month: "short" })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{booking.customerName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {booking.service?.name || "Услуга"} ·{" "}
                          {new Date(booking.startTime).toLocaleTimeString("ru-RU", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: booking.status === "CONFIRMED" ? "#10B98120" : "#3B82F620",
                          color: booking.status === "CONFIRMED" ? "#10B981" : "#3B82F6",
                        }}
                      >
                        {getBookingStatusLabel(booking.status)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="mt-6 bg-white rounded-xl border p-4">
            <h2 className="font-bold mb-3">⚡ Быстрые действия</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { href: "/admin/orders", icon: "📦", label: "Заказы", desc: "Управление заказами" },
                { href: "/admin/bookings", icon: "📅", label: "Записи", desc: "Календарь записей" },
                { href: "/admin/businesses", icon: "🏪", label: "Бизнесы", desc: "Все клиенты" },
                { href: "/admin/items", icon: "🛍️", label: "Товары", desc: "Каталог товаров" },
              ].map((link) => (
                <Link key={link.href} href={link.href}>
                  <div className="p-3 rounded-xl border hover:border-blue-300 hover:shadow-md transition-all group">
                    <div className="text-2xl mb-2">{link.icon}</div>
                    <p className="font-semibold text-sm group-hover:text-blue-600 transition-colors">
                      {link.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{link.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
