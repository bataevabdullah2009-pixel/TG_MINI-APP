"use client";

import React from "react";
import { Package } from "lucide-react";
import { Item } from "@/types";
import { cn, formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ItemCardProps {
  item: Item;
  onAddToCart?: (item: Item) => void;
  onViewDetails?: (item: Item) => void;
  onImageClick?: (item: Item) => void;
  primaryColor?: string;
  accentColor?: string;
  layout?: "feed" | "grid";
}

function placeholderLabel(type?: string) {
  return type === "SERVICE" ? "Услуга" : "Товар";
}

export function ItemCard({
  item,
  onAddToCart,
  onViewDetails,
  onImageClick,
  primaryColor = "#3B82F6",
  accentColor = "#FF6347",
  layout = "grid",
}: ItemCardProps) {
  const isFeed = layout === "feed";
  const isOutOfStock = item.type === "PRODUCT" && item.stock === 0;

  const image = item.imageUrl ? (
    <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
  ) : (
    <div className="flex h-full w-full flex-col items-center justify-center bg-slate-50 text-slate-400">
      <Package size={isFeed ? 22 : 28} strokeWidth={1.8} />
      <span className="mt-1 text-[8px] font-black uppercase tracking-widest">
        {placeholderLabel(item.type)}
      </span>
    </div>
  );

  return (
    <div
      className={cn(
        "h-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xs transition duration-200 hover:shadow-sm",
        isFeed ? "flex gap-3 p-2.5" : "flex flex-col justify-between"
      )}
    >
      <div className={cn(isFeed ? "flex min-w-0 flex-1 gap-3" : "")}>
        <div
          className={cn(
            "relative flex shrink-0 items-center justify-center overflow-hidden bg-slate-50",
            isFeed ? "h-24 w-24 rounded-xl border border-slate-100" : "aspect-[4/3] w-full border-b border-slate-100"
          )}
        >
          {item.imageUrl && onImageClick ? (
            <button
              type="button"
              onClick={() => onImageClick(item)}
              className="block h-full w-full"
              aria-label={item.name}
            >
              {image}
            </button>
          ) : (
            image
          )}

          {item.isPopular && (
            <div
              className="absolute right-1.5 top-1.5 rounded-lg px-2 py-0.5 text-[9px] font-black text-white shadow-xs"
              style={{ backgroundColor: accentColor }}
            >
              Топ
            </div>
          )}
          {item.oldPrice && (
            <div
              className="absolute left-1.5 top-1.5 rounded-lg px-2 py-0.5 text-[9px] font-black text-white shadow-xs"
              style={{ backgroundColor: accentColor }}
            >
              %
            </div>
          )}
        </div>

        <div className={cn("min-w-0", isFeed ? "flex-1 py-0.5" : "p-3 pb-2")}>
          <h3 className="mb-1 min-h-8 text-xs font-extrabold leading-snug text-slate-900 line-clamp-2">
            {item.name}
          </h3>

          {item.description && (
            <p className="mb-2 min-h-6 text-[10px] font-semibold leading-relaxed text-slate-400 line-clamp-2">
              {item.description}
            </p>
          )}

          {item.durationMinutes && (
            <p className="mb-2 flex items-center gap-1 text-[9px] font-bold text-slate-500">
              {item.durationMinutes} мин
            </p>
          )}

          <div className="mb-2 flex min-w-0 flex-wrap items-baseline gap-1.5">
            <span className="text-xs font-black" style={{ color: primaryColor }}>
              {formatPrice(item.price, "RUB")}
            </span>
            {item.oldPrice && (
              <span className="text-[10px] font-semibold text-slate-400 line-through">
                {formatPrice(item.oldPrice, "RUB")}
              </span>
            )}
          </div>

          {item.stock !== null && item.stock !== undefined && (
            <p className={`mb-2 text-[9px] font-bold ${isOutOfStock ? "text-rose-600" : "text-slate-500"}`}>
              {isOutOfStock ? "Нет в наличии" : `Осталось: ${item.stock} шт`}
            </p>
          )}
        </div>
      </div>

      <div className={cn("flex gap-1.5", isFeed ? "w-24 shrink-0 flex-col justify-end" : "p-3 pt-0")}>
        {onAddToCart && (
          <Button
            onClick={() => onAddToCart(item)}
            disabled={isOutOfStock}
            size="sm"
            className="flex-1 rounded-xl py-2 text-[10px] font-black text-white transition active:scale-[0.97] disabled:bg-slate-300"
            style={isOutOfStock ? undefined : { backgroundColor: primaryColor }}
          >
            {isOutOfStock ? "Нет в наличии" : "Купить"}
          </Button>
        )}
        {onViewDetails && (
          <Button
            onClick={() => onViewDetails(item)}
            variant="outline"
            size="sm"
            className="flex-1 rounded-xl py-2 text-[10px] font-black transition active:scale-[0.97]"
          >
            Инфо
          </Button>
        )}
      </div>
    </div>
  );
}

export function ItemCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="aspect-[4/3] w-full animate-pulse bg-muted" />
      <div className="p-3">
        <div className="mb-2 h-4 animate-pulse rounded bg-muted" />
        <div className="mb-3 h-3 animate-pulse rounded bg-muted" />
        <div className="mb-3 h-3 w-1/2 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-9 flex-1 animate-pulse rounded bg-muted" />
          <div className="h-9 flex-1 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
