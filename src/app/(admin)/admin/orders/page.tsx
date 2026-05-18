"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { formatPrice, formatDateTime, getOrderStatusLabel } from "@/lib/utils";

interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  totalPrice: number;
  status: string;
  deliveryType: string;
  createdAt: string;
  items: Array<{ name: string; quantity: number }>;
  business?: { name: string; slug: string };
}

const ORDER_STATUSES = ["NEW", "ACCEPTED", "PREPARING", "READY", "DELIVERING", "COMPLETED", "CANCELLED"];

const STATUS_COLORS: Record<string, string> = {
  NEW: "#3B82F6",
  ACCEPTED: "#10B981",
  PREPARING: "#F59E0B",
  READY: "#8B5CF6",
  DELIVERING: "#F59E0B",
  COMPLETED: "#10B981",
  CANCELLED: "#EF4444",
};

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem("adminUser");
    if (!user) { router.push("/admin/login"); return; }
    fetchOrders();
  }, [router]);

  async function fetchOrders() {
    try {
      const res = await apiClient.get("/orders?limit=100");
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(orderId: string, status: string) {
    setUpdatingStatus(true);
    try {
      await apiClient.patch(`/orders/${orderId}`, { status });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => prev ? { ...prev, status } : null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingStatus(false);
    }
  }

  const filtered = orders.filter((o) => {
    const matchSearch =
      !search ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.customerPhone.includes(search) ||
      o.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: orders.length,
    new: orders.filter((o) => o.status === "NEW").length,
    inProgress: orders.filter((o) => ["ACCEPTED", "PREPARING", "READY", "DELIVERING"].includes(o.status)).length,
    completed: orders.filter((o) => o.status === "COMPLETED").length,
    revenue: orders.filter((o) => o.status !== "CANCELLED").reduce((sum, o) => sum + o.totalPrice, 0),
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm">
              ← Dashboard
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="font-bold text-lg">📦 Заказы</h1>
          </div>
          <Button size="sm" onClick={fetchOrders} variant="outline">
            🔄 Обновить
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: "Всего", value: stats.total, color: "#6B7280" },
            { label: "🆕 Новых", value: stats.new, color: "#3B82F6" },
            { label: "⚡ В работе", value: stats.inProgress, color: "#F59E0B" },
            { label: "✅ Завершено", value: stats.completed, color: "#10B981" },
            { label: "💰 Выручка", value: formatPrice(stats.revenue), color: "#8B5CF6" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold mt-1" style={{ color: s.color }}>
                  {s.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Orders List */}
          <div className="flex-1">
            {/* Filters */}
            <div className="bg-white rounded-xl border p-4 mb-4">
              <Input
                placeholder="🔍 Поиск по имени, телефону, ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-3"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterStatus(null)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    !filterStatus ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  Все ({orders.length})
                </button>
                {ORDER_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s === filterStatus ? null : s)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all`}
                    style={{
                      backgroundColor: filterStatus === s ? STATUS_COLORS[s] : `${STATUS_COLORS[s]}20`,
                      color: filterStatus === s ? "white" : STATUS_COLORS[s],
                    }}
                  >
                    {getOrderStatusLabel(s)} ({orders.filter((o) => o.status === s).length})
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border overflow-hidden">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="text-4xl mb-3">📭</div>
                  <p>Заказы не найдены</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">ID</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Клиент</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Сумма</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Статус</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Дата</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((order) => (
                        <tr
                          key={order.id}
                          className={`border-b hover:bg-gray-50 cursor-pointer transition-colors ${
                            selectedOrder?.id === order.id ? "bg-blue-50" : ""
                          }`}
                          onClick={() => setSelectedOrder(order)}
                        >
                          <td className="px-4 py-3 font-mono font-semibold text-xs">
                            #{order.id.slice(-6).toUpperCase()}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{order.customerName}</p>
                            <p className="text-xs text-muted-foreground">{order.customerPhone}</p>
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {formatPrice(order.totalPrice)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="px-2 py-1 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: `${STATUS_COLORS[order.status] || "#9CA3AF"}20`,
                                color: STATUS_COLORS[order.status] || "#9CA3AF",
                              }}
                            >
                              {getOrderStatusLabel(order.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {formatDateTime(order.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                            >
                              →
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Order Detail Sidebar */}
          {selectedOrder && (
            <div className="w-full md:w-96 flex-shrink-0">
              <div className="bg-white rounded-xl border p-4 sticky top-20">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="font-bold text-lg">
                    Заказ #{selectedOrder.id.slice(-6).toUpperCase()}
                  </h2>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>

                {/* Customer */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Клиент</p>
                  <p className="font-semibold">{selectedOrder.customerName}</p>
                  <a href={`tel:${selectedOrder.customerPhone}`} className="text-sm text-blue-600">
                    {selectedOrder.customerPhone}
                  </a>
                </div>

                {/* Items */}
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Состав заказа</p>
                  <div className="space-y-1">
                    {selectedOrder.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{item.name}</span>
                        <span className="text-muted-foreground">× {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                    <span>Итого</span>
                    <span>{formatPrice(selectedOrder.totalPrice)}</span>
                  </div>
                </div>

                {/* Info */}
                <div className="mb-4 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Способ</span>
                    <span>{selectedOrder.deliveryType === "DELIVERY" ? "🚚 Доставка" : "🏪 Самовывоз"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Дата</span>
                    <span className="text-xs">{formatDateTime(selectedOrder.createdAt)}</span>
                  </div>
                </div>

                {/* Status Update */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Изменить статус:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ORDER_STATUSES.filter((s) => s !== selectedOrder.status).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(selectedOrder.id, s)}
                        disabled={updatingStatus}
                        className="py-2 px-3 rounded-lg text-xs font-medium transition-all hover:opacity-90 disabled:opacity-50"
                        style={{
                          backgroundColor: `${STATUS_COLORS[s] || "#9CA3AF"}20`,
                          color: STATUS_COLORS[s] || "#9CA3AF",
                          border: `1px solid ${STATUS_COLORS[s] || "#9CA3AF"}40`,
                        }}
                      >
                        {getOrderStatusLabel(s)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
