"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Star, Store, Heart, ShoppingBag, Eye } from "lucide-react";

interface ClientFavoritesProps {
  telegramUserId: string;
}

export function ClientFavorites({ telegramUserId }: ClientFavoritesProps) {
  const [activeTab, setActiveTab] = useState<"SHOPS" | "ITEMS">("SHOPS");
  const [data, setData] = useState<{ favoriteBusinesses: any[]; favoriteItems: any[] }>({
    favoriteBusinesses: [],
    favoriteItems: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!telegramUserId) return;

    setLoading(true);
    fetch(`/api/customers/favorites?telegramUserId=${telegramUserId}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.ok) {
          setData(resData.data);
        } else {
          setError(resData.error || "Не удалось загрузить избранное");
        }
      })
      .catch((e) => {
        console.error(e);
        setError("Ошибка связи с сервером");
      })
      .finally(() => setLoading(false));
  }, [telegramUserId]);

  const removeFavorite = async (businessId: string, itemId?: string) => {
    try {
      const res = await fetch("/api/customers/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId,
          businessId,
          itemId,
          action: "remove",
        }),
      });

      if (res.ok) {
        // Refilter local state
        if (itemId) {
          setData((d) => ({
            ...d,
            favoriteItems: d.favoriteItems.filter((i) => i.itemId !== itemId),
          }));
        } else {
          setData((d) => ({
            ...d,
            favoriteBusinesses: d.favoriteBusinesses.filter((b) => b.businessId !== businessId),
          }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="px-4 py-5 text-slate-900 pb-24">
      <div className="mb-5">
        <h1 className="text-2xl font-black tracking-tight">Избранное</h1>
        <p className="text-xs font-semibold text-slate-400 mt-0.5">Ваши любимые заведения и товары</p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 mb-5">
        <button
          onClick={() => setActiveTab("SHOPS")}
          className={`rounded-xl py-2 text-xs font-black transition-all ${
            activeTab === "SHOPS" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
          }`}
        >
          Заведения ({data.favoriteBusinesses.length})
        </button>
        <button
          onClick={() => setActiveTab("ITEMS")}
          className={`rounded-xl py-2 text-xs font-black transition-all ${
            activeTab === "ITEMS" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
          }`}
        >
          Товары ({data.favoriteItems.length})
        </button>
      </div>

      {loading && (
        <div className="py-12 text-center">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-slate-900 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-400">Загрузка...</p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-rose-50 p-4 text-center text-xs font-bold text-rose-700 ring-1 ring-rose-200/50">
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && (
        <div>
          {/* Shops Tab */}
          {activeTab === "SHOPS" && (
            <div className="grid gap-3">
              {data.favoriteBusinesses.length === 0 ? (
                <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-slate-100/80">
                  <Store className="mx-auto mb-3 text-slate-300" size={40} />
                  <h4 className="font-extrabold text-slate-800">Список пуст</h4>
                  <p className="mt-1 text-xs text-slate-400">Вы пока не добавили ни одного заведения.</p>
                </div>
              ) : (
                data.favoriteBusinesses.map((fav) => (
                  <div
                    key={fav.id}
                    className="flex items-center gap-3.5 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-100"
                  >
                    <div
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg font-black text-white"
                      style={{
                        background: `linear-gradient(135deg, ${fav.business.primaryColor}, ${fav.business.accentColor})`,
                      }}
                    >
                      {fav.business.logoUrl ? (
                        <img
                          src={fav.business.logoUrl}
                          alt=""
                          className="h-full w-full rounded-xl object-cover"
                        />
                      ) : (
                        fav.business.name[0]
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-extrabold text-slate-900">{fav.business.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">📍 {fav.business.address || "Адрес не указан"}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => removeFavorite(fav.businessId)}
                        className="grid h-8 w-8 place-items-center rounded-xl bg-slate-50 text-rose-600 hover:bg-rose-50 transition"
                      >
                        <Heart size={14} fill="currentColor" />
                      </button>
                      <Link
                        href={`/app/${fav.business.slug}`}
                        className="grid h-8 w-8 place-items-center rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition"
                      >
                        <Eye size={14} />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Items Tab */}
          {activeTab === "ITEMS" && (
            <div className="grid gap-3">
              {data.favoriteItems.length === 0 ? (
                <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-slate-100/80">
                  <ShoppingBag className="mx-auto mb-3 text-slate-300" size={40} />
                  <h4 className="font-extrabold text-slate-800">Список пуст</h4>
                  <p className="mt-1 text-xs text-slate-400">Вы пока не добавили ни одного товара.</p>
                </div>
              ) : (
                data.favoriteItems.map((fav) => (
                  <div
                    key={fav.id}
                    className="flex items-center gap-3.5 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-100"
                  >
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-50 border text-slate-400 text-xl font-bold">
                      📦
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-extrabold text-slate-900">{fav.item.name}</h4>
                      <p className="text-[10px] font-black text-indigo-600 mt-0.5">{fav.item.price} ₽</p>
                      <span className="text-[9px] font-semibold text-slate-400">Магазин: {fav.business.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => removeFavorite(fav.businessId, fav.itemId)}
                        className="grid h-8 w-8 place-items-center rounded-xl bg-slate-50 text-rose-600 hover:bg-rose-50 transition"
                      >
                        <Heart size={14} fill="currentColor" />
                      </button>
                      <Link
                        href={`/app/${fav.business.slug}`}
                        className="grid h-8 w-8 place-items-center rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition"
                      >
                        <Eye size={14} />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
