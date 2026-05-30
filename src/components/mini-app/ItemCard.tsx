"use client";

import React from "react";
import { Item } from "@/types";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ItemCardProps {
  item: Item;
  onAddToCart?: (item: Item) => void;
  onViewDetails?: (item: Item) => void;
  primaryColor?: string;
  accentColor?: string;
}

function getPlaceholderIcon(itemName: string, categoryName?: string | null, type?: string): string {
  const name = (itemName + " " + (categoryName || "")).toLowerCase();
  if (type === "SERVICE") {
    if (name.includes("стриж") || name.includes("волос") || name.includes("барбер") || name.includes("бород")) return "✂️";
    if (name.includes("мойн") || name.includes("химчист") || name.includes("машин") || name.includes("авто")) return "🧼";
    if (name.includes("массаж") || name.includes("спа")) return "💆‍♀️";
    if (name.includes("урок") || name.includes("курс") || name.includes("обучен")) return "📚";
    return "🛠️";
  } else {
    if (name.includes("кофе") || name.includes("чай") || name.includes("напиток") || name.includes("латте")) return "☕";
    if (name.includes("пицц") || name.includes("бургер") || name.includes("еда") || name.includes("сендвич")) return "🍔";
    if (name.includes("плать") || name.includes("одежд") || name.includes("обувь") || name.includes("футболк")) return "👗";
    if (name.includes("хлеб") || name.includes("яблок") || name.includes("фрукт") || name.includes("овощ")) return "🍎";
    if (name.includes("инструмент") || name.includes("болт") || name.includes("пила")) return "🔧";
    return "📦";
  }
}

export function ItemCard({
  item,
  onAddToCart,
  onViewDetails,
  primaryColor = "#3B82F6",
  accentColor = "#FF6347",
}: ItemCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs hover:shadow-sm transition duration-200 flex flex-col justify-between h-full">
      <div>
        {/* Image / Placeholder */}
        <div className={`relative w-full ${item.imageUrl ? "h-28" : "h-16"} bg-gradient-to-tr from-slate-50 to-slate-100 border-b border-slate-100 flex items-center justify-center overflow-hidden transition-all duration-200`}>
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center select-none text-slate-400">
              <span className="text-3xl mb-1 filter drop-shadow-xs">
                {getPlaceholderIcon(item.name, item.category?.name, item.type)}
              </span>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                {item.type === "SERVICE" ? "Услуга" : "Товар"}
              </span>
            </div>
          )}
          
          {item.isPopular && (
            <div
              className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black text-white shadow-xs"
              style={{ backgroundColor: accentColor }}
            >
              ⭐ Топ
            </div>
          )}
          {item.oldPrice && (
            <div
              className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black text-white shadow-xs"
              style={{ backgroundColor: accentColor }}
            >
              % Скидка
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 pb-2">
          <h3 className="font-extrabold text-xs text-slate-900 line-clamp-2 min-h-8 mb-1 leading-snug">{item.name}</h3>

          {item.description && (
            <p className="text-[10px] font-semibold text-slate-400 line-clamp-2 min-h-6 mb-2 leading-relaxed">
              {item.description}
            </p>
          )}

          {/* Duration for services */}
          {item.durationMinutes && (
            <p className="text-[9px] font-bold text-slate-500 mb-2 flex items-center gap-1">
              ⏱️ {item.durationMinutes} мин
            </p>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="font-black text-xs" style={{ color: primaryColor }}>
              {formatPrice(item.price, "RUB")}
            </span>
            {item.oldPrice && (
              <span className="text-[10px] text-slate-450 line-through font-semibold">
                {formatPrice(item.oldPrice, "RUB")}
              </span>
            )}
          </div>

          {/* Stock */}
          {item.stock !== null && (
            <p className="text-[9px] font-bold text-slate-500 mb-2">
              Осталось: {item.stock} шт
            </p>
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="p-3 pt-0 flex gap-1.5">
        {onAddToCart && (
          <Button
            onClick={() => onAddToCart(item)}
            size="sm"
            className="flex-1 text-[10px] font-black rounded-xl py-2 text-white transition active:scale-[0.97]"
            style={{
              backgroundColor: primaryColor,
            }}
          >
            Купить
          </Button>
        )}
        {onViewDetails && (
          <Button
            onClick={() => onViewDetails(item)}
            variant="outline"
            size="sm"
            className="flex-1 text-[10px] font-black rounded-xl py-2 transition active:scale-[0.97]"
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
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="w-full h-40 bg-muted animate-pulse" />
      <div className="p-3">
        <div className="h-4 bg-muted rounded animate-pulse mb-2" />
        <div className="h-3 bg-muted rounded animate-pulse mb-3" />
        <div className="h-3 bg-muted rounded animate-pulse w-1/2 mb-3" />
        <div className="flex gap-2">
          <div className="h-9 bg-muted rounded animate-pulse flex-1" />
          <div className="h-9 bg-muted rounded animate-pulse flex-1" />
        </div>
      </div>
    </div>
  );
}
