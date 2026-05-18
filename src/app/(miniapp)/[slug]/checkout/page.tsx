"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCartStore } from "@/store/cartStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Business } from "@/types";
import { apiClient } from "@/lib/api-client";
import { formatPrice } from "@/lib/utils";
import { useTelegram } from "@/hooks/useTelegram";
import Link from "next/link";

const CheckoutSchema = z.object({
  customerName: z.string().min(2, "Введите имя (мин. 2 символа)"),
  customerPhone: z.string().min(10, "Введите корректный номер телефона"),
  customerAddress: z.string().optional(),
  deliveryType: z.enum(["DELIVERY", "PICKUP"]),
  comment: z.string().optional(),
  paymentMethod: z.enum(["CASH", "TRANSFER"]),
});

type CheckoutInput = z.infer<typeof CheckoutSchema>;

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const tg = useTelegram();

  const cartItems = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clear);

  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CheckoutInput>({
    resolver: zodResolver(CheckoutSchema),
    defaultValues: {
      deliveryType: "PICKUP",
      paymentMethod: "CASH",
    },
  });

  const deliveryType = watch("deliveryType");

  useEffect(() => {
    async function fetchBusiness() {
      try {
        const res = await apiClient.get(`/businesses/${slug}`);
        setBusiness(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchBusiness();
  }, [slug]);

  // Prefill name from Telegram if available
  useEffect(() => {
    if (tg?.initDataUnsafe?.user) {
      const user = tg.initDataUnsafe.user;
      const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
      if (name) setValue("customerName", name);
    }
  }, [tg, setValue]);

  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const onSubmit = async (data: CheckoutInput) => {
    if (!business) return;
    if (cartItems.length === 0) {
      setError("Корзина пуста");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const orderData = {
        businessId: business.id,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerAddress: data.customerAddress,
        items: cartItems.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          price: item.price,
          name: item.name,
        })),
        deliveryType: data.deliveryType,
        comment: data.comment,
      };

      const res = await apiClient.post("/orders", orderData);
      const order = res.data;

      clearCart();

      // Close Telegram web app or navigate to order status
      if (tg) {
        tg.showAlert(`✅ Заказ #${order.id?.slice(-6).toUpperCase()} оформлен!`);
      }

      router.push(`/${slug}/orders/${order.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Ошибка оформления заказа");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Бизнес не найден</p>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🛒</div>
          <h2 className="text-xl font-bold mb-2">Корзина пуста</h2>
          <p className="text-muted-foreground mb-6">Добавьте товары перед оформлением</p>
          <Link href={`/${slug}/catalog`}>
            <Button style={{ backgroundColor: business.primaryColor }}>
              Перейти в каталог
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-40">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => router.back()} className="text-xl">
            ←
          </button>
          <h1 className="text-lg font-bold flex-1">Оформление заказа</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-5">
        {/* Order Summary */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h2 className="font-bold mb-3">📦 Ваш заказ</h2>
          <div className="space-y-2">
            {cartItems.map((item) => (
              <div key={item.itemId} className="flex justify-between items-center text-sm">
                <span className="flex-1 line-clamp-1">
                  {item.name} × {item.quantity}
                </span>
                <span className="font-semibold ml-2">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>Итого:</span>
              <span style={{ color: business.primaryColor }}>
                {formatPrice(total)}
              </span>
            </div>
          </div>
        </div>

        {/* Delivery Type */}
        <div>
          <h2 className="font-bold mb-3">🚚 Способ получения</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "PICKUP" as const, label: "🏪 Самовывоз", desc: "Заберу сам" },
              { value: "DELIVERY" as const, label: "🚚 Доставка", desc: "На адрес" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setValue("deliveryType", option.value)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  deliveryType === option.value
                    ? "border-current"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                style={{
                  borderColor: deliveryType === option.value ? business.primaryColor : undefined,
                  backgroundColor:
                    deliveryType === option.value
                      ? `${business.primaryColor}10`
                      : undefined,
                }}
              >
                <div className="font-semibold text-sm">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Contact Info */}
        <div>
          <h2 className="font-bold mb-3">👤 Контактные данные</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Имя *</label>
              <Input
                {...register("customerName")}
                placeholder="Иван Иванов"
                className={errors.customerName ? "border-red-500" : ""}
              />
              {errors.customerName && (
                <p className="text-red-500 text-xs mt-1">{errors.customerName.message}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Телефон *</label>
              <Input
                {...register("customerPhone")}
                type="tel"
                placeholder="+7 (999) 000-00-00"
                className={errors.customerPhone ? "border-red-500" : ""}
              />
              {errors.customerPhone && (
                <p className="text-red-500 text-xs mt-1">{errors.customerPhone.message}</p>
              )}
            </div>

            {deliveryType === "DELIVERY" && (
              <div>
                <label className="text-sm font-medium mb-1 block">Адрес доставки *</label>
                <Input
                  {...register("customerAddress")}
                  placeholder="ул. Примерная, д. 1, кв. 10"
                />
              </div>
            )}
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <h2 className="font-bold mb-3">💳 Способ оплаты</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "CASH" as const, label: "💵 Наличные" },
              { value: "TRANSFER" as const, label: "📱 Перевод" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setValue("paymentMethod", option.value)}
                className={`p-3 rounded-xl border-2 text-center font-medium text-sm transition-all ${
                  watch("paymentMethod") === option.value
                    ? "text-white"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                style={{
                  backgroundColor:
                    watch("paymentMethod") === option.value
                      ? business.primaryColor
                      : undefined,
                  borderColor:
                    watch("paymentMethod") === option.value
                      ? business.primaryColor
                      : undefined,
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div>
          <h2 className="font-bold mb-3">💬 Комментарий</h2>
          <textarea
            {...register("comment")}
            placeholder="Уточнения к заказу, пожелания..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-700 text-sm">⚠️ {error}</p>
          </div>
        )}
      </form>

      {/* Fixed Bottom Submit */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 max-w-md mx-auto">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-muted-foreground">
            {cartItems.length} поз. · {deliveryType === "DELIVERY" ? "Доставка" : "Самовывоз"}
          </span>
          <span className="font-bold text-lg" style={{ color: business.primaryColor }}>
            {formatPrice(total)}
          </span>
        </div>
        <Button
          onClick={handleSubmit(onSubmit)}
          disabled={submitting}
          className="w-full py-6 text-base font-bold"
          style={{ backgroundColor: business.primaryColor }}
        >
          {submitting ? "⏳ Оформляем..." : "✅ Оформить заказ"}
        </Button>
      </div>
    </div>
  );
}
