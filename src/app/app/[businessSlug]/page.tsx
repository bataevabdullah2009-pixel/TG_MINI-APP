"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarDays, Heart, Minus, Plus, Search, ShoppingBag, Star } from "lucide-react";

type Item = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  type: "PRODUCT" | "SERVICE";
  durationMinutes?: number | null;
  stock?: number | null;
  isPopular: boolean;
  category?: { id: string; name: string } | null;
};

type Staff = { id: string; name: string; role?: string | null };

type Business = {
  id: string;
  slug: string;
  name: string;
  type: string;
  templateKey: string;
  description?: string | null;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  primaryColor: string;
  accentColor: string;
};

type CartItem = { item: Item; quantity: number };

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
  return (window as any).Telegram?.WebApp?.initDataUnsafe?.user || null;
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
  const slug = String(params.businessSlug || "");
  const [business, setBusiness] = useState<Business | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [category, setCategory] = useState("Все");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Item | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedDate, setSelectedDate] = useState(isoDate());
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", address: "", deliveryType: "PICKUP", comment: "" });

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    tg?.ready?.();
    tg?.expand?.();

    fetch(`/api/businesses/${slug}/catalog`)
      .then(async (res) => {
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setBusiness(data.business);
        setItems(data.items || []);
        setStaff(data.staff || []);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!business || templateUi[business.templateKey]?.mode !== "booking") return;
    fetch(`/api/businesses/${slug}/slots?date=${selectedDate}${selectedStaffId ? `&staffId=${selectedStaffId}` : ""}`)
      .then((res) => res.json())
      .then((data) => {
        setSlots(data.slots || []);
        setSelectedTime("");
      });
  }, [business, slug, selectedDate, selectedStaffId]);

  const ui = business ? templateUi[business.templateKey] || templateUi.cafe : templateUi.cafe;
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

  function addToCart(item: Item) {
    setCart((prev) => {
      const existing = prev.find((line) => line.item.id === item.id);
      if (existing) return prev.map((line) => line.item.id === item.id ? { ...line, quantity: line.quantity + 1 } : line);
      return [...prev, { item, quantity: 1 }];
    });
  }

  function updateCart(itemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((line) => line.item.id === itemId ? { ...line, quantity: line.quantity + delta } : line)
        .filter((line) => line.quantity > 0)
    );
  }

  async function submitOrder(event: React.FormEvent) {
    event.preventDefault();
    const user = telegramUser();
    const res = await fetch(`/api/businesses/${slug}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: `${form.firstName} ${form.lastName}`.trim(),
        customerPhone: form.phone,
        customerAddress: form.deliveryType === "DELIVERY" ? form.address : "",
        deliveryType: form.deliveryType,
        comment: form.comment,
        telegramUserId: user?.id,
        username: user?.username,
        items: cart.map((line) => ({ itemId: line.item.id, quantity: line.quantity })),
      }),
    });

    if (res.ok) {
      setCart([]);
      setCheckoutOpen(false);
      setSuccess("Заказ оформлен. Продавец уже получил уведомление.");
    }
  }

  async function submitBooking(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedService || !selectedTime) return;
    const user = telegramUser();
    const startTime = new Date(`${selectedDate}T${selectedTime}:00`);
    const res = await fetch(`/api/businesses/${slug}/bookings`, {
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

  if (notFound || !business) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-5 text-center text-white">
        <div>
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-white/10 text-3xl">?</div>
          <h1 className="text-2xl font-black">Бизнес не найден</h1>
          <p className="mt-2 text-sm text-white/60">Проверьте ссылку или вернитесь в общий каталог SmartBiz AI.</p>
          <Link href="/app" className="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-950">
            Вернуться в каталог
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-28 text-slate-950">
      <section
        className={`bg-gradient-to-br ${ui.accent} px-4 pb-8 pt-5 text-white`}
        style={business.coverImageUrl ? { backgroundImage: `linear-gradient(135deg, rgba(2,6,23,.78), rgba(2,6,23,.35)), url(${business.coverImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        <div className="mx-auto max-w-3xl">
          <div className="mb-5 flex items-center justify-between">
            <Link href="/app" className="grid h-10 w-10 place-items-center rounded-full bg-white/15"><ArrowLeft size={18} /></Link>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-white/15"><Heart size={18} /></button>
          </div>
          <div className="rounded-[28px] bg-black/20 p-5 backdrop-blur">
            {business.logoUrl && <img src={business.logoUrl} alt={business.name} className="mb-4 h-16 w-16 rounded-2xl object-cover ring-2 ring-white/70" />}
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">{ui.title}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">{business.name}</h1>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/75">{business.description}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-white/15 px-3 py-1">★ 4.8</span>
              <span className="rounded-full bg-emerald-400 px-3 py-1 text-emerald-950">Открыт</span>
              {business.address && <span className="rounded-full bg-white/15 px-3 py-1">{business.address}</span>}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-5">
        <label className="mb-4 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
          <Search size={18} className="text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по товарам и услугам" className="w-full bg-transparent text-sm outline-none" />
        </label>

        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {categories.map((name) => (
            <button key={name} onClick={() => setCategory(name)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${category === name ? "bg-slate-950 text-white" : "bg-white text-slate-600"}`}>
              {name}
            </button>
          ))}
        </div>

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

        <div className="grid gap-3">
          {filtered.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200/70">
              <div className="h-40 bg-slate-200">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-black text-slate-400">
                    {item.type === "SERVICE" ? "Фото услуги скоро появится" : "Фото товара скоро появится"}
                  </div>
                )}
              </div>
              <div className="flex items-start justify-between gap-4 p-4">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="font-black">{item.name}</h3>
                    {item.isPopular && <Star size={14} className="text-amber-500" fill="currentColor" />}
                  </div>
                  <p className="line-clamp-2 text-sm text-slate-500">{item.description}</p>
                  {item.durationMinutes && <p className="mt-1 text-xs font-bold text-slate-400">{item.durationMinutes} мин.</p>}
                </div>
                <div className="text-right">
                  <p className="whitespace-nowrap font-black">{rub(item.price)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 pb-4">
                <button
                  onClick={() => {
                    if (mode === "cart") addToCart(item);
                    else {
                      setSelectedService(item);
                      setBookingOpen(true);
                    }
                  }}
                  className="rounded-full px-4 py-2 text-sm font-bold text-white"
                  style={{ backgroundColor: business.primaryColor }}
                >
                  {ui.cta}
                </button>
                <button className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold">★ Избранное</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {mode === "cart" && cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-3xl bg-white/95 p-4 shadow-2xl backdrop-blur">
          <div className="mb-3 space-y-2">
            {cart.map((line) => (
              <div key={line.item.id} className="flex items-center justify-between text-sm">
                <span className="font-bold">{line.item.name}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateCart(line.item.id, -1)} className="grid h-7 w-7 place-items-center rounded-full bg-slate-100"><Minus size={14} /></button>
                  <span className="w-5 text-center font-black">{line.quantity}</span>
                  <button onClick={() => updateCart(line.item.id, 1)} className="grid h-7 w-7 place-items-center rounded-full bg-slate-100"><Plus size={14} /></button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setCheckoutOpen(true)} className="flex w-full items-center justify-between rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white">
            <span className="flex items-center gap-2"><ShoppingBag size={18} /> Открыть корзину</span>
            <span>{rub(cartTotal)}</span>
          </button>
        </div>
      )}

      {checkoutOpen && (
        <Modal title="Оформление заказа" onClose={() => setCheckoutOpen(false)}>
          <form onSubmit={submitOrder} className="space-y-3">
            <CheckoutFields form={form} setForm={setForm} showAddress={form.deliveryType === "DELIVERY"} />
            <select value={form.deliveryType} onChange={(e) => setForm({ ...form, deliveryType: e.target.value })} className="w-full rounded-2xl border px-4 py-3 text-sm">
              <option value="PICKUP">Самовывоз</option>
              <option value="DELIVERY">Доставка</option>
            </select>
            <button className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-black text-white">Подтвердить заказ на {rub(cartTotal)}</button>
          </form>
        </Modal>
      )}

      {bookingOpen && selectedService && (
        <Modal title="Запись на услугу" onClose={() => setBookingOpen(false)}>
          <form onSubmit={submitBooking} className="space-y-3">
            <div className="rounded-2xl bg-slate-100 p-3 text-sm font-bold">{selectedService.name} · {rub(selectedService.price)}</div>
            {staff.length > 0 && (
              <select value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)} className="w-full rounded-2xl border px-4 py-3 text-sm">
                <option value="">Любой мастер</option>
                {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            )}
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full rounded-2xl border px-4 py-3 text-sm" />
            <div className="grid grid-cols-4 gap-2">
              {slots.map((time) => (
                <button type="button" key={time} onClick={() => setSelectedTime(time)} className={`rounded-xl px-2 py-2 text-xs font-bold ${selectedTime === time ? "bg-slate-950 text-white" : "bg-slate-100"}`}>
                  {time}
                </button>
              ))}
            </div>
            <CheckoutFields form={form} setForm={setForm} />
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

function CheckoutFields({
  form,
  setForm,
  showAddress = false,
}: {
  form: { firstName: string; lastName: string; phone: string; address: string; deliveryType: string; comment: string };
  setForm: (value: any) => void;
  showAddress?: boolean;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Имя" className="rounded-2xl border px-4 py-3 text-sm" />
        <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Фамилия" className="rounded-2xl border px-4 py-3 text-sm" />
      </div>
      <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+7 (999) 999-99-99" className="w-full rounded-2xl border px-4 py-3 text-sm" />
      {showAddress && <input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Адрес доставки" className="w-full rounded-2xl border px-4 py-3 text-sm" />}
      <textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="Комментарий" className="h-20 w-full resize-none rounded-2xl border px-4 py-3 text-sm" />
    </>
  );
}
