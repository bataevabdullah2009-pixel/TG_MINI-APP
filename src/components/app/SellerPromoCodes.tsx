"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Percent, Plus, Tag, Trash2 } from "lucide-react";
import { miniAppFetch } from "@/lib/miniAppFetch";

type PromoCode = {
  id: string;
  code: string;
  discountPercent: number;
  isActive: boolean;
  usageLimit: number | null;
  usageCount: number;
  expiresAt: string | null;
  archivedAt: string | null;
};

export function SellerPromoCodes({
  businessId,
  onMessage,
}: {
  businessId: string;
  onMessage: (message: string, error?: boolean) => void;
}) {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: "", discountPercent: "10", usageLimit: "", expiresAt: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await miniAppFetch(`/api/admin/promo-codes?businessId=${encodeURIComponent(businessId)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить промокоды.");
      setPromoCodes(data.promoCodes || []);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Не удалось загрузить промокоды.", true);
    } finally {
      setLoading(false);
    }
  }, [businessId, onMessage]);

  useEffect(() => {
    load();
  }, [load]);

  const createPromoCode = async () => {
    setSaving(true);
    try {
      const response = await miniAppFetch("/api/admin/promo-codes", {
        method: "POST",
        body: JSON.stringify({
          businessId,
          code: form.code,
          discountPercent: Number(form.discountPercent),
          usageLimit: form.usageLimit,
          expiresAt: form.expiresAt || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Не удалось создать промокод.");
      setPromoCodes((current) => [data.promoCode, ...current]);
      setForm({ code: "", discountPercent: "10", usageLimit: "", expiresAt: "" });
      onMessage(`Промокод ${data.promoCode.code} создан.`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Не удалось создать промокод.", true);
    } finally {
      setSaving(false);
    }
  };

  const togglePromoCode = async (promoCode: PromoCode) => {
    const previous = promoCodes;
    setPromoCodes((current) => current.map((item) => item.id === promoCode.id ? { ...item, isActive: !item.isActive } : item));
    try {
      const response = await miniAppFetch(`/api/admin/promo-codes/${promoCode.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !promoCode.isActive }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Не удалось обновить промокод.");
      setPromoCodes((current) => current.map((item) => item.id === promoCode.id ? data.promoCode : item));
    } catch (error) {
      setPromoCodes(previous);
      onMessage(error instanceof Error ? error.message : "Не удалось обновить промокод.", true);
    }
  };

  const archivePromoCode = async (promoCode: PromoCode) => {
    if (!window.confirm(`Архивировать промокод «${promoCode.code}»?`)) return;
    try {
      const response = await miniAppFetch(`/api/admin/promo-codes/${promoCode.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Не удалось архивировать промокод.");
      setPromoCodes((current) => current.map((item) => item.id === promoCode.id ? data.promoCode : item));
      onMessage("Промокод архивирован.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Не удалось архивировать промокод.", true);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="mb-4 flex items-center gap-2">
          <Tag size={17} />
          <div>
            <h2 className="text-sm font-black">Новый промокод</h2>
            <p className="text-[10px] font-bold text-slate-400">Оставьте код пустым, чтобы сгенерировать автоматически.</p>
          </div>
        </div>
        <div className="grid gap-2">
          <input
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
            placeholder="Код, например LETO20"
            maxLength={32}
            className="rounded-xl border bg-slate-50 p-3 text-xs font-black uppercase"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="rounded-xl border bg-slate-50 p-3">
              <span className="mb-1 flex items-center gap-1 text-[9px] font-black uppercase text-slate-400"><Percent size={11} /> Скидка</span>
              <input type="number" min="1" max="90" value={form.discountPercent} onChange={(event) => setForm({ ...form, discountPercent: event.target.value })} className="w-full bg-transparent text-xs font-black outline-none" />
            </label>
            <label className="rounded-xl border bg-slate-50 p-3">
              <span className="mb-1 block text-[9px] font-black uppercase text-slate-400">Лимит</span>
              <input type="number" min="1" value={form.usageLimit} onChange={(event) => setForm({ ...form, usageLimit: event.target.value })} placeholder="Без лимита" className="w-full bg-transparent text-xs font-black outline-none" />
            </label>
          </div>
          <label className="rounded-xl border bg-slate-50 p-3">
            <span className="mb-1 block text-[9px] font-black uppercase text-slate-400">Действует до</span>
            <input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} className="w-full bg-transparent text-xs font-black outline-none" />
          </label>
          <button type="button" onClick={createPromoCode} disabled={saving} className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">
            <Plus size={15} /> {saving ? "Создаём..." : form.code ? "Создать промокод" : "Сгенерировать промокод"}
          </button>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-4 text-sm font-black">Промокоды</h2>
        {loading ? (
          <div className="py-8 text-center text-xs font-bold text-slate-400">Загрузка промокодов...</div>
        ) : promoCodes.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 p-6 text-center text-xs font-bold text-slate-400">Промокодов пока нет.</div>
        ) : (
          <div className="grid gap-2">
            {promoCodes.map((promoCode) => (
              <article key={promoCode.id} className={`rounded-2xl p-3 ring-1 ${promoCode.archivedAt ? "bg-slate-100 text-slate-400 ring-slate-200" : "bg-slate-50 ring-slate-100"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                      <button type="button" onClick={() => navigator.clipboard.writeText(promoCode.code)} className="inline-flex items-center gap-1 text-sm font-black text-slate-900" aria-label={`Скопировать промокод ${promoCode.code}`}>
                      {promoCode.code} <Copy size={12} />
                    </button>
                    <p className="mt-1 text-[10px] font-bold text-slate-500">
                      Скидка {promoCode.discountPercent}% · использовано {promoCode.usageCount}{promoCode.usageLimit ? ` из ${promoCode.usageLimit}` : ""}
                    </p>
                    {promoCode.expiresAt && <p className="mt-1 text-[9px] font-bold text-slate-400">До {new Date(promoCode.expiresAt).toLocaleString("ru-RU")}</p>}
                  </div>
                  {!promoCode.archivedAt && (
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => togglePromoCode(promoCode)} className={`rounded-full px-3 py-1 text-[9px] font-black ${promoCode.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                        {promoCode.isActive ? "Активен" : "Выключен"}
                      </button>
                      <button type="button" onClick={() => archivePromoCode(promoCode)} className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-600" aria-label={`Архивировать промокод ${promoCode.code}`}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
