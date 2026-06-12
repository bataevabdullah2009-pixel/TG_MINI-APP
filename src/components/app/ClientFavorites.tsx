"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store, Heart, ShoppingBag, Eye } from "lucide-react";
import { miniAppFetch } from "@/lib/miniAppFetch";

interface ClientFavoritesProps {
  telegramUserId?: string;
}

export function ClientFavorites({ telegramUserId }: ClientFavoritesProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"SHOPS" | "ITEMS">("SHOPS");
  const [data, setData] = useState<{ favoriteBusinesses: any[]; favoriteItems: any[] }>({
    favoriteBusinesses: [],
    favoriteItems: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!telegramUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    Promise.all([
      miniAppFetch(`/api/favorites/business?telegramUserId=${encodeURIComponent(telegramUserId)}`).then((res) => res.json()),
      miniAppFetch(`/api/favorites/product?telegramUserId=${encodeURIComponent(telegramUserId)}`).then((res) => res.json()),
    ])
      .then(([businessRes, productRes]) => {
        if (!businessRes.ok) {
          setError(businessRes.error || "Не удалось загрузить избранные заведения");
          return;
        }
        if (!productRes.ok) {
          setError(productRes.error || "Не удалось загрузить избранные товары");
          return;
        }

        setData({
          favoriteBusinesses: businessRes.data?.favoriteBusinesses || [],
          favoriteItems: productRes.data?.favoriteProducts || productRes.data?.favoriteItems || [],
        });
      })
      .catch((e) => {
        console.error(e);
        setError("Ошибка связи с сервером");
      })
      .finally(() => setLoading(false));
  }, [telegramUserId]);

  const removeFavorite = async (businessId: string, itemId?: string) => {
    if (!telegramUserId) return;

    const previous = data;
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

    try {
      const res = await miniAppFetch(itemId ? "/api/favorites/product" : "/api/favorites/business", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId,
          ...(itemId ? { productId: itemId } : { businessId }),
        }),
      });
      const resData = await res.json().catch(() => ({}));

      if (!res.ok || resData.ok === false) {
        throw new Error(resData.error || "Не удалось обновить избранное");
      }
    } catch (e) {
      console.error(e);
      setData(previous);
      setError("Не удалось обновить избранное. Попробуйте ещё раз.");
      setTimeout(() => setError(null), 4000);
    }
  };

  const openFavoriteProduct = (fav: any) => {
    const businessTarget = fav.business?.slug || fav.businessId;
    const productId = fav.item?.id || fav.itemId;

    if (!businessTarget || !productId) {
      setError("Не удалось открыть товар: магазин или товар не найден.");
      setTimeout(() => setError(null), 4000);
      return;
    }

    router.push(`/app/${encodeURIComponent(businessTarget)}?product=${encodeURIComponent(productId)}`);
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
        <div className="grid animate-pulse gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 rounded-3xl bg-white ring-1 ring-slate-100" />
          ))}
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
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-xl p-1 text-lg font-black text-white"
                      style={{
                        background: `linear-gradient(135deg, ${fav.business?.primaryColor || "#64748b"}, ${fav.business?.accentColor || "#94a3b8"})`,
                      }}
                    >
                      {fav.business?.logoUrl ? (
                        <img
                          src={fav.business.logoUrl}
                          alt={fav.business.name || "Магазин"}
                          className="h-full w-full rounded-lg bg-white/90 object-contain"
                        />
                      ) : (
                        fav.business?.name?.[0] || "?"
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-extrabold text-slate-900">{fav.business?.name || "Недоступно"}</h4>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                        {fav.business?.isActive === false ? "Недоступно" : `📍 ${fav.business?.address || "Адрес не указан"}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => removeFavorite(fav.businessId)}
                        className="grid h-8 w-8 place-items-center rounded-xl bg-slate-50 text-rose-600 hover:bg-rose-50 transition"
                      >
                        <Heart size={14} fill="currentColor" />
                      </button>
                      {fav.business?.slug && fav.business?.isActive !== false ? (
                        <Link
                          href={`/app/${fav.business.slug}`}
                          className="grid h-8 w-8 place-items-center rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition"
                        >
                          <Eye size={14} />
                        </Link>
                      ) : (
                        <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-400">
                          <Eye size={14} />
                        </span>
                      )}
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
                    onClick={() => openFavoriteProduct(fav)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openFavoriteProduct(fav);
                      }
                    }}
                    className="flex min-h-[92px] cursor-pointer items-center gap-3.5 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-100 transition active:scale-[0.99]"
                  >
                    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-50 border text-slate-400 text-xl font-bold">
                      {fav.item?.imageUrl ? (
                        <img src={fav.item.imageUrl} alt={fav.item.name || "Товар"} className="h-full w-full object-cover" />
                      ) : "📦"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="line-clamp-2 text-sm font-extrabold leading-tight text-slate-900">{fav.item?.name || "Товар"}</h4>
                      <p className="mt-1 truncate text-[10px] font-black text-indigo-600">
                        {typeof fav.item?.price === "number" ? `${fav.item.price} ₽` : "Цена уточняется"}
                      </p>
                      <span className="block truncate text-[9px] font-semibold text-slate-400">Магазин: {fav.business?.name || fav.businessId || "не указан"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          removeFavorite(fav.businessId, fav.itemId);
                        }}
                        className="grid h-8 w-8 place-items-center rounded-xl bg-slate-50 text-rose-600 hover:bg-rose-50 transition"
                      >
                        <Heart size={14} fill="currentColor" />
                      </button>
                      {fav.business?.slug || fav.businessId ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openFavoriteProduct(fav);
                          }}
                          className="grid h-8 w-8 place-items-center rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition"
                        >
                          <Eye size={14} />
                        </button>
                      ) : (
                        <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-400">
                          <Eye size={14} />
                        </span>
                      )}
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
