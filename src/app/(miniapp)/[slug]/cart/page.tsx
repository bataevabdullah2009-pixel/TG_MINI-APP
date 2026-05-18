"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCartStore } from "@/store/cartStore";
import { CartSummary } from "@/components/mini-app/CartSummary";
import { Button } from "@/components/ui/button";
import { Business, CartItem } from "@/types";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";

export default function CartPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const cartItems = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clear);

  const [business, setBusiness] = useState<Business | null>(null);

  useEffect(() => {
    async function fetchBusiness() {
      try {
        const res = await apiClient.get(`/businesses/${slug}`);
        setBusiness(res.data);
      } catch (error) {
        console.error("Error fetching business:", error);
      }
    }

    fetchBusiness();
  }, [slug]);

  const total = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const handleCheckout = () => {
    router.push(`/${slug}/checkout`);
  };

  if (!business) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen pb-32 bg-background">
      <div className="p-4 bg-white border-b sticky top-0 z-10">
        <h1 className="text-2xl font-bold">Корзина</h1>
      </div>

      <div className="p-4">
        <CartSummary
          items={cartItems}
          onQuantityChange={updateQuantity}
          onRemove={removeItem}
          currency={business.currency}
          accentColor={business.accentColor}
        />

        {cartItems.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
            <Button
              onClick={handleCheckout}
              className="w-full py-6"
              style={{ backgroundColor: business.primaryColor }}
            >
              Оформить заказ ({cartItems.length})
            </Button>
            <button
              onClick={() => clearCart()}
              className="w-full mt-2 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Очистить корзину
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
