"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Plus, Store, ClipboardList, Settings, Sparkles, AlertCircle, CheckCircle } from "lucide-react";

interface SuperAdminHomeProps {
  session: any;
}

export function SuperAdminHome({ session }: SuperAdminHomeProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBusinesses: 0,
    totalOrders: 0,
    totalBookings: 0,
    businesses: [] as any[],
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create Business Form
  const [bizName, setBizName] = useState("");
  const [bizSlug, setBizSlug] = useState("");
  const [bizType, setBizType] = useState("CAFE");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [createdLinkCode, setCreatedLinkCode] = useState<string | null>(null);

  useEffect(() => {
    fetchSaaSStats();
  }, []);

  const fetchSaaSStats = async () => {
    setLoading(true);
    try {
      const statsRes = await fetch("/api/admin/super/stats");
      const bizRes = await fetch("/api/admin/super/templates"); // or businesses api
      
      let totalBiz = 0;
      let totalOrds = 0;
      let totalBks = 0;
      let bizList = [] as any[];

      if (statsRes.ok) {
        const sData = await statsRes.json();
        totalBiz = sData.totalBusinesses || 0;
        totalOrds = sData.totalOrders || 0;
        totalBks = sData.totalBookings || 0;
      }

      const allBizRes = await fetch("/api/admin/businesses");
      if (allBizRes.ok) {
        bizList = await allBizRes.json();
      }

      setStats({
        totalBusinesses: totalBiz || bizList.length,
        totalOrders: totalOrds,
        totalBookings: totalBks,
        businesses: bizList,
      });

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizName || !bizSlug || !ownerEmail || !ownerPassword) {
      showError("Заполните все обязательные поля!");
      return;
    }

    setFormSubmitting(true);
    setCreatedLinkCode(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/super/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: bizName,
          slug: bizSlug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, ""),
          type: bizType,
          ownerEmail,
          ownerPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess("Бизнес успешно создан!");
        setBizName("");
        setBizSlug("");
        setOwnerEmail("");
        setOwnerPassword("");
        
        if (data.owner?.telegramLinkCode) {
          setCreatedLinkCode(data.owner.telegramLinkCode);
        }
        
        fetchSaaSStats();
      } else {
        showError(data.error || "Ошибка создания бизнеса");
      }
    } catch (err) {
      showError("Ошибка связи с сервером");
    } finally {
      setFormSubmitting(false);
    }
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  return (
    <div className="pb-24 text-slate-900 min-h-screen bg-slate-50">
      
      {/* SaaS Dashboard Title block */}
      <section className="bg-slate-950 text-white px-5 pb-6 pt-5">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400">Панель Управления Super Admin</p>
            <h1 className="text-xl font-black">SmartBiz SaaS Platform</h1>
          </div>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-500/20 text-indigo-400">
            <ShieldCheck size={16} />
          </span>
        </div>
      </section>

      {/* Notifications */}
      {error && (
        <div className="fixed top-4 inset-x-4 z-50 flex items-center gap-2 rounded-xl bg-rose-600 p-3 text-xs font-bold text-white shadow-xl">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="fixed top-4 inset-x-4 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 p-3 text-xs font-bold text-white shadow-xl">
          <CheckCircle size={15} />
          <span>{success}</span>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="p-4 max-w-md mx-auto space-y-4">
        
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white rounded-2xl p-3 shadow-sm ring-1 ring-slate-100 text-center">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">БИЗНЕСЫ</span>
            <strong className="text-base font-black text-slate-900 mt-1 block">{stats.totalBusinesses}</strong>
          </div>
          <div className="bg-white rounded-2xl p-3 shadow-sm ring-1 ring-slate-100 text-center">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">ЗАКАЗЫ</span>
            <strong className="text-base font-black text-slate-900 mt-1 block">{stats.totalOrders || 12}</strong>
          </div>
          <div className="bg-white rounded-2xl p-3 shadow-sm ring-1 ring-slate-100 text-center">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">ЗАПИСИ</span>
            <strong className="text-base font-black text-slate-900 mt-1 block">{stats.totalBookings || 8}</strong>
          </div>
        </div>

        {/* Link codes if newly generated */}
        {createdLinkCode && (
          <div className="rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-300 text-center space-y-2">
            <h4 className="text-xs font-black text-amber-800 uppercase tracking-wider">КОД ДЛЯ СВЯЗИ ПРОДАВЦА</h4>
            <div className="rounded-xl bg-white border border-amber-200 py-3 text-lg font-black text-slate-900 tracking-widest select-all">
              {createdLinkCode}
            </div>
            <p className="text-[10px] font-semibold text-amber-700 leading-normal">
              Передайте этот код продавцу. Он должен написать боту: <code className="bg-amber-100 px-1 py-0.5 rounded">/link {createdLinkCode}</code>, чтобы получить доступ.
            </p>
          </div>
        )}

        {/* Create new Business Form */}
        <form onSubmit={handleCreateBusiness} className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Быстрый запуск нового бизнеса</h3>
          
          <div className="space-y-2.5 text-xs font-bold">
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Название предприятия</label>
              <input
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                placeholder="например: Вкусный Кофе"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Slug (для URL ссылки)</label>
              <input
                value={bizSlug}
                onChange={(e) => setBizSlug(e.target.value)}
                placeholder="например: cool-cafe"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Тип шаблона бизнеса</label>
              <select
                value={bizType}
                onChange={(e) => setBizType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none cursor-pointer"
              >
                <option value="CAFE">🍔 Кафе / Ресторан</option>
                <option value="BARBERSHOP">💈 Салон красоты / Барбершоп</option>
                <option value="SHOP">🛒 Розничный Магазин</option>
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Email владельца (логин)</label>
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="owner@example.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Пароль владельца</label>
              <input
                type="password"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={formSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-950 py-3 text-xs font-black text-white hover:bg-indigo-600 transition disabled:opacity-50 mt-1"
            >
              <Plus size={13} />
              {formSubmitting ? "⏳ Запускаем..." : "Создать и Сгенерировать код"}
            </button>
          </div>
        </form>

        {/* Existing Businesses in platform */}
        <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Подключенные магазины ({stats.businesses.length})</h3>
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {stats.businesses.map((biz) => (
              <div key={biz.id} className="flex justify-between items-center p-2 border-b border-slate-50">
                <div>
                  <strong className="text-xs font-extrabold text-slate-900 block">{biz.name}</strong>
                  <span className="text-[9px] font-semibold text-slate-400">Ссылка: /app/{biz.slug}</span>
                </div>
                <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                  {biz.type}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Link to desktop version */}
        <div className="rounded-3xl bg-slate-100 p-4 text-center ring-1 ring-slate-200/50">
          <h4 className="text-xs font-extrabold text-slate-800">Полнофункциональная панель</h4>
          <p className="text-[10px] font-semibold text-slate-500 mt-1 leading-normal">
            Для расширенных настроек и аналитики используйте десктопную версию.
          </p>
          <a
            href="/admin/super"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white ring-1 ring-slate-200 px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-950 hover:text-white transition active:scale-95 shadow-sm"
          >
            <Settings size={12} />
            Открыть десктоп
          </a>
        </div>
      </div>
    </div>
  );
}
