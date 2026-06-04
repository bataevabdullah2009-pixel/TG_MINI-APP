"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, Plus, Save, Truck } from "lucide-react";
import { miniAppFetch } from "@/lib/miniAppFetch";

export function SellerDeliverySettings({ businessId, onMessage }: { businessId: string; onMessage: (message: string, error?: boolean) => void }) {
  const [settings, setSettings] = useState<any>(null);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoneForm, setZoneForm] = useState({ name: "", cityArea: "", fee: "", estimatedMinutes: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await miniAppFetch(`/api/admin/delivery-settings?businessId=${encodeURIComponent(businessId)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить настройки доставки.");
      setSettings(data.settings);
      setZones(data.zones || []);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Не удалось загрузить настройки доставки.", true);
    } finally {
      setLoading(false);
    }
  }, [businessId, onMessage]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const response = await miniAppFetch("/api/admin/delivery-settings", {
      method: "PATCH",
      body: JSON.stringify({ businessId, ...settings }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return onMessage(data.error || "Не удалось сохранить настройки доставки.", true);
    setSettings(data.settings);
    onMessage("Настройки доставки сохранены.");
  };

  const addZone = async () => {
    const response = await miniAppFetch("/api/admin/delivery-zones", {
      method: "POST",
      body: JSON.stringify({ businessId, ...zoneForm }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return onMessage(data.error || "Не удалось добавить зону доставки.", true);
    setZoneForm({ name: "", cityArea: "", fee: "", estimatedMinutes: "" });
    onMessage("Зона доставки добавлена.");
    await load();
  };

  const toggleZone = async (zone: any) => {
    const response = await miniAppFetch(`/api/admin/delivery-zones/${zone.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !zone.isActive }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return onMessage(data.error || "Не удалось обновить зону.", true);
    setZones((current) => current.map((item) => item.id === zone.id ? data.zone : item));
  };

  if (loading || !settings) return <div className="rounded-3xl bg-white p-8 text-center text-xs font-black text-slate-400">Загрузка настроек доставки...</div>;

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="mb-4 flex items-center gap-2"><Truck size={17} /><h2 className="text-sm font-black">Настройки доставки</h2></div>
        <div className="space-y-3">
          <Toggle label="Доставка включена" checked={settings.deliveryEnabled} onChange={(value) => setSettings({ ...settings, deliveryEnabled: value })} />
          <Toggle label="Самовывоз включён" checked={settings.pickupEnabled} onChange={(value) => setSettings({ ...settings, pickupEnabled: value })} />
          <NumberField label="Минимальная сумма заказа для доставки" value={settings.minOrderAmount} onChange={(value) => setSettings({ ...settings, minOrderAmount: value })} />
          <NumberField label="Время ожидания самовывоза, часов" value={settings.pickupWaitHours} onChange={(value) => setSettings({ ...settings, pickupWaitHours: value })} />
          <NumberField label="Время на принятие доставки курьером, минут" value={settings.courierAcceptanceMinutes} onChange={(value) => setSettings({ ...settings, courierAcceptanceMinutes: value })} />
          <button onClick={save} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black text-white"><Save size={15} /> Сохранить настройки</button>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="mb-4 flex items-center gap-2"><MapPin size={17} /><h2 className="text-sm font-black">Зоны доставки</h2></div>
        <div className="grid gap-2">
          <input value={zoneForm.name} onChange={(event) => setZoneForm({ ...zoneForm, name: event.target.value })} placeholder="Название зоны, например Грозный" className="rounded-xl border bg-slate-50 p-3 text-xs font-bold" />
          <input value={zoneForm.cityArea} onChange={(event) => setZoneForm({ ...zoneForm, cityArea: event.target.value })} placeholder="Город / район" className="rounded-xl border bg-slate-50 p-3 text-xs font-bold" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min="0" value={zoneForm.fee} onChange={(event) => setZoneForm({ ...zoneForm, fee: event.target.value })} placeholder="Стоимость, ₽" className="rounded-xl border bg-slate-50 p-3 text-xs font-bold" />
            <input type="number" min="1" value={zoneForm.estimatedMinutes} onChange={(event) => setZoneForm({ ...zoneForm, estimatedMinutes: event.target.value })} placeholder="Время, мин." className="rounded-xl border bg-slate-50 p-3 text-xs font-bold" />
          </div>
          <button onClick={addZone} className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-xs font-black text-white"><Plus size={15} /> Добавить зону</button>
        </div>
        <div className="mt-4 grid gap-2">
          {zones.map((zone) => (
            <div key={zone.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <div className="min-w-0"><p className="truncate text-xs font-black">{zone.name}</p><p className="text-[10px] font-bold text-slate-400">{zone.cityArea} · {zone.fee} ₽{zone.estimatedMinutes ? ` · ~${zone.estimatedMinutes} мин.` : ""}</p></div>
              <button onClick={() => toggleZone(zone)} className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-black ${zone.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>{zone.isActive ? "Активна" : "Выключена"}</button>
            </div>
          ))}
          {zones.length === 0 && <p className="py-4 text-center text-xs font-bold text-slate-400">Добавьте хотя бы одну зону, чтобы доставка появилась в checkout.</p>}
        </div>
      </section>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-xs font-bold"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5" /></label>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-black uppercase text-slate-400">{label}</span><input type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-xl border bg-slate-50 p-3 text-xs font-bold" /></label>;
}
