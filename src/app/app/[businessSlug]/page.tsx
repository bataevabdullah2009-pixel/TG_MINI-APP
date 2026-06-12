"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CalendarDays, LayoutGrid, List, Package, Search, X } from "lucide-react";
import { PhoneVerificationScreen } from "@/components/app/PhoneVerificationScreen";
import { FullScreenCheckout } from "@/components/storefront/FullScreenCheckout";
import { BusinessHero } from "@/components/storefront/BusinessHero";
import { CartBar } from "@/components/storefront/CartBar";
import { CategoryTabs } from "@/components/storefront/CategoryTabs";
import { ProductGrid } from "@/components/storefront/ProductGrid";
import type { StorefrontBusiness as Business, StorefrontCartLine as CartItem, StorefrontItem as Item } from "@/components/storefront/types";
import { miniAppFetch } from "@/lib/miniAppFetch";
import { normalizeRuPhone } from "@/lib/phone/phone-utils";

type Staff = { id: string; name: string; role?: string | null };

const templateUi: Record<string, { title: string; accent: string; mode: "cart" | "booking"; cta: string }> = {
  cafe: { title: "Меню и доставка", accent: "from-orange-500 to-amber-400", mode: "cart", cta: "Добавить" },
  shop: { title: "Каталог товаров", accent: "from-blue-600 to-violet-500", mode: "cart", cta: "Добавить" },
  grocery: { title: "Свежие продукты", accent: "from-emerald-600 to-lime-500", mode: "cart", cta: "Добавить" },
  hardware_store: { title: "Хозтовары и консультация", accent: "from-slate-900 to-orange-500", mode: "cart", cta: "В корзину" },
  barbershop: { title: "Запись к мастеру", accent: "from-slate-950 to-yellow-600", mode: "booking", cta: "Записаться" },
  carwash: { title: "Запись на мойку", accent: "from-cyan-600 to-blue-600", mode: "booking", cta: "Записаться" },
};

