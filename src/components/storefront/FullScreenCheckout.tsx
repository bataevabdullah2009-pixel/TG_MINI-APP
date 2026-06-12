"use client";

import type { FormEvent, ReactNode } from "react";
import { ArrowLeft, Banknote, CheckCircle2, CreditCard, MapPin, MessageSquare, PackageCheck, Phone, ShoppingBag, Store, Tag, Truck, Upload, User } from "lucide-react";
import { BottomSheetPicker } from "@/components/ui/BottomSheetPicker";

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
  deliveryZoneId: string;
  comment: string;
};

type CheckoutBusiness = {
  transferPaymentEnabled?: boolean;
  transferBankName?: string | null;
  transferPaymentPhone?: string | null;
  transferRecipientName?: string | null;
  transferPaymentInstructions?: string | null;
  settings?: {
    deliveryEnabled: boolean;
    pickupEnabled: boolean;
    minOrderAmount: number;
  } | null;
  deliveryZones?: Array<{
    id: string;
    name: string;
    cityArea: string;
    fee: number;
    minOrderAmount?: number;
    estimatedMinutes?: number | null;
    isActive: boolean;
  }>;
};

type Props = {
  business: CheckoutBusiness;
  cart: CheckoutItem[];
  cartTotal: number;
  cartCount: number;
  form: CheckoutForm;
  setForm: (value: CheckoutForm | ((current: CheckoutForm) => CheckoutForm)) => void;
  paymentMethod: "CASH" | "TRANSFER";
  setPaymentMethod: (value: "CASH" | "TRANSFER") => void;
  paymentProofUrl: string;
  paymentProofFileName: string;
  paymentProofUploading: boolean;
  onPaymentProofUpload: (file: File) => void;
  promoCode: string;
  setPromoCode: (value: string) => void;
  promoDiscountPercent: number;
  promoMessage: string;
  promoValidating: boolean;
  onApplyPromoCode: () => void;
  submitting: boolean;
  checkoutError: string;
  needsPhoneVerification: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  onVerifyPhone: () => void;
  formatPrice: (value: number) => string;
};

