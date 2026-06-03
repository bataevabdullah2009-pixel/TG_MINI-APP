import { Package } from "lucide-react";
import { ProductCard } from "./ProductCard";
import type { StorefrontItem, StorefrontMode, StorefrontViewMode } from "./types";

type ProductGridProps = {
  items: StorefrontItem[];
  viewMode: StorefrontViewMode;
  mode: StorefrontMode;
  cta: string;
  primaryColor: string;
  favoriteProductIds: string[];
  formatPrice: (value: number) => string;
  onPreview: (item: StorefrontItem) => void;
  onAction: (item: StorefrontItem) => void;
  onFavoriteToggle: (itemId: string) => void;
};

export function ProductGrid({
  items,
  viewMode,
  mode,
  cta,
  primaryColor,
  favoriteProductIds,
  formatPrice,
  onPreview,
  onAction,
  onFavoriteToggle,
}: ProductGridProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200/70">
        <Package className="mx-auto mb-3 text-slate-300" size={42} />
        <h3 className="font-black text-slate-800">Ничего не найдено</h3>
        <p className="mt-1 text-xs font-semibold text-slate-400">Попробуйте изменить поиск или категорию.</p>
      </div>
    );
  }

  return (
    <div className={viewMode === "grid" ? "grid grid-cols-2 gap-3" : "grid gap-3"}>
      {items.map((item) => (
        <ProductCard
          key={item.id}
          item={item}
          viewMode={viewMode}
          mode={mode}
          cta={cta}
          primaryColor={primaryColor}
          isFavorite={favoriteProductIds.includes(item.id)}
          formatPrice={formatPrice}
          onPreview={onPreview}
          onAction={onAction}
          onFavoriteToggle={onFavoriteToggle}
        />
      ))}
    </div>
  );
}

