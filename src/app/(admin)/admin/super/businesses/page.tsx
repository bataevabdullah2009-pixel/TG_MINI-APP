"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildBusinessUrl } from "@/lib/production-url";

interface BusinessTenant {
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
  _count?: {
    orders: number;
    customers: number;
    items: number;
  };
}

export default function SuperBusinessesRegistry() {
  const router = useRouter();
  const [tenants, setTenants] = useState<BusinessTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  useEffect(() => {
    // Auth Check
    const userJson = localStorage.getItem("adminUser");
    if (!userJson) {
      router.push("/admin/login");
      return;
    }
    const user = JSON.parse(userJson);
    if (user.role !== "SUPER_ADMIN") {
      router.push("/admin");
      return;
    }

    fetchTenants();
  }, [router]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/businesses");
      const data = await res.json();
      
      const list = Array.isArray(data) ? data : data?.data || [];
      setTenants(list);
    } catch (err) {
      console.error("Businesses API failed", err);
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleTenantStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/businesses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) {
        setTenants((prev) =>
          prev.map((t) => (t.id === id ? { ...t, isActive: !currentStatus } : t))
        );
      }
    } catch (e) {
      // Offline fallback
      setTenants((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isActive: !currentStatus } : t))
      );
    }
  };

  const filtered = tenants.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "ALL" || t.type === filterType;
    return matchesSearch && matchesType;
  });

  const businessTypes = ["ALL", "CAFE", "BARBERSHOP", "SHOP", "GROCERY", "HARDWARE_STORE", "CARWASH"];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans relative overflow-hidden pb-12">
      {/* Light glow effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[120px] pointer-events-none" />

      {/* Top Navigation */}
      <header className="relative z-10 max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-slate-900/60">
        <div className="flex items-center gap-3">
          <Link href="/admin/super" className="p-2 rounded-lg border border-slate-800 bg-slate-950/80 hover:bg-slate-900 text-xs font-semibold transition text-slate-400 hover:text-white">
            ← Панель
          </Link>
          <span className="text-slate-700">/</span>
          <h1 className="font-extrabold text-base">🏪 Список заведений</h1>
        </div>

        <Link 
          href="/admin/super/businesses/new"
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:brightness-110 text-white text-xs font-black shadow-lg shadow-indigo-500/10 transition"
        >
          ➕ Подключить точку
        </Link>
      </header>

      {/* Main Registry Body */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 mt-8">
        
        {/* Filters */}
        <div className="bg-slate-900/40 border border-slate-900/80 rounded-2xl p-4 mb-6 backdrop-blur-md">
          <input
            type="text"
            placeholder="🔍 Искать по названию или короткой ссылке (slug)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-850 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 mb-3"
          />

          <div className="flex flex-wrap gap-2">
            {businessTypes.map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider uppercase transition-all ${
                  filterType === t 
                    ? "bg-indigo-600 text-white" 
                    : "bg-slate-950 border border-slate-850 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
              >
                {t === "ALL" ? "Все типы" : t}
              </button>
            ))}
          </div>
        </div>

        {/* Catalog list */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/10 border border-slate-900/60 rounded-3xl">
            <span className="text-4xl block mb-2">📭</span>
            <p className="text-sm font-semibold text-slate-500">Заведения не найдены</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((tenant) => (
              <div 
                key={tenant.id}
                className="bg-slate-900/30 border border-slate-900 rounded-3xl overflow-hidden hover:border-slate-800 transition-all flex flex-col justify-between group shadow-xl"
              >
                {/* Brand Color Stripe */}
                <div 
                  className="h-2 w-full shrink-0" 
                  style={{ background: `linear-gradient(90deg, ${tenant.primaryColor || "#3B82F6"}, ${tenant.accentColor || "#FF6347"})` }}
                />

                <div className="p-6">
                  {/* Title & Slug */}
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <div>
                      <h3 className="font-extrabold text-lg text-white group-hover:text-indigo-400 transition">
                        {tenant.name}
                      </h3>
                      <Link 
                        href={buildBusinessUrl(tenant.slug)}
                        target="_blank"
                        className="text-xs text-slate-400 hover:text-indigo-400 underline font-mono mt-1 block"
                      >
                        /app/{tenant.slug}
                      </Link>
                    </div>

                    <span className="bg-slate-950 text-indigo-400 border border-slate-850 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">
                      {tenant.type}
                    </span>
                  </div>

                  {tenant.description && (
                    <p className="text-xs text-slate-400 leading-relaxed mb-4 line-clamp-2">
                      {tenant.description}
                    </p>
                  )}

                  {/* Count Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-950/60 rounded-xl p-3 border border-slate-900/60 mb-6 text-center">
                    <div>
                      <p className="font-black text-sm text-indigo-400">{tenant._count?.items || 0}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Товары</p>
                    </div>
                    <div className="border-x border-slate-900">
                      <p className="font-black text-sm text-cyan-400">{tenant._count?.orders || 0}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Заказы</p>
                    </div>
                    <div>
                      <p className="font-black text-sm text-purple-400">{tenant._count?.customers || 0}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Клиенты</p>
                    </div>
                  </div>

                  {/* Actions & Status */}
                  <div className="flex items-center justify-between gap-4 mt-2">
                    <button
                      onClick={() => toggleTenantStatus(tenant.id, tenant.isActive)}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
                        tenant.isActive 
                          ? "bg-emerald-600/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-600 hover:text-white" 
                          : "bg-red-600/10 border-red-500/20 text-red-400 hover:bg-red-600 hover:text-white"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${tenant.isActive ? "bg-emerald-400" : "bg-red-400"} animate-pulse`} />
                      {tenant.isActive ? "Активно" : "Отключено"}
                    </button>

                    <div className="flex gap-2">
                      <Link href={buildBusinessUrl(tenant.slug)} target="_blank">
                        <Button size="sm" variant="outline" className="text-[10px] font-bold border-slate-850 hover:bg-slate-900 bg-slate-950">
                          📱 WebView
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
