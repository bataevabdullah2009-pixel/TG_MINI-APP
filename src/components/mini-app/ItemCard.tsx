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

export function ItemCard({
  item,
  onAddToCart,
  onViewDetails,
  primaryColor = "#3B82F6",
  accentColor = "#FF6347",
}: ItemCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Image */}
      {item.imageUrl && (
        <div className="relative w-full h-40 bg-muted overflow-hidden">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
          {item.isPopular && (
            <div
              className="absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: accentColor }}
            >
              ⭐ Популярное
            </div>
          )}
          {item.oldPrice && (
            <div
              className="absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: accentColor }}
            >
              Скидка
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        <h3 className="font-semibold text-sm line-clamp-2 mb-1">{item.name}</h3>

        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {item.description}
          </p>
        )}

        {/* Duration for services */}
        {item.durationMinutes && (
          <p className="text-xs text-muted-foreground mb-2">
            ⏱️ {item.durationMinutes} мин
          </p>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="font-bold" style={{ color: primaryColor }}>
            {formatPrice(item.price, "RUB")}
          </span>
          {item.oldPrice && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(item.oldPrice, "RUB")}
            </span>
          )}
        </div>

        {/* Stock */}
        {item.stock !== null && (
          <p className="text-xs text-muted-foreground mb-2">
            Осталось: {item.stock}
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          {onAddToCart && (
            <Button
              onClick={() => onAddToCart(item)}
              size="sm"
              className="flex-1"
              style={{
                backgroundColor: primaryColor,
              }}
            >
              Добавить
            </Button>
          )}
          {onViewDetails && (
            <Button
              onClick={() => onViewDetails(item)}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              Подробнее
            </Button>
          )}
        </div>
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
