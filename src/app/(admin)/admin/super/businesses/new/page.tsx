"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BottomSheetPicker } from "@/components/ui/BottomSheetPicker";

export default function OnboardWizard() {
  const router = useRouter();
  
  // General Info
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [type, setType] = useState("CAFE");
  
  // Owner info
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("owner123");
  
  // TG Integration
  const [telegramUsername, setTelegramUsername] = useState("");
  const [telegramAdminChatId, setTelegramAdminChatId] = useState("");
  
  // SaaS plan
  const [subscriptionPlan, setSubscriptionPlan] = useState("PRO");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiDailyLimit, setAiDailyLimit] = useState("30");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successData, setSuccessData] = useState<any | null>(null);

  const handleSlugSuggest = (val: string) => {
    setName(val);
    const suggested = val
      .toLowerCase()
      .trim()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    setSlug(suggested);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/super/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          type,
          ownerEmail,
          ownerPassword,
          telegramUsername,
          telegramAdminChatId,
          subscriptionPlan,
          aiEnabled,
          aiDailyLimit,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccessData(data.business);
      } else {
        throw new Error(data.error || "Не удалось создать заведение");
      }
    } catch (err: any) {
      setError(err.message || "Не удалось создать бизнес");
    } finally {
      setLoading(false);
    }
  };

  if (successData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white p-6 relative overflow-hidden font-sans">
        {/* Glow */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/20 blur-[120px]" />

        <div className="relative z-10 w-full max-w-xl">
          <Card className="bg-slate-900/60 backdrop-blur-xl border-slate-800 shadow-2xl relative overflow-hidden text-center p-8">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-500 to-indigo-500" />
            
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-4xl mb-6 text-emerald-400 animate-pulse">
              🎉
            </div>

            <h2 className="text-2xl font-black text-white mb-2">Заведение успешно создано!</h2>
            <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
              Мы создали базу данных, зарегистрировали владельца и автоматически заполнили каталог товаров по шаблону <span className="text-indigo-400 font-bold uppercase">{successData.type}</span>.
            </p>

            <div className="bg-slate-950/80 rounded-2xl p-5 border border-slate-850/80 text-left space-y-4 mb-8 font-mono text-xs">
              <div className="flex justify-between border-b border-slate-900 pb-2.5">
                <span className="text-slate-500">Название:</span>
                <span className="text-slate-200 font-bold">{successData.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-2.5">
                <span className="text-slate-500">Тип шаблона:</span>
                <span className="text-indigo-400 font-black uppercase">{successData.type}</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-2.5">
                <span className="text-slate-500">SaaS Тариф:</span>
                <span className="text-cyan-400 font-black uppercase">{successData.subscriptionPlanId || "PRO"}</span>
              </div>
              <div className="flex justify-between pb-1.5 items-start">
                <span className="text-slate-500">Mini App URL:</span>
                <Link 
                  href={`/app/${successData.slug}`} 
                  target="_blank"
                  className="text-indigo-400 font-semibold underline hover:text-indigo-300 block text-right max-w-[280px] break-all"
                >
                  /app/{successData.slug}
                </Link>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link 
                href={`/app/${successData.slug}`} 
                target="_blank"
                className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:brightness-110 text-white text-xs font-black rounded-xl text-center shadow-lg shadow-indigo-500/10 active:scale-[0.98] transition-all"
              >
                📱 Открыть Mini App
              </Link>
              <Link 
                href="/admin/super" 
                className="flex-1 py-3 px-4 bg-slate-950 hover:bg-slate-900 text-slate-300 text-xs font-bold rounded-xl text-center border border-slate-800 transition"
              >
                ← Вернуться в панель
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans relative overflow-hidden pb-16">
      {/* Glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[120px] pointer-events-none" />

      {/* Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20 pointer-events-none" />

      {/* Navigation */}
      <header className="relative z-10 max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-slate-900/60">
        <div className="flex items-center gap-3">
          <Link href="/admin/super" className="p-2 rounded-lg border border-slate-800 bg-slate-950/80 hover:bg-slate-900 text-xs font-semibold transition text-slate-400 hover:text-white">
            ← Панель
          </Link>
          <span className="text-slate-700">/</span>
          <h1 className="font-extrabold text-base">🪄 Подключение точки продаж</h1>
        </div>
      </header>

      {/* Wizard Form */}
      <main className="relative z-10 max-w-3xl mx-auto px-6 mt-8">
        <Card className="bg-slate-900/40 backdrop-blur-md border-slate-850 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500" />
          
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* SECTION 1: BUSINESS GENERAL INFO */}
              <div>
                <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-4">1. Информация о бизнесе</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Название бизнеса</label>
                    <input
                      type="text"
                      placeholder="Например: سلطان Burger"
                      required
                      value={name}
                      onChange={(e) => handleSlugSuggest(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-850 text-white placeholder-slate-600 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Короткая ссылка (slug)</label>
                    <input
                      type="text"
                      placeholder="Например: sultan-burger"
                      required
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-850 text-white placeholder-slate-600 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-300 font-mono"
                    />
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Отраслевой шаблон (Mini App UI)</label>
                  <BottomSheetPicker
                    title="Выберите тип бизнеса"
                    value={type}
                    onChange={setType}
                    buttonClassName="rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs text-white"
                    options={[
                      { value: "CAFE", label: "Кафе и фастфуд", description: "Витрина, корзина и доставка" },
                      { value: "BARBERSHOP", label: "Барбершоп и салон", description: "Услуги и календарь записи" },
                      { value: "SHOP", label: "Локальный магазин", description: "Каталог, корзина и склад" },
                      { value: "GROCERY", label: "Продовольственный маркет", description: "Каталог и корзина" },
                      { value: "HARDWARE_STORE", label: "Хозмаг и строительный", description: "Поиск и AI-консультант" },
                      { value: "CARWASH", label: "Автомойка и сервис", description: "Услуги и онлайн-запись" },
                    ]}
                  />
                </div>
              </div>

              <div className="border-t border-slate-850/80 my-6" />

              {/* SECTION 2: OWNER ACCESS */}
              <div>
                <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-4">2. Аккаунт владельца</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Email владельца</label>
                    <input
                      type="email"
                      placeholder="owner@company.com"
                      required
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-850 text-white placeholder-slate-600 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Пароль владельца</label>
                    <input
                      type="password"
                      placeholder="owner123"
                      required
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-850 text-white placeholder-slate-600 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-300 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-850/80 my-6" />

              {/* SECTION 3: TG BOT & SAAS TERMS */}
              <div>
                <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-4">3. Telegram & SaaS Параметры</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Username бота (без @)</label>
                    <input
                      type="text"
                      placeholder="MyStore_bot"
                      value={telegramUsername}
                      onChange={(e) => setTelegramUsername(e.target.value.replace(/^@/, ""))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-850 text-white placeholder-slate-600 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">ID Чат-администратора (TG Chat ID)</label>
                    <input
                      type="text"
                      placeholder="Например: 8229830002"
                      value={telegramAdminChatId}
                      onChange={(e) => setTelegramAdminChatId(e.target.value.replace(/[^0-9-]/g, ""))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-850 text-white placeholder-slate-600 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-300 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Тарифный план</label>
                    <select
                      value={subscriptionPlan}
                      onChange={(e) => setSubscriptionPlan(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-850 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-300"
                    >
                      <option value="START">START (Бесплатный)</option>
                      <option value="PRO">PRO (Рекомендуемый)</option>
                      <option value="BUSINESS">BUSINESS (Премиум)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">ИИ-ассистент</label>
                    <select
                      value={aiEnabled ? "yes" : "no"}
                      onChange={(e) => setAiEnabled(e.target.value === "yes")}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-850 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-300"
                    >
                      <option value="yes">Включен для заведения</option>
                      <option value="no">Отключен</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">ИИ-Лимит (запросов/день)</label>
                    <input
                      type="number"
                      value={aiDailyLimit}
                      onChange={(e) => setAiDailyLimit(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-850 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-300 font-mono"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-medium">
                  ⚠️ {error}
                </div>
              )}

              <div className="pt-4 flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-4 px-6 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:brightness-110 text-white font-extrabold text-sm shadow-xl shadow-indigo-500/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Развертывание витрины и базы данных...
                    </>
                  ) : (
                    "🪄 Создать точку & Сгенерировать контент"
                  )}
                </button>
                
                <Link 
                  href="/admin/super" 
                  className="px-6 py-4 rounded-xl bg-slate-950 border border-slate-850 hover:bg-slate-900 font-bold text-slate-400 hover:text-white text-sm transition text-center"
                >
                  Отмена
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
