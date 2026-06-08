"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { formatPrice } from "@/lib/utils";

interface Business {
  id: string;
  slug: string;
  name: string;
  type: string;
  description?: string;
  primaryColor: string;
  accentColor: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  subscriptionStatus: string;
  createdAt: string;
  _count?: { orders: number; customers: number; items: number };
}

const TYPE_EMOJI: Record<string, string> = {
  CAFE: "☕",
  BARBERSHOP: "✂️",
  CARWASH: "🚗",
  SHOP: "🛍️",
  COURSES: "📚",
  CUSTOM: "⚙️",
};

const SUB_COLORS: Record<string, string> = {
  TRIAL: "#F59E0B",
  ACTIVE: "#10B981",
  EXPIRED: "#EF4444",
  BLOCKED: "#EF4444",
};

export default function AdminBusinessesPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);

  useEffect(() => {
    const user = localStorage.getItem("adminUser");
    if (!user) { router.push("/admin/login"); return; }
    fetchBusinesses();
  }, [router]);

  async function fetchBusinesses() {
    try {
      const res = await apiClient.get("/businesses");
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setBusinesses(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = businesses.filter((b) => {
    const matchSearch =
      !search ||
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.slug.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || b.type === filterType;
    return matchSearch && matchType;
  });

  const types = [...new Set(businesses.map((b) => b.type))];

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
            <h1 className="font-bold text-lg">🏪 Бизнесы</h1>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={fetchBusinesses} variant="outline">🔄</Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">+ Добавить</Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Всего", value: businesses.length, color: "#6B7280" },
            { label: "✅ Активных", value: businesses.filter((b) => b.isActive).length, color: "#10B981" },
            { label: "🟡 На триале", value: businesses.filter((b) => b.subscriptionStatus === "TRIAL").length, color: "#F59E0B" },
            { label: "❌ Заблокировано", value: businesses.filter((b) => !b.isActive).length, color: "#EF4444" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border p-4 mb-4">
          <Input
            placeholder="🔍 Поиск по названию или slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterType(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${!filterType ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              Все типы
            </button>
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t === filterType ? null : t)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${filterType === t ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {TYPE_EMOJI[t]} {t}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border text-center py-12 text-muted-foreground">
            <div className="text-4xl mb-3">🏪</div>
            <p>Бизнесы не найдены</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((biz) => (
              <div
                key={biz.id}
                className="bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow group"
              >
                {/* Color Header */}
                <div
                  className="h-2"
                  style={{ background: `linear-gradient(90deg, ${biz.primaryColor}, ${biz.accentColor})` }}
                />
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                        style={{ backgroundColor: `${biz.primaryColor}20` }}
                      >
                        {TYPE_EMOJI[biz.type] || "⚙️"}
                      </div>
                      <div>
                        <h3 className="font-bold leading-tight">{biz.name}</h3>
                        <p className="text-xs text-muted-foreground">/{biz.slug}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: `${SUB_COLORS[biz.subscriptionStatus]}20`,
                          color: SUB_COLORS[biz.subscriptionStatus],
                        }}
                      >
                        {biz.subscriptionStatus}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          biz.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                        }`}
                      >
                        {biz.isActive ? "Активен" : "Отключён"}
                      </span>
                    </div>
                  </div>

                  {biz.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{biz.description}</p>
                  )}

                  {/* Stats */}
                  {biz._count && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: "Заказы", value: biz._count.orders },
                        { label: "Клиенты", value: biz._count.customers },
                        { label: "Товары", value: biz._count.items },
                      ].map((s) => (
                        <div key={s.label} className="text-center p-2 bg-gray-50 rounded-lg">
                          <p className="font-bold text-sm">{s.value}</p>
                          <p className="text-xs text-muted-foreground">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link href={`/app/${biz.slug}`} target="_blank" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        👁️ Mini App
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      className="flex-1 text-xs text-white"
                      style={{ backgroundColor: biz.primaryColor }}
                    >
                      ⚙️ Настройки
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
