"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { formatDate, formatTime, formatPrice, getBookingStatusLabel } from "@/lib/utils";

interface Booking {
  id: string;
  customerName: string;
  customerPhone: string;
  startTime: string;
  endTime: string;
  status: string;
  comment?: string;
  service?: { id: string; name: string; price: number; durationMinutes?: number };
  staff?: { id: string; name: string };
  business?: { name: string; slug: string };
}

const BOOKING_STATUSES = ["NEW", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];

const STATUS_COLORS: Record<string, string> = {
  NEW: "#3B82F6",
  CONFIRMED: "#10B981",
  COMPLETED: "#6B7280",
  CANCELLED: "#EF4444",
  NO_SHOW: "#9CA3AF",
};

const STATUS_NEXT: Record<string, string[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export default function AdminBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [updating, setUpdating] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  useEffect(() => {
    const user = localStorage.getItem("adminUser");
    if (!user) { router.push("/admin/login"); return; }
    fetchBookings();
  }, [router]);

  async function fetchBookings() {
    try {
      const res = await apiClient.get("/bookings?limit=100");
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setBookings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(bookingId: string, status: string) {
    setUpdating(true);
    try {
      await apiClient.patch(`/bookings/${bookingId}`, { status });
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status } : b))
      );
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking((prev) => prev ? { ...prev, status } : null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  }

  const filtered = bookings.filter((b) => {
    const matchSearch =
      !search ||
      b.customerName.toLowerCase().includes(search.toLowerCase()) ||
      b.customerPhone.includes(search) ||
      b.service?.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || b.status === filterStatus;
    const matchDate =
      !filterDate || b.startTime.startsWith(filterDate);
    return matchSearch && matchStatus && matchDate;
  });

  const stats = {
    total: bookings.length,
    new: bookings.filter((b) => b.status === "NEW").length,
    confirmed: bookings.filter((b) => b.status === "CONFIRMED").length,
    today: bookings.filter((b) => b.startTime.startsWith(new Date().toISOString().split("T")[0])).length,
  };

  // Group by date for calendar view
  const groupedByDate = filtered.reduce((acc, b) => {
    const date = b.startTime.split("T")[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(b);
    return acc;
  }, {} as Record<string, Booking[]>);

  const sortedDates = Object.keys(groupedByDate).sort();

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
            <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm">← Dashboard</Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="font-bold text-lg">📅 Записи</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${viewMode === "list" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}
            >☰ Список</button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${viewMode === "calendar" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}
            >📅 По дням</button>
            <Button size="sm" onClick={fetchBookings} variant="outline">🔄</Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Всего", value: stats.total, color: "#6B7280" },
            { label: "🆕 Новых", value: stats.new, color: "#3B82F6" },
            { label: "✅ Подтверждено", value: stats.confirmed, color: "#10B981" },
            { label: "📅 Сегодня", value: stats.today, color: "#F59E0B" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Main Content */}
          <div className="flex-1">
            {/* Filters */}
            <div className="bg-white rounded-xl border p-4 mb-4">
              <div className="flex flex-col md:flex-row gap-3 mb-3">
                <Input
                  placeholder="🔍 Поиск по клиенту, телефону, услуге..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="md:w-48"
                />
                {filterDate && (
                  <Button variant="outline" size="sm" onClick={() => setFilterDate("")}>✕ Дата</Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterStatus(null)}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${!filterStatus ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}
                >Все ({bookings.length})</button>
                {BOOKING_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s === filterStatus ? null : s)}
                    className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                    style={{
                      backgroundColor: filterStatus === s ? STATUS_COLORS[s] : `${STATUS_COLORS[s]}20`,
                      color: filterStatus === s ? "white" : STATUS_COLORS[s],
                    }}
                  >
                    {getBookingStatusLabel(s)} ({bookings.filter((b) => b.status === s).length})
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white rounded-xl border text-center py-12 text-muted-foreground">
                <div className="text-4xl mb-3">📭</div>
                <p>Записи не найдены</p>
              </div>
            ) : viewMode === "list" ? (
              /* List View */
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Клиент</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Услуга</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Дата & Время</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Статус</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((booking) => (
                      <tr
                        key={booking.id}
                        className={`border-b hover:bg-gray-50 cursor-pointer transition-colors ${selectedBooking?.id === booking.id ? "bg-blue-50" : ""}`}
                        onClick={() => setSelectedBooking(booking)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium">{booking.customerName}</p>
                          <p className="text-xs text-muted-foreground">{booking.customerPhone}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{booking.service?.name || "—"}</p>
                          {booking.staff && <p className="text-xs text-muted-foreground">👤 {booking.staff.name}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{formatDate(booking.startTime)}</p>
                          <p className="text-xs text-muted-foreground">{formatTime(booking.startTime)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="px-2 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${STATUS_COLORS[booking.status]}20`,
                              color: STATUS_COLORS[booking.status],
                            }}
                          >
                            {getBookingStatusLabel(booking.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="ghost">→</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Calendar View */
              <div className="space-y-4">
                {sortedDates.map((date) => {
                  const isToday = date === new Date().toISOString().split("T")[0];
                  return (
                    <div key={date} className="bg-white rounded-xl border overflow-hidden">
                      <div className={`px-4 py-2.5 font-semibold text-sm flex items-center gap-2 ${isToday ? "bg-blue-600 text-white" : "bg-gray-50 border-b"}`}>
                        {isToday && <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Сегодня</span>}
                        {new Date(date).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
                        <span className={`ml-auto text-xs ${isToday ? "text-white/80" : "text-muted-foreground"}`}>
                          {groupedByDate[date].length} зап.
                        </span>
                      </div>
                      <div className="divide-y">
                        {groupedByDate[date]
                          .sort((a, b) => a.startTime.localeCompare(b.startTime))
                          .map((booking) => (
                            <div
                              key={booking.id}
                              className={`flex items-center gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${selectedBooking?.id === booking.id ? "bg-blue-50" : ""}`}
                              onClick={() => setSelectedBooking(booking)}
                            >
                              <div className="w-14 text-center flex-shrink-0">
                                <p className="font-bold text-sm">{formatTime(booking.startTime)}</p>
                                {booking.service?.durationMinutes && (
                                  <p className="text-xs text-muted-foreground">{booking.service.durationMinutes}м</p>
                                )}
                              </div>
                              <div
                                className="w-1 h-10 rounded-full flex-shrink-0"
                                style={{ backgroundColor: STATUS_COLORS[booking.status] }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{booking.customerName}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {booking.service?.name || "Услуга"}
                                  {booking.staff && ` · ${booking.staff.name}`}
                                </p>
                              </div>
                              <span
                                className="px-2 py-1 rounded-full text-xs font-medium flex-shrink-0"
                                style={{
                                  backgroundColor: `${STATUS_COLORS[booking.status]}20`,
                                  color: STATUS_COLORS[booking.status],
                                }}
                              >
                                {getBookingStatusLabel(booking.status)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detail Sidebar */}
          {selectedBooking && (
            <div className="w-full md:w-80 flex-shrink-0">
              <div className="bg-white rounded-xl border p-4 sticky top-20">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="font-bold">Детали записи</h2>
                  <button onClick={() => setSelectedBooking(null)} className="text-muted-foreground">✕</button>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Клиент</p>
                    <p className="font-semibold">{selectedBooking.customerName}</p>
                    <a href={`tel:${selectedBooking.customerPhone}`} className="text-sm text-blue-600">
                      {selectedBooking.customerPhone}
                    </a>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Услуга</p>
                    <p className="font-semibold">{selectedBooking.service?.name || "—"}</p>
                    {selectedBooking.service?.price && (
                      <p className="text-sm text-blue-600">{formatPrice(selectedBooking.service.price)}</p>
                    )}
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Дата и время</p>
                    <p className="font-semibold">{formatDate(selectedBooking.startTime)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatTime(selectedBooking.startTime)} – {formatTime(selectedBooking.endTime)}
                    </p>
                  </div>

                  {selectedBooking.staff && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Мастер</p>
                      <p className="font-semibold">👤 {selectedBooking.staff.name}</p>
                    </div>
                  )}

                  {selectedBooking.comment && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Комментарий</p>
                      <p className="text-sm">{selectedBooking.comment}</p>
                    </div>
                  )}
                </div>

                {/* Status Actions */}
                {STATUS_NEXT[selectedBooking.status]?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Изменить статус:</p>
                    <div className="space-y-2">
                      {STATUS_NEXT[selectedBooking.status].map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(selectedBooking.id, s)}
                          disabled={updating}
                          className="w-full py-2 px-3 rounded-lg text-sm font-medium transition-all disabled:opacity-50 text-white"
                          style={{ backgroundColor: STATUS_COLORS[s] }}
                        >
                          {getBookingStatusLabel(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
