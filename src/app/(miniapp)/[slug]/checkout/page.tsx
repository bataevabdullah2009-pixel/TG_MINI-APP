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
import { PhoneVerificationScreen } from "@/components/app/PhoneVerificationScreen";
import { User, Phone, MapPin, CreditCard, MessageSquare, ShieldCheck, ShieldAlert } from "lucide-react";

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
  const { tg, user } = useTelegram();

  const cartItems = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clear);

  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Verification states
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

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
      customerName: "",
      customerPhone: "",
    },
  });

  const deliveryType = watch("deliveryType");
  const customerName = watch("customerName");

  const fetchProfileAndBusiness = async () => {
    try {
      setLoading(true);
      // 1. Fetch business
      const bizRes = await apiClient.get(`/businesses/${slug}`);
      const biz = bizRes.data;
      setBusiness(biz);

      // 2. Fetch customer profile
      const initData = typeof window !== "undefined" ? (window as any).Telegram?.WebApp?.initData : "";
      if (initData) {
        const profileRes = await fetch(`/api/customer/profile?businessSlug=${slug}`, {
          headers: { "x-telegram-init-data": initData }
        });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (profileData.ok && profileData.customer) {
            const cust = profileData.customer;
            if (cust.name) {
              setValue("customerName", cust.name);
            } else if (profileData.telegramName) {
              setValue("customerName", profileData.telegramName);
            }
            
            if (cust.phone) {
              setValue("customerPhone", cust.phone);
              if (cust.phoneVerified) {
                setPhoneVerified(true);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("[Checkout] Error loading initial details:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndBusiness();
  }, [slug]);

  // Prefill name from Telegram context if still blank
  useEffect(() => {
    if (user && !customerName) {
      const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
      if (name) setValue("customerName", name);
    }
  }, [user, setValue, customerName]);



  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleVerified = (verifiedPhone: string) => {
    setPhoneVerified(true);
    setValue("customerPhone", verifiedPhone);
    setShowVerifyModal(false);
    
    // Proactively save to customer profile
    saveProfile(verifiedPhone);
  };

  const saveProfile = async (verifiedPhone: string) => {
    try {
      const initData = typeof window !== "undefined" ? (window as any).Telegram?.WebApp?.initData : "";
      if (!initData) return;

      await fetch("/api/customer/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": initData,
        },
        body: JSON.stringify({
          businessSlug: slug,
          phone: verifiedPhone,
          name: watch("customerName"),
        }),
      });
    } catch (e) {
      console.error("[saveProfile] error:", e);
    }
  };

  const onSubmit = async (data: CheckoutInput) => {
    if (!business) return;
    if (cartItems.length === 0) {
      setError("Корзина пуста");
      return;
    }

    if (!phoneVerified) {
      setShowVerifyModal(true);
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

      if (tg) {
        tg.showAlert(`✅ Заказ #${order.id?.slice(-6).toUpperCase()} успешно оформлен!`);
      }

      router.push(`/${slug}/orders/${order.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Ошибка оформления заказа");
    } finally {
      setSubmitting(false);
    }
  };

  // Manage Telegram native MainButton for smooth mobile keyboard interactions
  useEffect(() => {
    if (!tg) {
      return () => {};
    }

    const handleMainButtonClick = () => {
      if (!phoneVerified) {
        setShowVerifyModal(true);
      } else {
        handleSubmit(onSubmit)();
      }
    };

    tg.MainButton.setText(phoneVerified ? "✅ Подтвердить и заказать" : "🔗 Подтвердить номер для заказа");
    tg.MainButton.setParams({
      color: business?.primaryColor || "#4F46E5",
      text_color: "#FFFFFF",
      is_active: !submitting,
      is_visible: true,
    });

    tg.MainButton.onClick(handleMainButtonClick);
    tg.MainButton.show();

    return () => {
      tg.MainButton.offClick(handleMainButtonClick);
      tg.MainButton.hide();
    };
  }, [tg, phoneVerified, submitting, business, handleSubmit, onSubmit]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <p className="text-slate-500 font-bold">Бизнес не найден</p>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm ring-1 ring-slate-100 max-w-sm">
          <div className="text-5xl mb-4">🛒</div>
          <h2 className="text-lg font-black mb-1">Корзина пуста</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">Добавьте товары перед оформлением заказа.</p>
          <Link href={`/${slug}/catalog`}>
            <Button className="w-full font-black py-5 rounded-xl text-white" style={{ backgroundColor: business.primaryColor }}>
              Перейти в каталог
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-40 bg-slate-50 min-h-screen">
      {/* Dynamic Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 shadow-xs">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => router.back()} className="text-lg font-black text-slate-800">
            ←
          </button>
          <h1 className="text-base font-black flex-1 text-slate-900">Оформление заказа</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4 max-w-md mx-auto">
        {/* Order list summary */}
        <div className="bg-white rounded-3xl p-4.5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-wide">🛒 Сводка заказа</h2>
          <div className="space-y-2">
            {cartItems.map((item) => (
              <div key={item.itemId} className="flex justify-between items-center text-xs font-bold">
                <span className="text-slate-650 line-clamp-1">
                  {item.name} × {item.quantity}
                </span>
                <span className="text-slate-900 ml-2">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}
            <div className="border-t border-dashed pt-2.5 mt-2 flex justify-between font-black text-sm">
              <span className="text-slate-900">Итого к оплате:</span>
              <span style={{ color: business.primaryColor }}>
                {formatPrice(total)}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Delivery Type */}
        <div className="bg-white rounded-3xl p-4.5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-wide">🚚 Способ получения</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "PICKUP" as const, label: "🏪 Самовывоз", desc: "Заберу сам" },
              { value: "DELIVERY" as const, label: "🚚 Доставка", desc: "Привезем вам" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setValue("deliveryType", option.value)}
                className={`p-3 rounded-2xl border-2 text-left transition-all ${
                  deliveryType === option.value
                    ? "border-current"
                    : "border-slate-100 bg-slate-50/50 hover:border-slate-200"
                }`}
                style={{
                  borderColor: deliveryType === option.value ? business.primaryColor : undefined,
                  backgroundColor:
                    deliveryType === option.value
                      ? `${business.primaryColor}08`
                      : undefined,
                }}
              >
                <div className="font-extrabold text-xs text-slate-900">{option.label}</div>
                <div className="text-[10px] font-bold text-slate-400 mt-0.5">{option.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Contact Input Form */}
        <div className="bg-white rounded-3xl p-4.5 shadow-sm ring-1 ring-slate-100 space-y-3.5">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-black uppercase text-slate-400 tracking-wide">👤 Данные получателя</h2>
            <span className={`flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
              phoneVerified ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            }`}>
              {phoneVerified ? (
                <><ShieldCheck size={10} /> Подтвержден</>
              ) : (
                <><ShieldAlert size={10} /> Нужен телефон</>
              )}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-black text-slate-450 uppercase mb-1 block">Имя получателя *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <User size={14} />
                </span>
                <Input
                  {...register("customerName")}
                  placeholder="Иван Иванов"
                  className={`pl-9 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 py-3 ${errors.customerName ? "border-rose-500 bg-rose-50/20" : ""}`}
                />
              </div>
              {errors.customerName && (
                <p className="text-rose-600 text-[10px] font-black mt-1">⚠️ {errors.customerName.message}</p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-450 uppercase mb-1 block">Телефон *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Phone size={14} />
                </span>
                <Input
                  {...register("customerPhone")}
                  type="tel"
                  placeholder="+7 (999) 000-00-00"
                  readOnly={phoneVerified}
                  onClick={() => !phoneVerified && setShowVerifyModal(true)}
                  className={`pl-9 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 py-3 ${errors.customerPhone ? "border-rose-500 bg-rose-50/20" : ""}`}
                />
              </div>
              {errors.customerPhone && (
                <p className="text-rose-600 text-[10px] font-black mt-1">⚠️ {errors.customerPhone.message}</p>
              )}
              {!phoneVerified && (
                <button
                  type="button"
                  onClick={() => setShowVerifyModal(true)}
                  className="text-[10px] font-black text-indigo-650 hover:underline mt-1.5 block"
                >
                  🔗 Подтвердить номер телефона
                </button>
              )}
            </div>

            {deliveryType === "DELIVERY" && (
              <div className="animate-fade-in">
                <label className="text-[10px] font-black text-slate-450 uppercase mb-1 block">Адрес доставки *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <MapPin size={14} />
                  </span>
                  <Input
                    {...register("customerAddress")}
                    placeholder="ул. Примерная, д. 1, кв. 10"
                    className="pl-9 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 py-3"
                    required
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment options */}
        <div className="bg-white rounded-3xl p-4.5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-wide">💳 Способ оплаты</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "CASH" as const, label: "💵 Наличные" },
              { value: "TRANSFER" as const, label: "📱 Перевод" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setValue("paymentMethod", option.value)}
                className={`p-3 rounded-2xl border-2 text-center font-black text-xs transition-all ${
                  watch("paymentMethod") === option.value
                    ? "text-white shadow-md shadow-indigo-600/10"
                    : "border-slate-105 bg-slate-50/50 hover:border-slate-200"
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

        {/* Optional Comments */}
        <div className="bg-white rounded-3xl p-4.5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-xs font-black uppercase text-slate-400 mb-2.5 tracking-wide">💬 Пожелания к заказу</h2>
          <div className="relative">
            <span className="absolute left-3 top-3 text-slate-400">
              <MessageSquare size={14} />
            </span>
            <textarea
              {...register("comment")}
              placeholder="Код домофона, бесконтактная доставка..."
              rows={2.5}
              className="w-full pl-9 pr-3 py-2.5 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
            />
          </div>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl">
            <p className="text-rose-700 text-xs font-black">⚠️ {error}</p>
          </div>
        )}
      </form>

      {/* Fixed bottom checkout button */}
      {!tg && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 max-w-md mx-auto z-40 shadow-lg">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-tight">
              {cartItems.length} поз. · {deliveryType === "DELIVERY" ? "Доставка" : "Самовывоз"}
            </span>
            <span className="font-black text-lg" style={{ color: business.primaryColor }}>
              {formatPrice(total)}
            </span>
          </div>
          
          {phoneVerified ? (
            <Button
              onClick={handleSubmit(onSubmit)}
              disabled={submitting}
              className="w-full py-6 text-sm font-black rounded-2xl text-white shadow-xl hover:brightness-110 transition active:scale-[0.97] disabled:opacity-50"
              style={{ backgroundColor: business.primaryColor }}
            >
              {submitting ? "⏳ Оформляем ваш заказ..." : "✅ Подтвердить и заказать"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setShowVerifyModal(true)}
              className="w-full py-6 text-sm font-black rounded-2xl bg-indigo-600 text-white shadow-xl hover:bg-indigo-700 transition active:scale-[0.97]"
            >
              🔗 Подтвердить номер для заказа
            </Button>
          )}
        </div>
      )}

      {/* Phone verification Modal overlay */}
      {showVerifyModal && (
        <PhoneVerificationScreen
          businessId={business.id}
          telegramUserId={user?.id?.toString() || ""}
          onVerified={handleVerified}
          onClose={() => setShowVerifyModal(false)}
        />
      )}
    </div>
  );
}