function telegramUser() {
  if (typeof window === "undefined") return null;
  const telegramRuntimeUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
  if (telegramRuntimeUser) return telegramRuntimeUser;

  try {
    const initData = sessionStorage.getItem("tgInitData") || "";
    const rawUser = new URLSearchParams(initData).get("user");
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function rub(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}

function isoDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export default function BusinessMiniAppPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = String(params.businessSlug || "");
  const targetProductId = searchParams.get("product") || searchParams.get("item");
  const [business, setBusiness] = useState<Business | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [category, setCategory] = useState("Все");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"feed" | "grid">("feed");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartPulse, setCartPulse] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Item | null>(null);
  const [selectedPreviewItem, setSelectedPreviewItem] = useState<Item | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedDate, setSelectedDate] = useState(isoDate());
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [success, setSuccess] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [favoriteToast, setFavoriteToast] = useState("");
  const [businessFavorited, setBusinessFavorited] = useState(false);
  const [favoriteProductIds, setFavoriteProductIds] = useState<string[]>([]);
  const [needsPhoneVerification, setNeedsPhoneVerification] = useState(true);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", address: "", deliveryType: "PICKUP", deliveryZoneId: "", comment: "" });
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [paymentProofFileName, setPaymentProofFileName] = useState("");
  const [paymentProofMimeType, setPaymentProofMimeType] = useState("");
  const [paymentProofUploading, setPaymentProofUploading] = useState(false);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const checkoutSubmittingRef = useRef(false);
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscountPercent, setPromoDiscountPercent] = useState(0);
  const [promoMessage, setPromoMessage] = useState("");
  const [promoValidating, setPromoValidating] = useState(false);
  const businessId = business?.id || "";
  const businessTemplateKey = business?.templateKey || "";
  const businessTemplate = businessTemplateKey ? templateUi[businessTemplateKey] : undefined;
  const businessTemplateMode = businessTemplate?.mode;
  const transferPaymentEnabled = business?.transferPaymentEnabled;
  const deliveryEnabled = business?.settings?.deliveryEnabled;
  const pickupEnabled = business?.settings?.pickupEnabled;
  const deliveryZonesLength = business?.deliveryZones?.length || 0;

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    tg?.ready?.();
    tg?.expand?.();

    setLoading(true);
    setNotFound(false);
    setUnavailable(false);
    setLoadError("");
    fetch(`/api/businesses/${encodeURIComponent(slug)}/catalog`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (res.status === 410 || data.code === "BUSINESS_ARCHIVED") {
          setUnavailable(true);
          return null;
        }
        if (!res.ok) {
          throw new Error(data.error || "Не удалось загрузить каталог.");
        }
        return data;
      })
      .then((data) => {
        if (!data) return;
        setBusiness(data.business);
        setItems(data.items || []);
        setStaff(data.staff || []);
      })
      .catch((error) => {
        console.error("[Storefront catalog load error]", error);
        setLoadError(error instanceof Error ? error.message : "Не удалось загрузить каталог.");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!targetProductId || items.length === 0) return;

    const item = items.find((candidate) => candidate.id === targetProductId);
    if (item) {
      setSelectedPreviewItem(item);
    } else {
      setFavoriteToast("Товар больше недоступен");
      window.setTimeout(() => setFavoriteToast(""), 4000);
    }
  }, [items, targetProductId]);

  useEffect(() => {
    if (!businessId) return undefined;

    const user = telegramUser();
    if (!user?.id) return undefined;

    let cancelled = false;
    const telegramUserId = String(user.id);

    Promise.all([
      miniAppFetch(`/api/favorites/business?telegramUserId=${encodeURIComponent(telegramUserId)}&slug=${encodeURIComponent(slug)}`).then((res) => res.json()),
      miniAppFetch(`/api/favorites/product?telegramUserId=${encodeURIComponent(telegramUserId)}`).then((res) => res.json()),
    ])
      .then(([businessRes, productRes]) => {
        if (cancelled) return;
        if (businessRes.ok) {
          setBusinessFavorited(Boolean(businessRes.data?.favorited));
        }
        if (productRes.ok) {
          setFavoriteProductIds(productRes.data?.productIds || []);
        }
      })
      .catch((error) => console.warn("[Storefront favorites] Could not load favorites:", error));

    return () => {
      cancelled = true;
    };
  }, [businessId, slug]);

  useEffect(() => {
    if (!businessId) return undefined;
    const initData = (window as any).Telegram?.WebApp?.initData || sessionStorage.getItem("tgInitData") || "";
    if (!initData) {
      setNeedsPhoneVerification(true);
      return undefined;
    }

    let cancelled = false;
    miniAppFetch(`/api/customer/profile?businessSlug=${encodeURIComponent(slug)}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось проверить телефон.");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        const customer = data.customer || {};
        const normalizedPhone = normalizeRuPhone(customer.phone) || "";
        const nameParts = String(customer.name || data.telegramName || "").trim().split(/\s+/).filter(Boolean);
        setForm((current) => ({
          ...current,
          firstName: current.firstName || nameParts[0] || "",
          lastName: current.lastName || nameParts.slice(1).join(" "),
          phone: normalizedPhone,
          address: current.address || customer.address || "",
        }));
        setNeedsPhoneVerification(!customer.phoneVerified || !normalizedPhone);
      })
      .catch((error) => {
        console.warn("[Storefront profile] Phone verification state unavailable:", error);
        if (!cancelled) setNeedsPhoneVerification(true);
      });

    return () => {
      cancelled = true;
    };
  }, [businessId, slug]);

  useEffect(() => {
    const saved = localStorage.getItem(`vitrina:${slug}:catalog-view`);
    if (saved === "feed" || saved === "grid") setViewMode(saved);
  }, [slug]);

  useEffect(() => {
    if (!businessId || businessTemplateMode !== "booking") return;
    fetch(`/api/businesses/${slug}/slots?date=${selectedDate}${selectedStaffId ? `&staffId=${selectedStaffId}` : ""}`)
      .then((res) => res.json())
      .then((data) => {
        setSlots(data.slots || []);
        setSelectedTime("");
      });
  }, [businessId, businessTemplateMode, slug, selectedDate, selectedStaffId]);

  useEffect(() => {
    if (!transferPaymentEnabled) {
      setPaymentMethod("CASH");
      setPaymentProofUrl("");
      setPaymentProofFileName("");
      setPaymentProofMimeType("");
    }
  }, [transferPaymentEnabled]);

  useEffect(() => {
    if (deliveryEnabled === undefined || pickupEnabled === undefined) return;
    const deliveryAvailable = deliveryEnabled && Boolean(deliveryZonesLength);
    if (!pickupEnabled && deliveryAvailable) {
      setForm((current) => ({ ...current, deliveryType: "DELIVERY" }));
    } else if (pickupEnabled && !deliveryAvailable) {
      setForm((current) => ({ ...current, deliveryType: "PICKUP", deliveryZoneId: "" }));
    }
  }, [deliveryEnabled, pickupEnabled, deliveryZonesLength]);

  const ui = business ? businessTemplate || templateUi.cafe : templateUi.cafe;
  const mode = ui.mode;
  const categories = useMemo(() => ["Все", ...Array.from(new Set(items.map((item) => item.category?.name || "Основное")))], [items]);
  const filtered = items.filter((item) => {
    const categoryMatch = category === "Все" || (item.category?.name || "Основное") === category;
    const needle = query.trim().toLowerCase();
    const searchMatch = !needle || item.name.toLowerCase().includes(needle) || (item.description || "").toLowerCase().includes(needle);
    return categoryMatch && searchMatch && (mode === "cart" ? item.type === "PRODUCT" : item.type === "SERVICE");
  });
  const cartTotal = cart.reduce((sum, line) => sum + line.item.price * line.quantity, 0);
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  function changeViewMode(mode: "feed" | "grid") {
    setViewMode(mode);
    localStorage.setItem(`vitrina:${slug}:catalog-view`, mode);
  }

  function addToCart(item: Item) {
    if (item.stock === 0) {
      setFavoriteToast(`«${item.name}» сейчас нет в наличии`);
      window.setTimeout(() => setFavoriteToast(""), 4000);
      return;
    }
    setCartPulse(true);
    window.setTimeout(() => setCartPulse(false), 420);
    setCart((prev) => {
      const existing = prev.find((line) => line.item.id === item.id);
      if (existing) {
        if (item.stock !== null && item.stock !== undefined && existing.quantity >= item.stock) return prev;
        return prev.map((line) => line.item.id === item.id ? { ...line, quantity: line.quantity + 1 } : line);
      }
      return [...prev, { item, quantity: 1 }];
    });
  }

  function updateCart(itemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((line) => {
          if (line.item.id !== itemId) return line;
          const nextQuantity = line.quantity + delta;
          if (delta > 0 && line.item.stock !== null && line.item.stock !== undefined && nextQuantity > line.item.stock) {
            return line;
          }
          return { ...line, quantity: nextQuantity };
        })
        .filter((line) => line.quantity > 0)
    );
  }

  function showFavoriteError(message = "Не удалось обновить избранное. Попробуйте ещё раз.") {
    setFavoriteToast(message);
    window.setTimeout(() => setFavoriteToast(""), 4000);
  }

  async function toggleBusinessFavorite() {
    if (!business) return;

    const user = telegramUser();
    if (!user?.id) {
      showFavoriteError("Избранное доступно после входа через Telegram.");
      return;
    }

    const previous = businessFavorited;
    const next = !businessFavorited;
    setBusinessFavorited(next);

    try {
      const res = await miniAppFetch("/api/favorites/business", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId: String(user.id),
          businessId: business.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Не удалось обновить избранное");
      }
    } catch (error) {
      console.error("[Storefront favorite business error]", error);
      setBusinessFavorited(previous);
      showFavoriteError();
    }
  }

  async function toggleProductFavorite(itemId: string) {
    const user = telegramUser();
    if (!user?.id) {
      showFavoriteError("Избранное доступно после входа через Telegram.");
      return;
    }

    const previous = favoriteProductIds;
    const isFavorite = favoriteProductIds.includes(itemId);
    const next = isFavorite ? favoriteProductIds.filter((id) => id !== itemId) : [...favoriteProductIds, itemId];
    setFavoriteProductIds(next);

    try {
      const res = await miniAppFetch("/api/favorites/product", {
        method: isFavorite ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId: String(user.id),
          productId: itemId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Не удалось обновить избранное");
      }
    } catch (error) {
      console.error("[Storefront favorite product error]", error);
      setFavoriteProductIds(previous);
      showFavoriteError();
    }
  }

  async function submitOrder(event: React.FormEvent) {
    event.preventDefault();
    if (checkoutSubmittingRef.current) return;
    setCheckoutError("");
    setNeedsPhoneVerification(false);
    const user = telegramUser();
    if (form.deliveryType === "DELIVERY" && form.address.trim().length < 5) {
      setCheckoutError("Укажите адрес доставки.");
      return;
    }
    if (form.deliveryType === "DELIVERY" && !form.deliveryZoneId) {
      setCheckoutError("Выберите город или район доставки.");
      return;
    }
    if (paymentMethod === "TRANSFER" && !paymentProofUrl) {
      setCheckoutError("Загрузите чек перевода.");
      return;
    }
    checkoutSubmittingRef.current = true;
    setCheckoutSubmitting(true);
    try {
      const res = await miniAppFetch(`/api/businesses/${slug}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: `${form.firstName} ${form.lastName}`.trim(),
          customerPhone: form.phone,
          customerAddress: form.deliveryType === "DELIVERY" ? form.address : "",
          deliveryType: form.deliveryType,
          deliveryZoneId: form.deliveryType === "DELIVERY" ? form.deliveryZoneId : undefined,
          comment: form.comment,
          telegramUserId: user?.id,
          username: user?.username,
          paymentMethod,
          paymentProofUrl: paymentMethod === "TRANSFER" ? paymentProofUrl : undefined,
          paymentProofFileName: paymentMethod === "TRANSFER" ? paymentProofFileName : undefined,
          paymentProofMimeType: paymentMethod === "TRANSFER" ? paymentProofMimeType : undefined,
          idempotencyKey,
          promoCode: promoDiscountPercent > 0 ? promoCode : undefined,
          items: cart.map((line) => ({ itemId: line.item.id, quantity: line.quantity })),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setCart([]);
        setCheckoutOpen(false);
        setPaymentProofUrl("");
        setPaymentProofFileName("");
        setPaymentProofMimeType("");
        setPaymentMethod("CASH");
        setPromoCode("");
        setPromoDiscountPercent(0);
        setPromoMessage("");
        setIdempotencyKey(createIdempotencyKey());
        setSuccess(data.alreadyCreated ? "Заказ уже создан. Открываем существующий заказ." : "Заказ оформлен. Продавец уже получил уведомление.");
      } else {
        const message = data.code === "INSUFFICIENT_STOCK"
          ? data.error || "Некоторых товаров уже недостаточно. Обновите корзину."
          : data.error || "Не удалось оформить заказ. Проверьте данные и попробуйте снова.";
        setCheckoutError(message);
        const phoneNotVerified = data.code === "PHONE_NOT_VERIFIED";
        setNeedsPhoneVerification(phoneNotVerified);
        if (phoneNotVerified) setVerifyOpen(true);
        checkoutSubmittingRef.current = false;
        setCheckoutSubmitting(false);
      }
    } catch (error) {
      setCheckoutError("Не удалось отправить заказ. Проверьте соединение и попробуйте снова.");
      checkoutSubmittingRef.current = false;
      setCheckoutSubmitting(false);
    }
  }

  async function applyPromoCode() {
    const code = promoCode.trim();
    if (!code) {
      setPromoDiscountPercent(0);
      setPromoMessage("Введите промокод.");
      return;
    }
    setPromoValidating(true);
    setPromoMessage("");
    try {
      const response = await miniAppFetch(`/api/businesses/${encodeURIComponent(slug)}/promo-code`, {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "Промокод не применён.");
      setPromoCode(data.code);
      setPromoDiscountPercent(data.discountPercent);
      setPromoMessage(data.message);
    } catch (error) {
      setPromoDiscountPercent(0);
      setPromoMessage(error instanceof Error ? error.message : "Промокод не применён.");
    } finally {
      setPromoValidating(false);
    }
  }

  async function handlePaymentProofUpload(file: File) {
    if (!business) return;
    setCheckoutError("");
    setPaymentProofUploading(true);
    try {
      const formData = new FormData();
      formData.append("businessId", business.id);
      formData.append("file", file);

      const res = await miniAppFetch("/api/orders/payment-proof", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Не удалось загрузить чек.");
      }
      setPaymentProofUrl(data.url || data.publicUrl || "");
      setPaymentProofFileName(data.fileName || file.name);
      setPaymentProofMimeType(data.mimeType || file.type);
    } catch (error) {
      setPaymentProofUrl("");
      setPaymentProofFileName("");
      setPaymentProofMimeType("");
      setCheckoutError(error instanceof Error ? error.message : "Не удалось загрузить чек.");
    } finally {
      setPaymentProofUploading(false);
    }
  }

  async function submitBooking(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedService || !selectedTime) return;
    const user = telegramUser();
    const startTime = new Date(`${selectedDate}T${selectedTime}:00`);
    const res = await miniAppFetch(`/api/businesses/${slug}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: selectedService.id,
        staffId: selectedStaffId || undefined,
        customerName: `${form.firstName} ${form.lastName}`.trim(),
        customerPhone: form.phone,
        startTime: startTime.toISOString(),
        comment: form.comment,
        telegramUserId: user?.id,
        username: user?.username,
      }),
    });

    if (res.ok) {
      setBookingOpen(false);
      setSuccess("Запись создана. Продавец получил уведомление, а статус появится в истории.");
    }
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">Загрузка Mini App...</main>;
  }

  if (loadError) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-5 text-center text-white">
        <div>
          <h1 className="text-2xl font-black">Каталог временно недоступен</h1>
          <p className="mt-2 text-sm text-white/60">{loadError}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button type="button" onClick={() => window.location.reload()} className="rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-950">
              Повторить
            </button>
            <Link href="/app" className="rounded-full bg-white/10 px-5 py-3 text-sm font-bold text-white">
              Вернуться в каталог
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (unavailable) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-5 text-center text-white">
        <div>
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-white/10 text-3xl">×</div>
          <h1 className="text-2xl font-black">Витрина временно недоступна.</h1>
          <p className="mt-2 text-sm text-white/60">Бизнес сохранил историю заказов, но сейчас не принимает новые обращения.</p>
          <Link href="/app" className="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-950">
            Вернуться в каталог
          </Link>
        </div>
      </main>
    );
  }

  if (notFound || !business) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-5 text-center text-white">
        <div>
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-white/10 text-3xl">?</div>
          <h1 className="text-2xl font-black">Бизнес не найден</h1>
          <p className="mt-2 text-sm text-white/60">Проверьте ссылку или вернитесь в общий каталог Vitrina AI.</p>
          <Link href="/app" className="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-950">
            Вернуться в каталог
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-28 text-slate-950">
      <BusinessHero
        business={business}
        title={ui.title}
        accent={ui.accent}
        isFavorite={businessFavorited}
        onFavoriteToggle={toggleBusinessFavorite}
      />

      {favoriteToast && (
        <div className="fixed left-4 right-4 top-4 z-50 mx-auto max-w-md rounded-2xl bg-rose-600 px-4 py-3 text-xs font-black text-white shadow-xl">
          {favoriteToast}
        </div>
      )}

      <section className="mx-auto max-w-3xl px-4 py-5">
        <label className="mb-4 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
          <Search size={18} className="text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по товарам и услугам" className="w-full bg-transparent text-sm outline-none" />
        </label>

        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400">Вид товаров</span>
          <div className="grid grid-cols-2 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200/70">
            <button
              type="button"
              onClick={() => changeViewMode("feed")}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition ${viewMode === "feed" ? "bg-slate-950 text-white" : "text-slate-500"}`}
            >
              <List size={14} />
              Лента
            </button>
            <button
              type="button"
              onClick={() => changeViewMode("grid")}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition ${viewMode === "grid" ? "bg-slate-950 text-white" : "text-slate-500"}`}
            >
              <LayoutGrid size={14} />
              Плитка
            </button>
          </div>
        </div>

        <CategoryTabs categories={categories} activeCategory={category} onCategoryChange={setCategory} />

        {mode === "booking" && (
          <div className="mb-4 rounded-3xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-base font-black"><CalendarDays size={18} /> Быстрая запись</h2>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2, 3, 4, 5].map((offset) => {
                const value = isoDate(offset);
                return (
                  <button key={value} onClick={() => setSelectedDate(value)} className={`rounded-2xl px-3 py-2 text-xs font-bold ${selectedDate === value ? "bg-slate-950 text-white" : "bg-slate-100"}`}>
                    {new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <ProductGrid
          items={filtered}
          viewMode={viewMode}
          mode={mode}
          cta={ui.cta}
          primaryColor={business.primaryColor}
          favoriteProductIds={favoriteProductIds}
          formatPrice={rub}
          onPreview={setSelectedPreviewItem}
          onFavoriteToggle={toggleProductFavorite}
          onAction={(item) => {
            if (mode === "cart") addToCart(item);
            else {
              setSelectedService(item);
              setBookingOpen(true);
            }
          }}
        />
      </section>

      {mode === "cart" && (
        <CartBar
          cart={cart}
          cartCount={cartCount}
          cartTotal={cartTotal}
          cartPulse={cartPulse}
          formatPrice={rub}
          onQuantityChange={updateCart}
          onCheckout={() => {
            checkoutSubmittingRef.current = false;
            setCheckoutSubmitting(false);
            setIdempotencyKey(createIdempotencyKey());
            setCheckoutOpen(true);
          }}
        />
      )}

      {selectedPreviewItem && (
        <ProductPreviewModal
          item={selectedPreviewItem}
          cta={ui.cta}
          onClose={() => setSelectedPreviewItem(null)}
          onAction={() => {
            if (mode === "cart") {
              addToCart(selectedPreviewItem);
            } else {
              setSelectedService(selectedPreviewItem);
              setBookingOpen(true);
            }
            setSelectedPreviewItem(null);
          }}
          primaryColor={business.primaryColor}
        />
      )}

      {checkoutOpen && (
        <FullScreenCheckout
          business={business}
          cart={cart}
          cartTotal={cartTotal}
          cartCount={cartCount}
          form={form}
          setForm={setForm}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          paymentProofUrl={paymentProofUrl}
          paymentProofFileName={paymentProofFileName}
          paymentProofUploading={paymentProofUploading}
          onPaymentProofUpload={handlePaymentProofUpload}
          promoCode={promoCode}
          setPromoCode={(value) => {
            setPromoCode(value.toUpperCase());
            setPromoDiscountPercent(0);
            setPromoMessage("");
          }}
          promoDiscountPercent={promoDiscountPercent}
          promoMessage={promoMessage}
          promoValidating={promoValidating}
          onApplyPromoCode={applyPromoCode}
          submitting={checkoutSubmitting}
          checkoutError={checkoutError}
          needsPhoneVerification={needsPhoneVerification}
          onSubmit={submitOrder}
          onClose={() => setCheckoutOpen(false)}
          onVerifyPhone={() => setVerifyOpen(true)}
          formatPrice={rub}
        />
      )}

      {verifyOpen && business && (
        <PhoneVerificationScreen
          businessId={business.id}
          telegramUserId={telegramUser()?.id?.toString() || ""}
          onVerified={(phone) => {
            setForm((current) => ({ ...current, phone }));
            setCheckoutError("");
            setNeedsPhoneVerification(false);
            setVerifyOpen(false);
          }}
          onClose={() => setVerifyOpen(false)}
        />
      )}

      {bookingOpen && selectedService && (
        <Modal title="Запись на услугу" onClose={() => setBookingOpen(false)}>
          <form onSubmit={submitBooking} className="space-y-3">
            <div className="rounded-2xl bg-slate-100 p-3 text-sm font-bold">{selectedService.name} · {rub(selectedService.price)}</div>
            {staff.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStaffId("")}
                  className={`rounded-2xl px-3 py-3 text-left text-sm font-bold ${selectedStaffId === "" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  Любой мастер
                </button>
                {staff.map((person) => (
                  <button
                    type="button"
                    key={person.id}
                    onClick={() => setSelectedStaffId(person.id)}
                    className={`rounded-2xl px-3 py-3 text-left text-sm font-bold ${selectedStaffId === person.id ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}
                  >
                    {person.name}
                  </button>
                ))}
              </div>
            )}
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full rounded-2xl border px-4 py-3 text-sm" />
            <div className="grid grid-cols-4 gap-2">
              {slots.map((time) => (
                <button type="button" key={time} onClick={() => setSelectedTime(time)} className={`rounded-xl px-2 py-2 text-xs font-bold ${selectedTime === time ? "bg-slate-950 text-white" : "bg-slate-100"}`}>
                  {time}
                </button>
              ))}
            </div>
            <ContactFields form={form} setForm={setForm} />
            <button disabled={!selectedTime} className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-black text-white disabled:opacity-40">Подтвердить запись</button>
          </form>
        </Modal>
      )}

      {success && (
        <Modal title="Готово" onClose={() => setSuccess("")}>
          <p className="text-sm text-slate-600">{success}</p>
          <button onClick={() => setSuccess("")} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-3 font-black text-white">Отлично</button>
        </Modal>
      )}
    </main>
  );
}

function ProductPreviewModal({
  item,
  cta,
  primaryColor,
  onAction,
  onClose,
}: {
  item: Item;
  cta: string;
  primaryColor: string;
  onAction: () => void;
  onClose: () => void;
}) {
  const isOutOfStock = item.stock === 0;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Закрыть" />
      <div className="relative w-full max-w-md overflow-hidden rounded-t-[28px] bg-white shadow-2xl animate-slide-up sm:rounded-[28px]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-slate-700 shadow-sm"
          aria-label="Закрыть"
        >
          <X size={18} />
        </button>

        <div className="aspect-square bg-slate-100">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-slate-400">
              <Package size={42} strokeWidth={1.7} />
            </div>
          )}
        </div>

        <div className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-4">
            <h2 className="min-w-0 text-lg font-black leading-tight text-slate-950">{item.name}</h2>
            <p className="shrink-0 whitespace-nowrap text-base font-black" style={{ color: primaryColor }}>
              {rub(item.price)}
            </p>
          </div>
          {item.description && (
            <p className="text-sm leading-6 text-slate-500">{item.description}</p>
          )}
          {isOutOfStock && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-black text-rose-700">Нет в наличии</p>}
          <button
            type="button"
            onClick={onAction}
            disabled={isOutOfStock}
            className="w-full rounded-2xl px-4 py-4 text-sm font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300"
            style={isOutOfStock ? undefined : { backgroundColor: primaryColor }}
          >
            {isOutOfStock ? "Нет в наличии" : cta}
          </button>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/55 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">{title}</h2>
          <button onClick={onClose} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ContactFields({
  form,
  setForm,
  showAddress = false,
}: {
  form: { firstName: string; lastName: string; phone: string; address: string; deliveryType: string; deliveryZoneId: string; comment: string };
  setForm: (value: any) => void;
  showAddress?: boolean;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Имя" className="rounded-2xl border px-4 py-3 text-sm" />
        <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Фамилия" className="rounded-2xl border px-4 py-3 text-sm" />
      </div>
      <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+79991234567" className="w-full rounded-2xl border px-4 py-3 text-sm" />
      {showAddress && <input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Адрес доставки" className="w-full rounded-2xl border px-4 py-3 text-sm" />}
      <textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="Комментарий" className="h-20 w-full resize-none rounded-2xl border px-4 py-3 text-sm" />
    </>
  );
}
