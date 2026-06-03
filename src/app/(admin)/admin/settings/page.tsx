"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ImagePlus, Save, Send, Sparkles, AlertCircle, CheckCircle } from "lucide-react";
import { AccessDeniedScreen } from "@/components/app/AccessDeniedScreen";

type Business = {
  id: string;
  name: string;
  description?: string | null;
  phone?: string | null;
  address?: string | null;
  isOpen?: boolean;
  primaryColor: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  telegramBotToken?: string | null;
  telegramBotUsername?: string | null;
  telegramUsername?: string | null;
  telegramAdminChatId?: string | null;
};

export default function AdminSettingsPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    phone: "",
    address: "",
    isOpen: true,
    primaryColor: "#111827",
    logoUrl: "",
    coverImageUrl: "",
    telegramBotToken: "",
    telegramBotUsername: "",
    telegramUsername: "",
    telegramAdminChatId: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  function syncForm(current: Business) {
    setBusiness(current);
    setForm({
      name: current.name || "",
      description: current.description || "",
      phone: current.phone || "",
      address: current.address || "",
      isOpen: current.isOpen === undefined ? true : current.isOpen,
      primaryColor: current.primaryColor || "#111827",
      logoUrl: current.logoUrl || "",
      coverImageUrl: current.coverImageUrl || "",
      telegramBotToken: current.telegramBotToken || "",
      telegramBotUsername: current.telegramBotUsername || "",
      telegramUsername: current.telegramUsername || "",
      telegramAdminChatId: current.telegramAdminChatId || "",
    });
  }

  async function load() {
    try {
      const userJson = localStorage.getItem("adminUser");
      if (userJson) {
        const u = JSON.parse(userJson);
        if (u.role === "MANAGER") {
          setIsManager(true);
          setLoading(false);
          return;
        }
      }
      const res = await fetch("/api/admin/current-business");
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Не удалось загрузить настройки.");
      const current = data.data;
      syncForm(current);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function upload(file: File, type: "logo" | "cover") {
    if (!business) return;
    const data = new FormData();
    data.append("file", file);
    data.append("type", type);
    data.append("businessId", business.id);
    const res = await fetch("/api/admin/media/upload", { method: "POST", body: data });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || "Не удалось загрузить файл.");
    setForm((current) => ({ ...current, [type === "logo" ? "logoUrl" : "coverImageUrl"]: json.data.url }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/current-business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: business?.id, ...form }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Не удалось сохранить настройки.");
      if (data.data) syncForm(data.data);
      await load();
      setSuccess("Настройки сохранены");
      setTimeout(() => setSuccess(""), 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function registerWebhook() {
    if (!business) return;
    setWebhookLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/current-business/set-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: business.id,
          origin: window.location.origin,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Не удалось настроить Webhook.");
      setSuccess("🔥 Telegram Webhook успешно настроен! Бот готов принимать сообщения и открывать Mini App.");
      setTimeout(() => setSuccess(""), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setWebhookLoading(false);
    }
  }

  if (isManager) {
    return (
      <AccessDeniedScreen
        backUrl="/admin"
        backText="Вернуться в панель"
        description="Менеджеры не могут изменять настройки, slug или конфигурации оплаты бизнеса."
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-5 py-4">
          <Link href="/admin" className="text-sm font-semibold text-slate-500 hover:text-slate-950 transition-colors">← Назад в панель</Link>
          <h1 className="text-2xl font-black mt-1">Настройки бизнеса</h1>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-6">
        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-500">Загрузка настроек...</div>
        ) : (
          <form onSubmit={save} className="space-y-5">
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 flex items-start gap-2.5">
                <AlertCircle className="shrink-0 mt-0.5" size={17} />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700 flex items-start gap-2.5">
                <CheckCircle className="shrink-0 mt-0.5" size={17} />
                <span>{success}</span>
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
              <div className="space-y-5">
                {/* Profile Card */}
                <div className="rounded-3xl border bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-lg font-black flex items-center gap-2">
                    <span>🏢</span> Основные данные
                  </h2>
                  <div className="grid gap-4">
                    <label className="text-sm font-bold text-slate-700">
                      Название компании *
                      <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400" placeholder="Например, Свежий Кофе" />
                    </label>
                    <label className="text-sm font-bold text-slate-700">
                      Описание заведения / бизнеса
                      <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="field mt-1 min-h-28 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400" placeholder="Расскажите клиентам о вашем заведении, графике, преимуществах..." />
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="text-sm font-bold text-slate-700">
                        Контактный телефон
                        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="field mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400" placeholder="+7 (999) 000-00-00" />
                      </label>
                      <label className="text-sm font-bold text-slate-700">
                        Физический адрес
                        <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="field mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400" placeholder="Город, улица, дом..." />
                      </label>
                    </div>
                    <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                      <span>Заведение открыто</span>
                      <input
                        type="checkbox"
                        checked={form.isOpen}
                        onChange={(e) => setForm({ ...form, isOpen: e.target.checked })}
                        className="h-5 w-5 rounded border-slate-300"
                      />
                    </label>
                    <label className="text-sm font-bold text-slate-700">
                      Основной цвет оформления Mini App витрины
                      <div className="flex items-center gap-3 mt-1">
                        <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="h-12 w-24 cursor-pointer rounded-xl border p-1" />
                        <span className="text-xs text-slate-500 font-mono font-bold uppercase">{form.primaryColor}</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Telegram Bot Integration Card */}
                <div className="rounded-3xl border bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-lg font-black flex items-center gap-2">
                    <Send className="text-sky-500 shrink-0" size={20} />
                    Интеграция с Telegram
                  </h2>
                  <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                    Настройте личного Telegram-бота, чтобы клиенты открывали витрину прямо в нём, а вы и клиенты получали мгновенные уведомления о статусах заказов и записей.
                  </p>

                  <div className="grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="text-sm font-bold text-slate-700">
                        Токен Telegram-бота (из @BotFather)
                        <input type="password" value={form.telegramBotToken} onChange={(e) => setForm({ ...form, telegramBotToken: e.target.value })} className="field mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400" placeholder="123456789:ABCdefGhIJKlmNoPQRsT..." />
                      </label>
                      <label className="text-sm font-bold text-slate-700">
                        Юзернейм бота (без @)
                        <input value={form.telegramBotUsername} onChange={(e) => setForm({ ...form, telegramBotUsername: e.target.value })} className="field mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400" placeholder="my_shop_bot" />
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="text-sm font-bold text-slate-700">
                        Telegram ID Продавца (для уведомлений)
                        <input value={form.telegramAdminChatId} onChange={(e) => setForm({ ...form, telegramAdminChatId: e.target.value })} className="field mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400" placeholder="123456789 (узнайте в @userinfobot)" />
                      </label>
                      <label className="text-sm font-bold text-slate-700">
                        Юзернейм продавца в Telegram (без @)
                        <input value={form.telegramUsername} onChange={(e) => setForm({ ...form, telegramUsername: e.target.value })} className="field mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400" placeholder="my_personal_account" />
                      </label>
                    </div>

                    {form.telegramBotToken && (
                      <div className="mt-4 rounded-2xl border border-dashed border-sky-200 bg-sky-50 p-4">
                        <h4 className="text-sm font-black text-sky-950 mb-1 flex items-center gap-1.5">
                          <Sparkles className="text-sky-600" size={16} />
                          Автоматическое подключение бота в 1 клик
                        </h4>
                        <p className="text-xs text-sky-850 mb-3 leading-relaxed">
                          Нажмите кнопку ниже, чтобы привязать бота к вашему текущему домену. Система мгновенно настроит Webhook на Telegram API, и бот начнёт отвечать!
                        </p>
                        <button type="button" onClick={registerWebhook} disabled={webhookLoading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-[0.98] transition px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">
                          {webhookLoading ? "Подключение..." : "🔗 Подключить Telegram Webhook"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar Media */}
              <div className="space-y-5">
                <UploadBox title="Логотип заведения" url={form.logoUrl} onFile={(file) => upload(file, "logo").catch((err) => setError(err.message))} />
                <UploadBox title="Обложка Mini App" url={form.coverImageUrl} onFile={(file) => upload(file, "cover").catch((err) => setError(err.message))} />
              </div>
            </div>

            <div className="pt-3">
              <button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 hover:bg-slate-900 active:scale-[0.99] transition px-5 py-4 text-sm font-black text-white disabled:opacity-50 md:w-auto">
                <Save size={18} />
                {saving ? "Сохраняем изменения..." : "Сохранить изменения"}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

function UploadBox({ title, url, onFile }: { title: string; url: string; onFile: (file: File) => void }) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-black">{title}</h2>
      <div className="mb-3 h-36 overflow-hidden rounded-2xl bg-slate-100 border flex items-center justify-center relative">
        {url ? (
          <img src={url} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-xs font-bold text-slate-400">Нет изображения</div>
        )}
      </div>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] transition px-4 py-3 text-xs font-black text-slate-700">
        <ImagePlus size={16} />
        Загрузить файл
        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
    </div>
  );
}
