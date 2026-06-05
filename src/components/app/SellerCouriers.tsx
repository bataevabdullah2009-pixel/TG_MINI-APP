"use client";

import { useCallback, useEffect, useState } from "react";
import { Bike, Plus, Phone, Trash2, User } from "lucide-react";
import { miniAppFetch } from "@/lib/miniAppFetch";

export function SellerCouriers({ businessId, onMessage }: { businessId: string; onMessage: (message: string, error?: boolean) => void }) {
  const [couriers, setCouriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", phone: "", telegramId: "", cityArea: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await miniAppFetch(`/api/admin/couriers?businessId=${encodeURIComponent(businessId)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить курьеров.");
      setCouriers(data.couriers || []);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Не удалось загрузить курьеров.", true);
    } finally {
      setLoading(false);
    }
  }, [businessId, onMessage]);

  useEffect(() => { load(); }, [load]);

  const addCourier = async () => {
    const response = await miniAppFetch("/api/admin/couriers", {
      method: "POST",
      body: JSON.stringify({ businessId, ...form }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return onMessage(data.error || "Не удалось добавить курьера.", true);
    setForm({ name: "", phone: "", telegramId: "", cityArea: "" });
    onMessage("Курьер добавлен.");
    await load();
  };

  const toggleCourier = async (courier: any) => {
    const response = await miniAppFetch(`/api/admin/couriers/${courier.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !courier.isActive }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return onMessage(data.error || "Не удалось обновить курьера.", true);
    setCouriers((current) => current.map((item) => item.id === courier.id ? data.courier : item));
  };

  const deleteCourier = async (courier: any) => {
    if (!window.confirm(`Удалить курьера «${courier.name}»? История завершённых доставок сохранится.`)) return;
    const response = await miniAppFetch(`/api/admin/couriers/${courier.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return onMessage(data.error || "Не удалось удалить курьера.", true);
    setCouriers((current) => current.filter((item) => item.id !== courier.id));
    onMessage(data.archived ? "Курьер отключён, история доставок сохранена." : "Курьер удалён.");
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="mb-4 flex items-center gap-2"><Bike size={18} /><h2 className="text-sm font-black">Добавить курьера</h2></div>
        <div className="grid gap-2">
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Имя курьера" className="rounded-xl border bg-slate-50 p-3 text-xs font-bold" />
          <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Телефон" className="rounded-xl border bg-slate-50 p-3 text-xs font-bold" />
          <input value={form.telegramId} onChange={(event) => setForm({ ...form, telegramId: event.target.value })} placeholder="Telegram ID, если есть" className="rounded-xl border bg-slate-50 p-3 text-xs font-bold" />
          <input value={form.cityArea} onChange={(event) => setForm({ ...form, cityArea: event.target.value })} placeholder="Город / район работы" className="rounded-xl border bg-slate-50 p-3 text-xs font-bold" />
          <button onClick={addCourier} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black text-white"><Plus size={15} /> Добавить курьера</button>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-4 text-sm font-black">Курьеры ({couriers.length})</h2>
        {loading ? <p className="py-6 text-center text-xs font-bold text-slate-400">Загрузка...</p> : <div className="grid gap-2">
          {couriers.map((courier) => (
            <article key={courier.id} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="flex items-center gap-1 text-xs font-black"><User size={13} /> {courier.name}</p><a href={`tel:${courier.phone}`} className="mt-1 flex items-center gap-1 text-[10px] font-bold text-indigo-600"><Phone size={11} /> {courier.phone}</a><p className="mt-1 text-[10px] font-bold text-slate-400">{courier.cityArea || "Все зоны"}{courier.telegramId ? ` · TG ${courier.telegramId}` : " · Telegram ID не указан"}</p></div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button onClick={() => toggleCourier(courier)} className={`rounded-full px-3 py-1 text-[9px] font-black ${courier.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>{courier.isActive ? "Активен" : "Не активен"}</button>
                  <button onClick={() => deleteCourier(courier)} className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-600" title="Удалить курьера"><Trash2 size={13} /></button>
                </div>
              </div>
              {courier.assignments?.length > 0 && <p className="mt-2 rounded-xl bg-white p-2 text-[10px] font-bold text-slate-600">Активных заказов: {courier.assignments.length}</p>}
            </article>
          ))}
          {couriers.length === 0 && <p className="py-6 text-center text-xs font-bold text-slate-400">Курьеры ещё не добавлены.</p>}
        </div>}
      </section>
    </div>
  );
}
