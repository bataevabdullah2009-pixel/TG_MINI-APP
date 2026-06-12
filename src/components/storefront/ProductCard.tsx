import { Heart, Package, Star } from "lucide-react";
import type { StorefrontItem, StorefrontMode, StorefrontViewMode } from "./types";

type ProductCardProps = {
  item: StorefrontItem;
  viewMode: StorefrontViewMode;
  mode: StorefrontMode;
  cta: string;
  primaryColor: string;
  isFavorite: boolean;
  formatPrice: (value: number) => string;
  onPreview: (item: StorefrontItem) => void;
  onAction: (item: StorefrontItem) => void;
  onFavoriteToggle: (itemId: string) => void;
};

export function ProductCard({
  item,
  viewMode,
  mode,
  cta,
  primaryColor,
  isFavorite,
  formatPrice,
  onPreview,
  onAction,
  onFavoriteToggle,
}: ProductCardProps) {
  const isGrid = viewMode === "grid";
  const isUnavailable = item.isAvailable === false || (item.stockMode === "TRACK_STOCK" && (item.stock ?? 0) <= 0);

  return (
    <article className={`${isGrid ? "min-h-[292px] rounded-2xl" : "rounded-3xl"} flex h-full min-w-0 flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200/70`}>
      <div className={`${isGrid ? "aspect-square" : "aspect-[4/3]"} shrink-0 overflow-hidden bg-slate-100`}>
        {item.imageUrl ? (
          <button
            type="button"
            onClick={() => onPreview(item)}
            className="block h-full w-full"
            aria-label={item.name}
          >
            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
          </button>
        ) : (
          <div className="grid h-full place-items-center bg-slate-50 text-slate-400">
            <div className="flex flex-col items-center gap-1 text-[10px] font-black uppercase tracking-wider">
              <Package size={isGrid ? 26 : 34} strokeWidth={1.8} />
              {item.type === "SERVICE" ? "Услуга" : "Товар"}
            </div>
          </div>
        )}
      </div>

      <div className={isGrid ? "flex min-h-0 flex-1 flex-col p-3" : "flex flex-1 items-start justify-between gap-4 p-4"}>
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <h3 className={`${isGrid ? "text-sm leading-tight" : ""} line-clamp-2 font-black`}>{item.name}</h3>
            {item.isPopular && <Star size={14} className="shrink-0 text-amber-500" fill="currentColor" />}
          </div>
          <p className={`${isGrid ? "text-xs leading-4" : "text-sm"} line-clamp-2 text-slate-500`}>{item.description}</p>
          {item.durationMinutes && <p className="mt-1 text-xs font-bold text-slate-400">{item.durationMinutes} мин.</p>}
        </div>
        <div className={isGrid ? "mt-auto pt-2" : "text-right"}>
          <p className={`${isGrid ? "text-sm" : ""} whitespace-nowrap font-black`}>{formatPrice(item.price)}</p>
        </div>
      </div>

      <div className={`${isGrid ? "px-3 pb-3" : "px-4 pb-4"} mt-auto flex items-center justify-between gap-2`}>
        <button
          type="button"
          onClick={() => !isUnavailable && onAction(item)}
          disabled={isUnavailable}
          className={`${isGrid ? "px-2 text-[11px]" : "px-4 text-sm"} min-w-0 flex-1 truncate rounded-full py-2 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300`}
          style={isUnavailable ? undefined : { backgroundColor: primaryColor }}
        >
          {isUnavailable ? "Нет в наличии" : cta}
        </button>
        <button
          type="button"
          onClick={() => onFavoriteToggle(item.id)}
          className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition active:scale-95 ${
            isFavorite ? "border-rose-200 bg-rose-50 text-rose-600" : "border-slate-200 text-slate-500"
          }`}
          aria-label={isFavorite ? "Удалить товар из избранного" : "Добавить товар в избранное"}
        >
          <span className="flex items-center gap-1.5">
            <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
            {viewMode === "grid" ? "" : "Избранное"}
          </span>
        </button>
      </div>
    </article>
  );
}
