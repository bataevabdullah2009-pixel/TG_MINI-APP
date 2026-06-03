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
  return (
    <article className="h-full overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200/70">
      <div className={`${viewMode === "grid" ? "aspect-square" : "aspect-[4/3]"} bg-slate-100`}>
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
              <Package size={viewMode === "grid" ? 26 : 34} strokeWidth={1.8} />
              {item.type === "SERVICE" ? "Услуга" : "Товар"}
            </div>
          </div>
        )}
      </div>

      <div className={viewMode === "grid" ? "p-3" : "flex items-start justify-between gap-4 p-4"}>
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="font-black line-clamp-2">{item.name}</h3>
            {item.isPopular && <Star size={14} className="text-amber-500" fill="currentColor" />}
          </div>
          <p className="line-clamp-2 text-sm text-slate-500">{item.description}</p>
          {item.durationMinutes && <p className="mt-1 text-xs font-bold text-slate-400">{item.durationMinutes} мин.</p>}
        </div>
        <div className={viewMode === "grid" ? "mt-2" : "text-right"}>
          <p className="whitespace-nowrap font-black">{formatPrice(item.price)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-4 pb-4">
        <button
          type="button"
          onClick={() => onAction(item)}
          className="min-w-0 flex-1 rounded-full px-4 py-2 text-sm font-bold text-white"
          style={{ backgroundColor: primaryColor }}
        >
          {cta}
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
