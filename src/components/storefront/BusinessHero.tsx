"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Heart, Send } from "lucide-react";
import type { StorefrontBusiness } from "./types";
import { buildTelegramStartAppUrl } from "@/lib/business-share-links";

type BusinessHeroProps = {
  business: StorefrontBusiness;
  title: string;
  accent: string;
  isFavorite: boolean;
  onFavoriteToggle: () => void;
};

export function BusinessHero({
  business,
  title,
  accent,
  isFavorite,
  onFavoriteToggle,
}: BusinessHeroProps) {
  const [showTelegramLink, setShowTelegramLink] = useState(false);
  const telegramUrl = useMemo(() => buildTelegramStartAppUrl(business.slug), [business.slug]);

  useEffect(() => {
    setShowTelegramLink(!Boolean((window as any).Telegram?.WebApp?.initData));
  }, []);

  return (
    <section className={`relative min-h-[340px] overflow-hidden bg-gradient-to-br ${accent} px-4 pb-8 pt-5 text-white`}>
      {business.coverImageUrl && (
        <>
          <img
            src={business.coverImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-slate-950/55" />
        </>
      )}

      <div className="relative mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between">
          <Link href="/app" className="grid h-10 w-10 place-items-center rounded-full bg-white/15">
            <ArrowLeft size={18} />
          </Link>
          <button
            type="button"
            onClick={onFavoriteToggle}
            className={`grid h-10 w-10 place-items-center rounded-full transition active:scale-95 ${
              isFavorite ? "bg-rose-500 text-white" : "bg-white/15 text-white"
            }`}
            aria-label={isFavorite ? "Удалить бизнес из избранного" : "Добавить бизнес в избранное"}
          >
            <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="rounded-[28px] bg-black/20 p-5 backdrop-blur">
          {business.logoUrl && (
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-white/90 p-1.5 ring-2 ring-white/70">
              <img src={business.logoUrl} alt={business.name} className="h-full w-full object-cover" />
            </div>
          )}
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">{title}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">{business.name}</h1>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/75">{business.description}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-white/15 px-3 py-1">
              {business.reviewCount && business.rating
                ? `★ ${business.rating.toFixed(1)} (${business.reviewCount})`
                : "Нет оценок"}
            </span>
            <span className={`rounded-full px-3 py-1 ${business.isOpen !== false ? "bg-emerald-400 text-emerald-950" : "bg-white/15 text-white"}`}>
              {business.isOpen !== false ? "Открыт" : "Закрыт"}
            </span>
            {business.address && <span className="rounded-full bg-white/15 px-3 py-1">{business.address}</span>}
          </div>
          {showTelegramLink && telegramUrl && (
            <a
              href={telegramUrl}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
            >
              <Send size={16} />
              Открыть в Telegram
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
