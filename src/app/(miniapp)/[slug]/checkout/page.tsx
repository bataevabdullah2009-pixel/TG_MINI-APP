"use client";

import React, { useEffect, useRef, useState } from "react";
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
import { normalizeRuPhone } from "@/lib/phone/phone-utils";
import { useTelegram } from "@/hooks/useTelegram";
import Link from "next/link";
import { PhoneVerificationScreen } from "@/components/app/PhoneVerificationScreen";
import { BottomSheetPicker } from "@/components/ui/BottomSheetPicker";
import {
  User,
  Phone,
  MapPin,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  Store,
  Truck,
  Wallet,
  Smartphone,
  ShoppingBag,
  CheckCircle2,
  ChevronRight,
  Tag
} from "lucide-react";

const CheckoutSchema = z.object({
  customerName: z.string().min(2, "Введите имя (мин. 2 символа)"),
  customerPhone: z.string().regex(/^\+7\d{10}$/, "Введите номер в формате +7XXXXXXXXXX"),
  customerAddress: z.string().optional(),
  deliveryType: z.enum(["DELIVERY", "PICKUP"]),
  deliveryZoneId: z.string().optional(),
  comment: z.string().optional(),
  paymentMethod: z.enum(["CASH", "TRANSFER"]),
});

type CheckoutInput = z.infer<typeof CheckoutSchema>;

