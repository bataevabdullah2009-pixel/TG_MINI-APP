"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Search, Store, Star, Heart } from "lucide-react";

type Business = {
  id: string;
  slug: string;
  name: string;
  type: string;
  typeLabel: string;
  templateKey: string;
  description?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  primaryColor: string;
  accentColor: string;
  rating: number;
  isOpen: boolean;
};

const categories = [
  { key: "ALL", label: "Все", icon: "✨" },
  { key: "CAFE", label: "Еда", icon: "🍔" },
  { key: "BARBERSHOP", label: "Барбершопы", icon: "💈" },
  { key: "SHOP", label: "Магазины", icon: "🛒" },
  { key: "GROCERY", label: "Продукты", icon: "🥦" },
  { key: "HARDWARE_STORE", label: "Хозмаг", icon: "🧰" },
  { key: "CARWASH", label: "Автомойки", icon: "🚘" },
];

interface ClientHomeProps {
  businesses: Business[];
  query: string;
  setQuery: (q: string) => void;
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  loading: boolean;
  loadError?: string | null;
  favorites: string[];
  toggleFavorite: (slug: string) => void;
}

export function ClientHome({
  businesses,
  query,
  setQuery,
  activeCategory,
  setActiveCategory,
  loading,
  loadError,
  favorites,
  toggleFavorite,
}: ClientHomeProps) {
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return businesses.filter((business) => {
      const categoryMatch = activeCategory === "ALL" || business.type === activeCategory;
      const searchMatch =
        !needle ||
        business.name.toLowerCase().includes(needle) ||
        (business.description || "").toLowerCase().includes(needle) ||
        business.typeLabel.toLowerCase().includes(needle);
      return categoryMatch && searchMatch;
    });
  }, [businesses, activeCategory, query]);

  return (
    <div className="pb-24 text-slate-900">
      {/* Top Banner */}
      <section className="rounded-b-[32px] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-5 pb-8 pt-6 text-white shadow-xl shadow-slate-950/20">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center gap-3">
            <img src="/logo.svg" alt="" className="h-12 w-12 rounded-2xl shadow-lg shadow-indigo-950/20" />
            <div>
              <p className="text-[10px] font-black tracking-[0.2em] text-indigo-400">умные витрины для Telegram</p>
              <h1 className="text-3xl font-black tracking-tight mt-0.5">Vitrina AI</h1>
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3.5 ring-1 ring-white/15 backdrop-blur-md focus-within:ring-white/30 transition">
            <Search size={18} className="text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск заведений, еды, услуг..."
              className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-400"
            />
          </label>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-3xl px-4 py-5">
        <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2">
          {categories.map((category) => (
            <button
              key={category.key}
              onClick={() => setActiveCategory(category.key)}
              className={`shrink-0 rounded-2xl px-4.5 py-2.5 text-xs font-black transition-all duration-200 active:scale-95 ${
                activeCategory === category.key
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-white text-slate-600 ring-1 ring-slate-200/60"
              }`}
            >
              <span className="mr-1.5">{category.icon}</span>
              {category.label}
            </button>
          ))}
        </div>

        {/* Directory List */}
        <div className="mt-4 grid gap-4">
          {loading && (
            <div className="flex flex-col items-center justify-center rounded-3xl bg-white py-12 text-center ring-1 ring-slate-100">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3" />
              <p className="text-xs font-bold text-slate-500">Загрузка каталога...</p>
            </div>
          )}

          {!loading && loadError && (
            <div className="rounded-3xl bg-rose-50 p-8 text-center ring-1 ring-rose-200">
              <Store className="mx-auto mb-3 text-rose-300" size={48} />
              <h3 className="font-extrabold text-rose-800">Каталог временно недоступен</h3>
              <p className="mt-1.5 text-xs text-rose-600">{loadError}</p>
            </div>
          )}

          {!loading && !loadError && filtered.length === 0 && (
            <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-slate-100">
              <Store className="mx-auto mb-3 text-slate-300" size={48} />
              <h3 className="font-extrabold text-slate-800">Ничего не найдено</h3>
              <p className="mt-1.5 text-xs text-slate-500">
                Попробуйте изменить поисковый запрос или фильтр категории.
              </p>
            </div>
          )}

          {filtered.map((business) => (
            <article
              key={business.id}
              className="group overflow-hidden rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 hover:ring-indigo-200/50 transition-all duration-300"
            >
              <div className="flex gap-4">
                <div
                  className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-2xl p-1.5 text-2xl font-black text-white relative shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${business.primaryColor}, ${business.accentColor})`,
                  }}
                >
                  {business.logoUrl ? (
                      <img
                        src={business.logoUrl}
                        alt=""
                        className="h-full w-full rounded-xl bg-white/90 object-cover"
                      />
                  ) : (
                    business.name[0]
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="truncate text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {business.name}
                      </h3>
                      <p className="text-[11px] font-bold text-slate-400 mt-0.5">{business.typeLabel}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        business.isOpen
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60"
                          : "bg-slate-100 text-slate-500 ring-1 ring-slate-200/60"
                      }`}
                    >
                      {business.isOpen ? "Открыто" : "Закрыто"}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs font-medium text-slate-500 leading-relaxed">
                    {business.description || "Описание заведения скоро появится."}
                  </p>
                  <p className="mt-1.5 text-[10px] font-semibold text-slate-400">
                    📍 {business.address || "Адрес уточняется"}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3.5">
                <div className="flex items-center gap-1 text-xs font-black text-amber-500">
                  <Star size={15} fill="currentColor" />
                  {business.rating.toFixed(1)}
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleFavorite(business.slug)}
                    className={`grid h-8 w-8 place-items-center rounded-xl ring-1 transition active:scale-90 ${
                      favorites.includes(business.slug)
                        ? "bg-rose-50 text-rose-600 ring-rose-200"
                        : "bg-white text-slate-400 ring-slate-200"
                    }`}
                  >
                    <Heart size={15} fill={favorites.includes(business.slug) ? "currentColor" : "none"} />
                  </button>
                  <Link
                    href={`/app/${business.slug}`}
                    className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-black text-white hover:bg-indigo-600 transition active:scale-95"
                  >
                    Открыть
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
