"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ImagePlus, Plus, RefreshCw, Save, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { formatPrice } from "@/lib/utils";
import { AccessDeniedScreen } from "@/components/app/AccessDeniedScreen";

type Business = {
  id: string;
  slug: string;
  name: string;
  type: string;
  templateKey: string;
};

type Item = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  type: "PRODUCT" | "SERVICE";
  isAvailable: boolean;
  isPopular: boolean;
  stock?: number | null;
  durationMinutes?: number | null;
  category?: { id: string; name: string } | null;
};

type FormState = {
  type: "PRODUCT" | "SERVICE";
  name: string;
  description: string;
  price: string;
  stock: string;
  durationMinutes: string;
  isPopular: boolean;
  isAvailable: boolean;
  imageUrl: string;
  categoryId: string;
};

const initialForm: FormState = {
  type: "PRODUCT",
  name: "",
  description: "",
  price: "",
  stock: "",
  durationMinutes: "",
  isPopular: false,
  isAvailable: true,
  imageUrl: "",
  categoryId: "",
};

function apiError(error: any) {
  return error?.response?.data?.error || error?.message || "Не удалось выполнить действие.";
}

export default function AdminItemsPage() {
  const router = useRouter();
  const [isManager, setIsManager] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "PRODUCT" | "SERVICE">("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  async function handleAiGenerate() {
    if (!aiPrompt.trim() || !business) return;
    setAiLoading(true);
    setAiError("");
    try {
      const textRes = await fetch("/api/ai/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: business.id,
          prompt: aiPrompt,
          type: "product_card",
        }),
      });

      const textData = await textRes.json();
      if (!textRes.ok || textData.error) {
        throw new Error(textData.error || "Не удалось сгенерировать текст карточки.");
      }

      setForm((current) => ({
        ...current,
        name: textData.name || aiPrompt,
        description: textData.description || "",
      }));

      if (textData.category && categories.length > 0) {
        const foundCategory = categories.find(
          (c) => c.name.toLowerCase().includes(textData.category.toLowerCase()) || 
                 textData.category.toLowerCase().includes(c.name.toLowerCase())
        );
        if (foundCategory) {
          setForm((current) => ({ ...current, categoryId: foundCategory.id }));
        }
      }

      if (textData.imagePrompt) {
        try {
          const imgRes = await fetch("/api/admin/ai/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessId: business.id,
              prompt: textData.imagePrompt,
            }),
          });
          const imgData = await imgRes.json();
          if (imgRes.ok && imgData.ok && imgData.data?.url) {
            setForm((current) => ({ ...current, imageUrl: imgData.data.url }));
            setToast("Карточка и изображение успешно созданы!");
            setTimeout(() => setToast(""), 2500);
          } else {
            setAiError(`Текст создан, но изображение не создано: ${imgData.error || "Ошибка генерации фото"}`);
          }
        } catch (imgErr: any) {
          setAiError(`Текст создан, но изображение не создано: ${imgErr.message || "Ошибка сети при генерации фото"}`);
        }
      } else {
        setToast("Карточка товара успешно сгенерирована!");
        setTimeout(() => setToast(""), 2500);
      }
    } catch (err: any) {
      setAiError(err.message || "Ошибка ИИ-генерации.");
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    const userJson = localStorage.getItem("adminUser");
    if (!userJson) {
      router.push("/admin/login");
      return;
    }
    const u = JSON.parse(userJson);
    setUserRole(u.role || "");
    if (u.role === "MANAGER") {
      setIsManager(true);
      setLoading(false);
      return;
    }
    loadBusinesses();
  }, [router]);

  async function loadBusinesses() {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/admin/businesses");
      const list: Business[] = res.data?.data || [];
      setBusinesses(list);
      const first = list[0] || null;
      setBusiness(first);
      if (first) {
        await Promise.all([loadItems(first.id), loadCategories(first.id)]);
      }
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories(businessId = business?.id) {
    if (!businessId) return;
    try {
      const res = await apiClient.get(`/businesses/${businessId}/catalog`);
      setCategories(res.data?.categories || []);
    } catch (err) {
      console.error("Failed to load business categories:", err);
    }
  }

  async function loadItems(businessId = business?.id) {
    if (!businessId) return;
    setError("");
    try {
      const res = await apiClient.get(`/admin/items?businessId=${businessId}`);
      setItems(res.data?.data || []);
    } catch (err) {
      setError(apiError(err));
    }
  }

  async function selectBusiness(next: Business) {
    setBusiness(next);
    setLoading(true);
    await Promise.all([loadItems(next.id), loadCategories(next.id)]);
    setLoading(false);
  }

  async function toggleItem(item: Item, patch: Partial<Item>) {
    try {
      const res = await apiClient.patch(`/admin/items/${item.id}`, patch);
      const updated = res.data?.data;
      setItems((current) => current.map((entry) => (entry.id === item.id ? updated : entry)));
    } catch (err) {
      setError(apiError(err));
    }
  }

  async function uploadImage(file: File) {
    if (!business) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", form.type === "SERVICE" ? "service" : "product");
    formData.append("businessId", business.id);
    const res = await fetch("/api/admin/media/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "Не удалось загрузить фото.");
    setForm((current) => ({ ...current, imageUrl: data.data.url }));
  }

  async function createItem(event: FormEvent) {
    event.preventDefault();
    if (!business) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiClient.post("/admin/items", {
        businessId: business.id,
        ...form,
        price: Number(form.price),
        stock: form.type === "PRODUCT" ? form.stock : "",
        durationMinutes: form.type === "SERVICE" ? form.durationMinutes : "",
      });
      setItems((current) => [res.data.data, ...current]);
      setForm(initialForm);
      setModalOpen(false);
      setToast("Сохранено");
      setTimeout(() => setToast(""), 2500);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      const typeMatch = filter === "ALL" || item.type === filter;
      const searchMatch = !needle || item.name.toLowerCase().includes(needle) || (item.description || "").toLowerCase().includes(needle);
      return typeMatch && searchMatch;
    });
  }, [items, search, filter]);

  const isBookingBusiness = business?.templateKey === "barbershop" || business?.templateKey === "carwash";

  if (isManager) {
    return (
      <AccessDeniedScreen 
        backUrl="/admin" 
        backText="Вернуться в панель" 
        description="Менеджеры не имеют доступа к добавлению, изменению или удалению товаров и услуг." 
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <Link href="/admin" className="text-sm font-semibold text-slate-500 hover:text-slate-950">Назад в панель</Link>
            <h1 className="text-2xl font-black">Товары и услуги</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => loadItems()} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-slate-600">
              <RefreshCw size={17} />
            </button>
            <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white">
              <Plus size={17} />
              Добавить
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-bold">Что-то пошло не так</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {toast && <div className="fixed right-5 top-20 z-30 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg">{toast}</div>}

        <div className={`mb-5 grid gap-3 rounded-2xl border bg-white p-4 ${userRole === "SUPER_ADMIN" && businesses.length > 1 ? "md:grid-cols-[1fr_auto]" : "grid-cols-1"}`}>
          {userRole === "SUPER_ADMIN" && businesses.length > 1 && (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Бизнес</label>
              <div className="flex flex-wrap gap-2">
                {businesses.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => selectBusiness(entry)}
                    className={`rounded-xl px-3 py-2 text-sm font-bold ${business?.id === entry.id ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}
                  >
                    {entry.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Всего" value={items.length} />
            <Stat label="Товары" value={items.filter((item) => item.type === "PRODUCT").length} />
            <Stat label="Услуги" value={items.filter((item) => item.type === "SERVICE").length} />
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-3 rounded-2xl border bg-white p-4 md:flex-row md:items-center">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по названию или описанию" className="min-h-11 flex-1 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-slate-400" />
          <div className="flex gap-2">
            {(["ALL", "PRODUCT", "SERVICE"] as const).map((value) => (
              <button key={value} onClick={() => setFilter(value)} className={`rounded-xl px-3 py-2 text-sm font-bold ${filter === value ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>
                {value === "ALL" ? "Все" : value === "PRODUCT" ? "Товары" : "Услуги"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-500">Загрузка...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center">
            <p className="text-lg font-black">Пока пусто</p>
            <p className="mt-1 text-sm text-slate-500">Добавьте первый товар или услугу, и он появится в Mini App.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="h-44 bg-slate-100">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-sm font-bold text-slate-400">{item.type === "SERVICE" ? "Фото услуги" : "Фото товара"}</div>
                  )}
                </div>
                <div className="p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-400">{item.type === "SERVICE" ? "Услуга" : "Товар"}</p>
                      <h2 className="font-black">{item.name}</h2>
                    </div>
                    <p className="shrink-0 font-black text-blue-700">{formatPrice(item.price)}</p>
                  </div>
                  <p className="line-clamp-2 min-h-10 text-sm text-slate-500">{item.description || "Описание не указано."}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => toggleItem(item, { isAvailable: !item.isAvailable })} className={`rounded-xl px-3 py-2 text-xs font-bold ${item.isAvailable ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      {item.isAvailable ? "Активен" : "Скрыт"}
                    </button>
                    <button onClick={() => toggleItem(item, { isPopular: !item.isPopular })} className={`rounded-xl px-3 py-2 text-xs font-bold ${item.isPopular ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                      {item.isPopular ? "Популярный" : "Обычный"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-40 grid place-items-end bg-black/40 p-0 backdrop-blur-sm md:place-items-center md:p-6">
          <form onSubmit={createItem} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl md:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-400">{business?.name}</p>
                <h2 className="text-xl font-black">Новая позиция</h2>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setForm({ ...form, type: "PRODUCT" })} className={`rounded-xl px-3 py-3 text-sm font-black ${form.type === "PRODUCT" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}>Товар</button>
              <button type="button" onClick={() => setForm({ ...form, type: "SERVICE" })} className={`rounded-xl px-3 py-3 text-sm font-black ${form.type === "SERVICE" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}>Услуга</button>
            </div>

            {/* AI Generator Panel */}
            <div className="mb-5 p-4 rounded-2xl border border-indigo-100 bg-indigo-50/30">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">✨</span>
                <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider">AI-генератор карточки товара</h3>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Например: Свежий круассан с миндалем"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-indigo-400"
                />
                <button
                  type="button"
                  disabled={aiLoading || !aiPrompt.trim()}
                  onClick={handleAiGenerate}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-750 disabled:bg-indigo-300 text-white font-black text-xs px-4 py-2 transition"
                >
                  {aiLoading ? "Генерация..." : "Создать с ИИ"}
                </button>
              </div>
              {aiLoading && (
                <div className="mt-3 flex items-center gap-2 text-xs font-bold text-indigo-600 animate-pulse">
                  <div className="h-2 w-2 rounded-full bg-indigo-600 animate-bounce" />
                  Генерируем текст и изображение...
                </div>
              )}
              {aiError && (
                <p className="text-rose-600 text-[10px] font-bold mt-2">⚠️ {aiError}</p>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Название"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field" /></Field>
              <Field label="Цена, ₽"><input required type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="field" /></Field>
              <Field label={form.type === "SERVICE" ? "Длительность, минут" : "Остаток"}><input type="number" min="0" value={form.type === "SERVICE" ? form.durationMinutes : form.stock} onChange={(e) => setForm({ ...form, [form.type === "SERVICE" ? "durationMinutes" : "stock"]: e.target.value })} className="field" /></Field>
              <Field label="Категория">
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="field cursor-pointer"
                >
                  <option value="">Без категории</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Описание"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="field min-h-28 md:col-span-2" /></Field>
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-4">
              <label className="flex cursor-pointer items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100"><ImagePlus size={20} /></span>
                <span>
                  <span className="block text-sm font-black">Загрузить фото</span>
                  <span className="block text-xs text-slate-500">jpg, png или webp до 5 МБ</span>
                </span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0]).catch((err) => setError(err.message))} />
              </label>
              {form.imageUrl && <img src={form.imageUrl} alt="" className="mt-4 h-36 w-full rounded-xl object-cover" />}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} /> Активен</label>
              <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.isPopular} onChange={(e) => setForm({ ...form, isPopular: e.target.checked })} /> Популярный</label>
            </div>

            <button disabled={saving} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-50">
              <Save size={18} />
              {saving ? "Сохраняем..." : isBookingBusiness ? "Сохранить услугу" : "Сохранить"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-100 px-4 py-3">
      <p className="text-xl font-black">{value}</p>
      <p className="text-xs font-bold text-slate-500">{label}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-sm font-bold text-slate-700">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}