function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [paymentProofFileName, setPaymentProofFileName] = useState("");
  const [paymentProofMimeType, setPaymentProofMimeType] = useState("");
  const [paymentProofUploading, setPaymentProofUploading] = useState(false);
  const submittingRef = useRef(false);
  const [idempotencyKey] = useState(createIdempotencyKey);
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscountPercent, setPromoDiscountPercent] = useState(0);
  const [promoMessage, setPromoMessage] = useState("");
  const [promoValidating, setPromoValidating] = useState(false);

  // Verification states
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // Success state
  const [createdOrder, setCreatedOrder] = useState<any>(null);

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
  const deliveryZoneId = watch("deliveryZoneId");
  const customerName = watch("customerName");
  const paymentMethod = watch("paymentMethod");

  const fetchProfileAndBusiness = async () => {
    try {
      setLoading(true);
      const bizRes = await apiClient.get(`/businesses/${slug}`);
      const biz = bizRes.data;
      setBusiness(biz);
      if (!biz.transferPaymentEnabled) {
        setValue("paymentMethod", "CASH");
      }
      const deliveryAvailable = biz.settings?.deliveryEnabled && Boolean(biz.deliveryZones?.length);
      if (!biz.settings?.pickupEnabled && deliveryAvailable) {
        setValue("deliveryType", "DELIVERY");
      } else if (biz.settings?.pickupEnabled && !deliveryAvailable) {
        setValue("deliveryType", "PICKUP");
        setValue("deliveryZoneId", "");
      }

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
              const normalizedPhone = normalizeRuPhone(cust.phone);
              setValue("customerPhone", normalizedPhone || "");
              if (cust.phoneVerified && normalizedPhone) {
                setPhoneVerified(true);
              }
            }
            if (cust.address) {
              setValue("customerAddress", cust.address);
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

  useEffect(() => {
    if (user && !customerName) {
      const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
      if (name) setValue("customerName", name);
    }
  }, [user, setValue, customerName]);

  const itemsSubtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const selectedZone = business?.deliveryZones?.find((zone) => zone.id === deliveryZoneId);
  const deliveryFee = deliveryType === "DELIVERY" ? selectedZone?.fee || 0 : 0;
  const discountAmount = promoDiscountPercent > 0
    ? Math.round(itemsSubtotal * promoDiscountPercent) / 100
    : 0;
  const total = Math.max(0, itemsSubtotal - discountAmount) + deliveryFee;
  const pickupEnabled = business?.settings?.pickupEnabled !== false;
  const deliveryEnabled = business?.settings?.deliveryEnabled === true && Boolean(business?.deliveryZones?.length);

  const handleVerified = (verifiedPhone: string) => {
    setPhoneVerified(true);
    setValue("customerPhone", verifiedPhone);
    setShowVerifyModal(false);
    saveProfile(verifiedPhone).finally(() => fetchProfileAndBusiness());
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
          address: watch("customerAddress"),
        }),
      });
    } catch (e) {
      console.error("[saveProfile] error:", e);
    }
  };

  const handlePaymentProofUpload = async (file?: File | null) => {
    if (!file || !business) return;
    setPaymentProofUploading(true);
    setError(null);
    try {
      const initData = typeof window !== "undefined" ? (window as any).Telegram?.WebApp?.initData : "";
      const formData = new FormData();
      formData.append("file", file);
      formData.append("businessId", business.id);

      const res = await fetch("/api/orders/payment-proof", {
        method: "POST",
        headers: initData ? { "x-telegram-init-data": initData } : undefined,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Не удалось загрузить чек.");
      }
      setPaymentProofUrl(data.url);
      setPaymentProofFileName(data.fileName || file.name);
      setPaymentProofMimeType(data.mimeType || file.type);
    } catch (e: any) {
      setPaymentProofUrl("");
      setPaymentProofFileName("");
      setPaymentProofMimeType("");
      setError(e.message || "Не удалось загрузить чек перевода.");
    } finally {
      setPaymentProofUploading(false);
    }
  };

  const onSubmit = async (data: CheckoutInput) => {
    if (submittingRef.current) return;
    if (!business) return;
    if (cartItems.length === 0) {
      setError("Корзина пуста");
      return;
    }

    if (!phoneVerified) {
      setShowVerifyModal(true);
      return;
    }

    if (data.deliveryType === "DELIVERY" && !data.customerAddress?.trim()) {
      setError("Укажите адрес доставки.");
      return;
    }
    if (data.deliveryType === "DELIVERY" && !data.deliveryZoneId) {
      setError("Выберите город или район доставки.");
      return;
    }

    if (data.paymentMethod === "TRANSFER" && !paymentProofUrl) {
      setError("Загрузите чек перевода.");
      return;
    }

    submittingRef.current = true;
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
        deliveryZoneId: data.deliveryType === "DELIVERY" ? data.deliveryZoneId : undefined,
        paymentMethod: data.paymentMethod,
        paymentProofUrl: data.paymentMethod === "TRANSFER" ? paymentProofUrl : undefined,
        paymentProofFileName: data.paymentMethod === "TRANSFER" ? paymentProofFileName : undefined,
        paymentProofMimeType: data.paymentMethod === "TRANSFER" ? paymentProofMimeType : undefined,
        idempotencyKey,
        promoCode: promoDiscountPercent > 0 ? promoCode : undefined,
        comment: data.comment,
        telegramUserId: user?.id?.toString(),
        username: user?.username,
      };

      const res = await apiClient.post("/orders", orderData);
      const order = res.data;

      // Save customer profile data with address updated
      if (data.customerAddress) {
        saveProfile(data.customerPhone);
      }

      clearCart();
      setCreatedOrder(order);

      if (tg) {
        tg.HapticFeedback.notificationOccurred("success");
      }
    } catch (err: any) {
      const code = err?.response?.data?.code;
      const message = err?.response?.data?.error || "Не удалось оформить заказ. Проверьте данные и попробуйте снова.";
      setError(message);
      if (code === "PHONE_NOT_VERIFIED") {
        setPhoneVerified(false);
        setShowVerifyModal(true);
      }
      submittingRef.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  const applyPromoCode = async () => {
    if (!business || !promoCode.trim()) {
      setPromoDiscountPercent(0);
      setPromoMessage("Введите промокод.");
      return;
    }
    setPromoValidating(true);
    setPromoMessage("");
    try {
      const response = await apiClient.post(`/businesses/${encodeURIComponent(slug)}/promo-code`, { code: promoCode });
      setPromoCode(response.data.code);
      setPromoDiscountPercent(response.data.discountPercent);
      setPromoMessage(response.data.message);
    } catch (error: any) {
      setPromoDiscountPercent(0);
      setPromoMessage(error?.response?.data?.error || "Промокод не применён.");
    } finally {
      setPromoValidating(false);
    }
  };

  // Sync with Telegram Native Main Button
  useEffect(() => {
    if (!tg || createdOrder) {
      if (tg) tg.MainButton.hide();
      return () => {};
    }

    const handleMainButtonClick = () => {
      if (!phoneVerified) {
        setShowVerifyModal(true);
      } else {
        handleSubmit(onSubmit)();
      }
    };

    tg.MainButton.setText(
      submitting
        ? "Отправляем заказ…"
        : phoneVerified
          ? `Подтвердить заказ на ${formatPrice(total)}`
          : "🔗 Подтвердить номер для заказа"
    );
    tg.MainButton.setParams({
      color: business?.primaryColor || "#3B82F6",
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
  }, [tg, phoneVerified, submitting, business, handleSubmit, onSubmit, createdOrder, total]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
          <p className="text-xs font-bold text-slate-400">Загрузка информации...</p>
        </div>
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

  // Beautiful Success Screen
  if (createdOrder) {
    return (
      <div className="min-h-screen bg-white flex flex-col justify-between p-6 animate-fade-in">
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes scaleIn {
            0% { transform: scale(0.4); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes drawCheck {
            0% { stroke-dashoffset: 48; }
            100% { stroke-dashoffset: 0; }
          }
          .animate-scale-in {
            animation: scaleIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          .animate-draw-check {
            stroke-dasharray: 48;
            stroke-dashoffset: 48;
            animation: drawCheck 0.6s 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}} />

        <div className="flex-1 flex flex-col items-center justify-center text-center my-auto">
          {/* Animated Success Checkmark */}
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-6 animate-scale-in border border-emerald-100">
            <svg className="w-12 h-12 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path className="animate-draw-check" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-2xl font-black text-slate-900 mb-2">Заказ успешно оформлен!</h2>
          <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed mb-6">
            Спасибо за покупку! Мы уже передали заказ менеджеру на подтверждение.
          </p>

          {/* Info Card */}
          <div className="bg-slate-50 rounded-2xl p-5 w-full max-w-sm border border-slate-100 space-y-3.5 text-left mb-6">
            <div className="flex justify-between items-center text-xs font-bold text-slate-400">
              <span>НОМЕР ЗАКАЗА</span>
              <span className="text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-100 font-mono text-sm">
                #{createdOrder.id?.slice(-6).toUpperCase()}
              </span>
            </div>

            <div className="border-t border-slate-100 pt-3 flex justify-between text-xs font-bold">
              <span className="text-slate-400">СПОСОБ ПОЛУЧЕНИЯ</span>
              <span className="text-slate-900">
                {createdOrder.deliveryType === "DELIVERY" ? "🚚 Доставка" : "🏪 Самовывоз"}
              </span>
            </div>

            {createdOrder.customerAddress && (
              <div className="border-t border-slate-100 pt-3 flex flex-col gap-1 text-xs font-bold">
                <span className="text-slate-400">АДРЕС</span>
                <span className="text-slate-900 line-clamp-2">{createdOrder.customerAddress}</span>
              </div>
            )}

            <div className="border-t border-slate-100 pt-3 flex justify-between text-xs font-bold">
              <span className="text-slate-400">ИТОГО К ОПЛАТЕ</span>
              <span className="text-slate-900 text-sm font-black" style={{ color: business.primaryColor }}>
                {formatPrice(createdOrder.totalPrice)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 w-full max-w-sm mx-auto pb-safe">
          <Link href={`/${slug}/orders/${createdOrder.id}`} className="block w-full">
            <Button className="w-full py-6 font-black text-sm rounded-2xl text-white shadow-lg hover:brightness-110 active:scale-[0.98] transition" style={{ backgroundColor: business.primaryColor }}>
              Статус заказа
            </Button>
          </Link>
          <Link href={`/${slug}/catalog`} className="block w-full">
            <Button variant="outline" className="w-full py-6 font-bold text-sm rounded-2xl border-slate-200 hover:bg-slate-50 transition">
              Вернуться в каталог
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Cart Empty State fallback if somehow accessed directly
  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm ring-1 ring-slate-100 max-w-sm">
          <div className="text-5xl mb-4">🛒</div>
          <h2 className="text-lg font-black mb-1">Корзина пуста</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">Добавьте товары в корзину перед оформлением заказа.</p>
          <Link href={`/${slug}/catalog`}>
            <Button className="w-full font-black py-5 rounded-2xl text-white" style={{ backgroundColor: business.primaryColor }}>
              Перейти в каталог
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-44 bg-slate-50 min-h-screen flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="flex items-center gap-3 px-4 py-4 max-w-md mx-auto">
          <button onClick={() => router.back()} className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-55/10 hover:bg-slate-100 text-slate-800 transition">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-black flex-1 text-slate-900">Оформление заказа</h1>
          <span className="text-xs font-black text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
            {cartItems.length} поз.
          </span>
        </div>
      </div>

      <div className="flex-1 max-w-md w-full mx-auto p-4 space-y-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* Order Summary Box */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-center gap-2">
              <ShoppingBag size={16} className="text-slate-400" />
              <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider">Сводка заказа</h2>
            </div>

            <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1 no-scrollbar">
              {cartItems.map((item) => (
                <div key={item.itemId} className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-600 line-clamp-1 flex-1">
                    {item.name} <span className="text-slate-400 font-normal">× {item.quantity}</span>
                  </span>
                  <span className="text-slate-950 font-mono ml-3 shrink-0">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-slate-200 pt-3.5 flex justify-between items-center">
              <span className="text-xs font-black text-slate-900">Сумма товаров:</span>
              <span className="text-base font-black" style={{ color: business.primaryColor }}>
                {formatPrice(itemsSubtotal)}
              </span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between items-center text-xs font-bold text-emerald-700">
                <span>Скидка по промокоду ({promoDiscountPercent}%):</span>
                <span>−{formatPrice(discountAmount)}</span>
              </div>
            )}
            {deliveryType === "DELIVERY" && (
              <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                <span>Стоимость доставки:</span>
                <span>{formatPrice(deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-slate-900">Итого к оплате:</span>
              <span className="text-base font-black" style={{ color: business.primaryColor }}>{formatPrice(total)}</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-3">
            <h2 className="flex items-center gap-2 text-xs font-black uppercase text-slate-400 tracking-wider">
              <Tag size={15} /> Промокод
            </h2>
            <div className="flex gap-2">
              <Input
                value={promoCode}
                onChange={(event) => {
                  setPromoCode(event.target.value.toUpperCase());
                  setPromoDiscountPercent(0);
                  setPromoMessage("");
                }}
                maxLength={32}
                placeholder="Введите промокод"
                className="uppercase"
              />
              <Button type="button" variant="outline" onClick={applyPromoCode} disabled={promoValidating || !promoCode.trim()}>
                {promoValidating ? "Проверяем..." : "Применить"}
              </Button>
            </div>
            {promoMessage && (
              <p className={`rounded-xl p-2 text-xs font-bold ${promoDiscountPercent > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {promoMessage}
              </p>
            )}
          </div>

          {/* Delivery Type selectable cards */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
            <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider">Способ получения</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "PICKUP" as const, label: "Самовывоз", desc: "Заберу сам", icon: Store },
                { value: "DELIVERY" as const, label: "Доставка", desc: "Привезем вам", icon: Truck },
              ].filter((option) => option.value === "PICKUP" ? pickupEnabled : deliveryEnabled).map((option) => {
                const Icon = option.icon;
                const isSelected = deliveryType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setValue("deliveryType", option.value);
                      if (option.value === "PICKUP") setValue("deliveryZoneId", "");
                    }}
                    className={`p-4 rounded-2xl border-2 text-left transition-all relative ${
                      isSelected
                        ? "shadow-sm"
                        : "border-slate-100 bg-slate-50/50 hover:border-slate-200"
                    }`}
                    style={{
                      borderColor: isSelected ? business.primaryColor : undefined,
                      backgroundColor: isSelected ? `${business.primaryColor}08` : undefined,
                    }}
                  >
                    <Icon size={18} className="mb-2" style={{ color: isSelected ? business.primaryColor : "#94A3B8" }} />
                    <div className="font-extrabold text-xs text-slate-900">{option.label}</div>
                    <div className="text-[10px] font-bold text-slate-400 mt-0.5">{option.desc}</div>
                    {isSelected && (
                      <span className="absolute right-2 top-2 h-2 w-2 rounded-full" style={{ backgroundColor: business.primaryColor }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customer Profile Inputs */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider">Данные получателя</h2>
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

            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Имя получателя *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-450">
                    <User size={14} />
                  </span>
                  <Input
                    {...register("customerName")}
                    placeholder="Имя Фамилия"
                    className={`pl-10 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50/50 py-5 focus:bg-white transition ${errors.customerName ? "border-rose-500 bg-rose-50/20" : ""}`}
                  />
                </div>
                {errors.customerName && (
                  <p className="text-rose-600 text-[10px] font-black mt-1">⚠️ {errors.customerName.message}</p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Номер телефона *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-450">
                    <Phone size={14} />
                  </span>
                  <Input
                    {...register("customerPhone")}
                    type="tel"
                    placeholder="+79990000000"
                    readOnly={phoneVerified}
                    onClick={() => !phoneVerified && setShowVerifyModal(true)}
                    className={`pl-10 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50/50 py-5 focus:bg-white transition cursor-pointer ${errors.customerPhone ? "border-rose-500 bg-rose-50/20" : ""}`}
                  />
                </div>
                {errors.customerPhone && (
                  <p className="text-rose-600 text-[10px] font-black mt-1">⚠️ {errors.customerPhone.message}</p>
                )}
                {!phoneVerified && (
                  <button
                    type="button"
                    onClick={() => setShowVerifyModal(true)}
                    className="text-[10px] font-black hover:underline mt-1.5 flex items-center gap-1"
                    style={{ color: business.accentColor || business.primaryColor }}
                  >
                    🔗 Подтвердить номер телефона через СМС/TG
                  </button>
                )}
              </div>

              {deliveryType === "DELIVERY" && (
                <div className="animate-fade-in space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Город / район доставки *</label>
                  <BottomSheetPicker
                    title="Выберите зону доставки"
                    value={deliveryZoneId || ""}
                    onChange={(value) => setValue("deliveryZoneId", value, { shouldValidate: true })}
                    placeholder="Выберите зону"
                    buttonClassName="mb-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-bold"
                    options={(business.deliveryZones || []).filter((zone) => zone.isActive).map((zone) => ({
                      value: zone.id,
                      label: zone.name,
                      description: `Доставка ${formatPrice(zone.fee)}`,
                      icon: <MapPin size={17} />,
                    }))}
                  />
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Адрес доставки *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-455">
                      <MapPin size={14} />
                    </span>
                    <Input
                      {...register("customerAddress")}
                      placeholder="Город, улица, дом, квартира"
                      className="pl-10 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50/50 py-5 focus:bg-white transition"
                      required
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment selectable options */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
            <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider">Способ оплаты</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "CASH" as const, label: "Наличные", icon: Wallet },
                { value: "TRANSFER" as const, label: "Перевод", icon: Smartphone },
              ].filter((option) => option.value !== "TRANSFER" || business.transferPaymentEnabled).map((option) => {
                const Icon = option.icon;
                const isSelected = paymentMethod === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setValue("paymentMethod", option.value)}
                    className={`p-4 rounded-2xl border-2 flex items-center justify-center gap-2 font-black text-xs transition-all ${
                      isSelected
                        ? "text-white shadow-md"
                        : "border-slate-100 bg-slate-50/50 hover:border-slate-200"
                    }`}
                    style={{
                      backgroundColor: isSelected ? business.primaryColor : undefined,
                      borderColor: isSelected ? business.primaryColor : undefined,
                    }}
                  >
                    <Icon size={14} />
                    {option.label}
                  </button>
                );
              })}
            </div>
            {paymentMethod === "TRANSFER" && business.transferPaymentEnabled && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs font-bold text-slate-700 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-slate-400">Банк</span>
                  <span className="text-right">{business.transferBankName || "не указан"}</span>
                  <span className="text-slate-400">Телефон/SBP</span>
                  <span className="text-right">{business.transferPaymentPhone || "не указан"}</span>
                  <span className="text-slate-400">Получатель</span>
                  <span className="text-right">{business.transferRecipientName || "не указан"}</span>
                  <span className="text-slate-400">Сумма</span>
                  <span className="text-right">{formatPrice(total)}</span>
                </div>
                <p className="rounded-xl bg-white/80 p-2 text-[11px] leading-relaxed">
                  {business.transferPaymentInstructions || "После перевода загрузите чек."}
                </p>
                <label className="block rounded-xl bg-white p-3 text-center text-[11px] font-black text-emerald-700 ring-1 ring-emerald-100">
                  {paymentProofUploading ? "Загружаем чек..." : paymentProofUrl ? "Чек загружен" : "Загрузить чек перевода"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                    className="hidden"
                    disabled={paymentProofUploading}
                    onChange={(event) => handlePaymentProofUpload(event.target.files?.[0])}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Comments block */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-3.5">
            <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider">Пожелания к заказу</h2>
            <div className="relative">
              <span className="absolute left-3.5 top-3.5 text-slate-450">
                <MessageSquare size={14} />
              </span>
              <textarea
                {...register("comment")}
                placeholder="Напишите комментарий, если необходимо..."
                rows={2}
                className="w-full pl-10 pr-3.5 py-3 text-xs font-bold border border-slate-200 rounded-xl bg-slate-55/10 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl">
              <p className="text-rose-700 text-xs font-bold">⚠️ {error}</p>
            </div>
          )}
        </form>
      </div>

      {/* Sticky Bottom Actions Bar (Fallback for browser / non-Telegram environment) */}
      {!tg && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 p-4 max-w-md mx-auto z-30 shadow-lg pb-safe">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              {cartItems.length} товаров · {deliveryType === "DELIVERY" ? "Доставка" : "Самовывоз"}
            </span>
            <span className="font-mono font-black text-base" style={{ color: business.primaryColor }}>
              {formatPrice(total)}
            </span>
          </div>

          {phoneVerified ? (
            <Button
              onClick={handleSubmit(onSubmit)}
              disabled={submitting || (paymentMethod === "TRANSFER" && (!paymentProofUrl || paymentProofUploading))}
              className="w-full py-6 text-sm font-black rounded-2xl text-white shadow-md hover:brightness-110 transition active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: business.primaryColor }}
            >
              {submitting ? "Отправляем заказ…" : `Подтвердить заказ на ${formatPrice(total)}`}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setShowVerifyModal(true)}
              className="w-full py-6 text-sm font-black rounded-2xl text-white shadow-md hover:brightness-110 transition active:scale-[0.98]"
              style={{ backgroundColor: business.accentColor || business.primaryColor }}
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
