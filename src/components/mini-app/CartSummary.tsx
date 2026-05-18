"use client";

import React from "react";
import { CartItem } from "@/types";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CartSummaryProps {
  items: CartItem[];
  onQuantityChange?: (itemId: string, quantity: number) => void;
  onRemove?: (itemId: string) => void;
  currency?: string;
  accentColor?: string;
}

export function CartSummary({
  items,
  onQuantityChange,
  onRemove,
  currency = "RUB",
  accentColor = "#FF6347",
}: CartSummaryProps) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-2">🛒</div>
        <p className="text-lg font-semibold mb-2">Корзина пуста</p>
        <p className="text-muted-foreground text-sm">
          Добавьте товары из каталога
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div
          key={item.itemId}
          className="flex gap-3 p-3 bg-white rounded-lg border"
        >
          {item.image && (
            <img
              src={item.image}
              alt={item.name}
              className="w-20 h-20 rounded-lg object-cover"
            />
          )}

          <div className="flex-1">
            <h4 className="font-semibold text-sm">{item.name}</h4>
            <p className="text-sm font-bold" style={{ color: accentColor }}>
              {formatPrice(item.price, currency)}
            </p>

            {onQuantityChange && (
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() =>
                    onQuantityChange(item.itemId, item.quantity - 1)
                  }
                  className="w-6 h-6 rounded border flex items-center justify-center text-sm"
                >
                  −
                </button>
                <span className="w-6 text-center font-semibold">
                  {item.quantity}
                </span>
                <button
                  onClick={() =>
                    onQuantityChange(item.itemId, item.quantity + 1)
                  }
                  className="w-6 h-6 rounded border flex items-center justify-center text-sm"
                >
                  +
                </button>
              </div>
            )}
          </div>

          {onRemove && (
            <button
              onClick={() => onRemove(item.itemId)}
              className="text-muted-foreground hover:text-destructive transition"
            >
              ✕
            </button>
          )}
        </div>
      ))}

      {/* Total */}
      <div className="sticky bottom-0 bg-white border-t p-4 rounded-t-lg">
        <div className="flex justify-between mb-3">
          <span className="font-semibold">Итого:</span>
          <span className="text-lg font-bold" style={{ color: accentColor }}>
            {formatPrice(total, currency)}
          </span>
        </div>
      </div>
    </div>
  );
}
