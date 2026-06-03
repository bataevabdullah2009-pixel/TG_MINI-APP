"use client";

import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { ArrowLeft, Banknote, CheckCircle2, CreditCard, MapPin, MessageSquare, PackageCheck, Phone, ShoppingBag, Store, Truck, User } from "lucide-react";

type CheckoutItem = {
  item: {
    id: string;
    name: string;
    price: number;
    imageUrl?: string | null;
  };
  quantity: number;
};

type CheckoutForm = {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  deliveryType: string;
  comment: string;
};

type Props = {
  cart: CheckoutItem[];
  cartTotal: number;
  cartCount: number;
  form: CheckoutForm;
  setForm: (value: CheckoutForm | ((current: CheckoutForm) => CheckoutForm)) => void;
  checkoutError: string;
  needsPhoneVerification: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  onVerifyPhone: () => void;
  formatPrice: (value: number) => string;
};

export function FullScreenCheckout({
  cart,
  cartTotal,
  cartCount,
  form,
  setForm,
  checkoutError,
  needsPhoneVerification,
  onSubmit,
  onClose,
  onVerifyPhone,
  formatPrice,
}: Props) {
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");

  const updateForm = (patch: Partial<CheckoutForm>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-white text-slate-950">
      <form onSubmit={onSubmit} className="flex h-full flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-700 active:scale-95"
              aria-label="Назад"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <h2 className="text-lg font-black leading-tight">Оформление заказа</h2>
              <p className="text-xs font-bold text-slate-400">{cartCount} поз. в корзине</p>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-32 pt-4">
          <div className="mx-auto max-w-3xl space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-sm font-black">
                  <ShoppingBag size={17} />
                  Сводка заказа
                </h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-200">
                  {cartCount} шт.
                </span>
              </div>

              <div className="space-y-2">
                {cart.map((line) => (
                  <div key={line.item.id} className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200/70">
                    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100">
                      {line.item.imageUrl ? (
                        <img src={line.item.imageUrl} alt={line.item.name} className="h-full w-full object-cover" />
                      ) : (
                        <PackageCheck size={19} className="text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black">{line.item.name}</p>
                      <p className="text-xs font-bold text-slate-400">x {line.quantity}</p>
                    </div>
                    <p className="shrink-0 text-sm font-black">{formatPrice(line.item.price * line.quantity)}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-end justify-between border-t border-slate-200 pt-4">
                <span className="text-sm font-bold text-slate-500">Итого к оплате</span>
                <span className="text-2xl font-black">{formatPrice(cartTotal)}</span>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-black">Способ получения</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "PICKUP", label: "Самовывоз", icon: Store, note: "Заберу сам" },
                  { value: "DELIVERY", label: "Доставка", icon: Truck, note: "Привезите мне" },
                ].map((option) => {
                  const Icon = option.icon;
                  const selected = form.deliveryType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateForm({ deliveryType: option.value, address: option.value === "PICKUP" ? "" : form.address })}
                      className={`rounded-2xl border p-4 text-left transition active:scale-[0.98] ${
                        selected ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      <Icon size={20} />
                      <span className="mt-3 block text-sm font-black">{option.label}</span>
                      <span className={`mt-1 block text-xs font-bold ${selected ? "text-white/65" : "text-slate-400"}`}>{option.note}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-black">Способ оплаты</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "CASH" as const, label: "Наличные", icon: Banknote },
                  { value: "TRANSFER" as const, label: "Перевод", icon: CreditCard },
                ].map((option) => {
                  const Icon = option.icon;
                  const selected = paymentMethod === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPaymentMethod(option.value)}
                      className={`flex items-center gap-3 rounded-2xl border p-4 text-sm font-black transition active:scale-[0.98] ${
                        selected ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      <Icon size={20} />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-black">Данные получателя</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field icon={<User size={17} />} label="Имя">
                  <input required value={form.firstName} onChange={(event) => updateForm({ firstName: event.target.value })} className="checkout-field" />
                </Field>
                <Field icon={<User size={17} />} label="Фамилия">
                  <input value={form.lastName} onChange={(event) => updateForm({ lastName: event.target.value })} className="checkout-field" />
                </Field>
              </div>
              <Field icon={<Phone size={17} />} label="Телефон">
                <input required value={form.phone} onChange={(event) => updateForm({ phone: event.target.value })} placeholder="+7 (999) 999-99-99" className="checkout-field" />
              </Field>
              {form.deliveryType === "DELIVERY" && (
                <Field icon={<MapPin size={17} />} label="Адрес доставки">
                  <input required value={form.address} onChange={(event) => updateForm({ address: event.target.value })} className="checkout-field" />
                </Field>
              )}
              <Field icon={<MessageSquare size={17} />} label="Комментарий">
                <textarea value={form.comment} onChange={(event) => updateForm({ comment: event.target.value })} className="checkout-field min-h-24 resize-none" />
              </Field>
            </section>

            {checkoutError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                {checkoutError}
                {needsPhoneVerification && (
                  <button
                    type="button"
                    onClick={onVerifyPhone}
                    className="mt-3 inline-flex rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white"
                  >
                    Подтвердить номер
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto max-w-3xl">
            <button
              type="submit"
              disabled={cart.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white shadow-xl shadow-slate-900/15 disabled:opacity-50"
            >
              <CheckCircle2 size={18} />
              Подтвердить заказ на {formatPrice(cartTotal)}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <label className="block rounded-2xl border border-slate-200 bg-white px-3 py-2">
      <span className="mb-1 flex items-center gap-2 text-xs font-black text-slate-400">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