export function FullScreenCheckout({
  business,
  cart,
  cartTotal,
  cartCount,
  form,
  setForm,
  paymentMethod,
  setPaymentMethod,
  paymentProofUrl,
  paymentProofFileName,
  paymentProofUploading,
  onPaymentProofUpload,
  promoCode,
  setPromoCode,
  promoDiscountPercent,
  promoMessage,
  promoValidating,
  onApplyPromoCode,
  submitting,
  checkoutError,
  needsPhoneVerification,
  onSubmit,
  onClose,
  onVerifyPhone,
  formatPrice,
}: Props) {
  const updateForm = (patch: Partial<CheckoutForm>) => {
    setForm((current) => ({ ...current, ...patch }));
  };
  const zones = (business.deliveryZones || []).filter((zone) => zone.isActive);
  const selectedZone = zones.find((zone) => zone.id === form.deliveryZoneId);
  const deliveryFee = form.deliveryType === "DELIVERY" ? selectedZone?.fee || 0 : 0;
  const discountAmount = promoDiscountPercent > 0
    ? Math.round(cartTotal * promoDiscountPercent) / 100
    : 0;
  const orderTotal = Math.max(0, cartTotal - discountAmount) + deliveryFee;
  const pickupEnabled = business.settings?.pickupEnabled !== false;
  const deliveryEnabled = business.settings?.deliveryEnabled === true && zones.length > 0;
  const canSubmit =
    cart.length > 0 &&
    form.firstName.trim().length > 1 &&
    /^\+7\d{10}$/.test(form.phone.trim()) &&
    !needsPhoneVerification &&
    (pickupEnabled || deliveryEnabled) &&
    (form.deliveryType !== "DELIVERY" || (Boolean(form.deliveryZoneId) && form.address.trim().length >= 5)) &&
    (paymentMethod !== "TRANSFER" || (Boolean(paymentProofUrl) && !paymentProofUploading)) &&
    !submitting;

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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-4">
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

              <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm font-bold">
                <div className="flex justify-between text-slate-500"><span>Сумма товаров</span><span>{formatPrice(cartTotal)}</span></div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Скидка по промокоду ({promoDiscountPercent}%)</span>
                    <span>−{formatPrice(discountAmount)}</span>
                  </div>
                )}
                {form.deliveryType === "DELIVERY" && <div className="flex justify-between text-slate-500"><span>Стоимость доставки</span><span>{formatPrice(deliveryFee)}</span></div>}
                <div className="flex items-end justify-between pt-1">
                  <span className="text-sm font-black text-slate-700">Итого к оплате</span>
                  <span className="text-2xl font-black">{formatPrice(orderTotal)}</span>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-black"><Tag size={17} /> Промокод</h3>
              <div className="flex gap-2">
                <input
                  value={promoCode}
                  onChange={(event) => setPromoCode(event.target.value)}
                  placeholder="Введите промокод"
                  maxLength={32}
                  className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black uppercase outline-none focus:border-slate-400"
                />
                <button
                  type="button"
                  onClick={onApplyPromoCode}
                  disabled={promoValidating || !promoCode.trim()}
                  className="rounded-2xl bg-slate-100 px-4 py-3 text-xs font-black text-slate-800 disabled:opacity-50"
                >
                  {promoValidating ? "Проверяем..." : "Применить"}
                </button>
              </div>
              {promoMessage && (
                <p className={`rounded-xl px-3 py-2 text-xs font-bold ${promoDiscountPercent > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {promoMessage}
                </p>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-black">Способ получения</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "PICKUP", label: "Самовывоз", icon: Store, note: "Заберу сам" },
                  { value: "DELIVERY", label: "Доставка", icon: Truck, note: "Привезите мне" },
                ].filter((option) => option.value === "PICKUP" ? pickupEnabled : deliveryEnabled).map((option) => {
                  const Icon = option.icon;
                  const selected = form.deliveryType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateForm({
                        deliveryType: option.value,
                        address: option.value === "PICKUP" ? "" : form.address,
                        deliveryZoneId: option.value === "PICKUP" ? "" : form.deliveryZoneId,
                      })}
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
              {!pickupEnabled && !deliveryEnabled && (
                <p className="rounded-2xl bg-rose-50 p-3 text-xs font-bold text-rose-700">Магазин временно не принимает заказы на доставку или самовывоз.</p>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-black">Способ оплаты</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "CASH" as const, label: "Наличные", icon: Banknote },
                  { value: "TRANSFER" as const, label: "Перевод", icon: CreditCard },
                ].filter((option) => option.value !== "TRANSFER" || business.transferPaymentEnabled).map((option) => {
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

              {paymentMethod === "TRANSFER" && business.transferPaymentEnabled && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs font-bold text-emerald-950">
                  <div className="grid gap-2">
                    <div className="flex justify-between gap-3">
                      <span className="text-emerald-700">Банк</span>
                      <span className="text-right">{business.transferBankName || "не указан"}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-emerald-700">Телефон/SBP</span>
                      <span className="text-right">{business.transferPaymentPhone || "не указан"}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-emerald-700">Получатель</span>
                      <span className="text-right">{business.transferRecipientName || "не указан"}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-emerald-700">Сумма</span>
                      <span className="text-right">{formatPrice(orderTotal)}</span>
                    </div>
                  </div>
                  <p className="mt-3 rounded-xl bg-white/70 p-3 text-[11px] leading-relaxed text-emerald-900">
                    {business.transferPaymentInstructions || "После перевода загрузите чек."}
                  </p>
                  <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-3 text-xs font-black text-white active:scale-[0.98]">
                    <Upload size={16} />
                    {paymentProofUploading ? "Загружаем чек..." : paymentProofUrl ? `Чек загружен: ${paymentProofFileName || "готово"}` : "Загрузить чек перевода"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                      className="hidden"
                      disabled={paymentProofUploading}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) onPaymentProofUpload(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
              )}
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
                <input required value={form.phone} onChange={(event) => updateForm({ phone: event.target.value })} placeholder="+79991234567" className="checkout-field" />
              </Field>
              {form.deliveryType === "DELIVERY" && (
                <>
                  <Field icon={<MapPin size={17} />} label="Город / район доставки">
                    <BottomSheetPicker
                      title="Выберите зону доставки"
                      value={form.deliveryZoneId}
                      onChange={(deliveryZoneId) => updateForm({ deliveryZoneId })}
                      placeholder="Выберите зону"
                      buttonClassName="checkout-field"
                      options={zones.map((zone) => ({
                        value: zone.id,
                        label: zone.name,
                        description: `Доставка ${formatPrice(zone.fee)}`,
                        icon: <MapPin size={18} />,
                      }))}
                    />
                  </Field>
                  <Field icon={<MapPin size={17} />} label="Адрес доставки">
                    <input required value={form.address} onChange={(event) => updateForm({ address: event.target.value })} className="checkout-field" />
                  </Field>
                </>
              )}
              <Field icon={<MessageSquare size={17} />} label="Комментарий">
                <textarea value={form.comment} onChange={(event) => updateForm({ comment: event.target.value })} className="checkout-field min-h-24 resize-none" />
              </Field>
            </section>

            {needsPhoneVerification && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                <p>Подтвердите номер телефона, чтобы оформить заказ.</p>
                <button
                  type="button"
                  onClick={onVerifyPhone}
                  className="mt-3 rounded-xl bg-amber-600 px-3 py-2 text-xs font-black text-white"
                >
                  Подтвердить телефон
                </button>
              </div>
            )}

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
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white shadow-xl shadow-slate-900/15 disabled:opacity-50"
            >
              <CheckCircle2 size={18} />
              {submitting ? "Создаём заказ..." : `Подтвердить заказ на ${formatPrice(orderTotal)}`}
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
