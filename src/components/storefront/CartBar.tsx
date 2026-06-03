import { Minus, Plus, ShoppingBag } from "lucide-react";
import type { StorefrontCartLine } from "./types";

type CartBarProps = {
  cart: StorefrontCartLine[];
  cartCount: number;
  cartTotal: number;
  cartPulse: boolean;
  formatPrice: (value: number) => string;
  onQuantityChange: (itemId: string, delta: number) => void;
  onCheckout: () => void;
};

export function CartBar({
  cart,
  cartCount,
  cartTotal,
  cartPulse,
  formatPrice,
  onQuantityChange,
  onCheckout,
}: CartBarProps) {
  if (cartCount <= 0) return null;

  return (
    <div className={`fixed inset-x-0 bottom-0 mx-auto max-w-3xl bg-white/95 p-4 shadow-2xl backdrop-blur ${cartPulse ? "animate-cart-bump" : ""}`}>
      <div className="mb-3 space-y-2">
        {cart.map((line) => (
          <div key={line.item.id} className="flex items-center justify-between text-sm">
            <span className="font-bold">{line.item.name}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onQuantityChange(line.item.id, -1)}
                className="grid h-7 w-7 place-items-center rounded-full bg-slate-100"
              >
                <Minus size={14} />
              </button>
              <span className="w-5 text-center font-black">{line.quantity}</span>
              <button
                type="button"
                onClick={() => onQuantityChange(line.item.id, 1)}
                className="grid h-7 w-7 place-items-center rounded-full bg-slate-100"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onCheckout}
        className="flex w-full items-center justify-between rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ShoppingBag size={18} /> Корзина · {cartCount} товаров
        </span>
        <span>{formatPrice(cartTotal)}</span>
      </button>
    </div>
  );
}

