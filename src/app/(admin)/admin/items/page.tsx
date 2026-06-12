"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ImagePlus, Pencil, Plus, RefreshCw, Save, ShoppingBag, Sparkles, Trash2, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { formatPrice } from "@/lib/utils";
import { AccessDeniedScreen } from "@/components/app/AccessDeniedScreen";
import { BottomSheetPicker } from "@/components/ui/BottomSheetPicker";

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
  categoryId?: string | null;
  type: "PRODUCT" | "SERVICE";
  isAvailable: boolean;
  isPopular: boolean;
  stock?: number | null;
  stockMode?: "SIMPLE_AVAILABILITY" | "TRACK_STOCK";
  archivedAt?: string | null;
  durationMinutes?: number | null;
  category?: { id: string; name: string } | null;
};

type FormState = {
  type: "PRODUCT" | "SERVICE";
  name: string;
  description: string;
  price: string;
  stock: string;
  stockMode: "SIMPLE_AVAILABILITY" | "TRACK_STOCK";
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
  stockMode: "SIMPLE_AVAILABILITY",
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
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  async function handleAiGenerate() {
    if (!aiPrompt.trim() || !business) return;
    setAiLoading(true);
    setAiError("");
    setError("");
    try {
      const currentCategory = categories.find((entry) => entry.id === form.categoryId)?.name || "Основное";
      const textRes = await apiClient.post("/admin/ai/generate", {
        businessId: business.id,
        feature: "product_card",
        contentType: "product_card",
        tone: "дружелюбный",
        imageUrl: form.imageUrl || undefined,
        prompt: [
          `Идея товара: ${aiPrompt}`,
          form.name ? `Текущее название: ${form.name}` : "",
          form.description ? `Текущее описание: ${form.description}` : "",
          form.price ? `Цена: ${form.price} ₽` : "",
          `Категория: ${currentCategory}`,
          categories.length ? `Существующие категории: ${categories.map((entry) => entry.name).join(", ")}` : "",
        ].filter(Boolean).join(", "),
      });
      const textData = textRes.data;

      if (textData.categorySuggestion && categories.length > 0) {
        const foundCategory = categories.find(
          (c) => c.name.toLowerCase().includes(textData.categorySuggestion.toLowerCase()) ||
                 textData.categorySuggestion.toLowerCase().includes(c.name.toLowerCase())
        );
        if (foundCategory) {
          setForm((current) => ({ ...current, categoryId: foundCategory.id }));
        }
      }

      setForm((current) => ({
        ...current,
        name: textData.title || current.name || aiPrompt,
        description: textData.description || textData.shortDescription || current.description,
      }));

      setToast("Карточка товара сгенерирована. Проверьте её перед сохранением.");
      setTimeout(() => setToast(""), 2500);
    } catch (err: any) {
      setAiError(apiError(err));
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

  async function deleteItem(item: Item) {
    if (!confirm(`Архивировать позицию "${item.name}"? Старые заказы сохранятся.`)) return;
    setError("");
    try {
      await apiClient.delete(`/admin/items/${item.id}`);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (editingItem?.id === item.id) closeModal();
      setToast("Позиция перенесена в архив");
      setTimeout(() => setToast(""), 2500);
    } catch (err) {
      setError(apiError(err));
    }
  }

  async function deleteCategory(categoryId: string) {
    const category = categories.find((entry) => entry.id === categoryId);
    if (!category) return;
    if (!confirm(`Удалить категорию "${category.name}"? Товары останутся без категории.`)) return;
    setError("");
    try {
      await apiClient.delete(`/categories?id=${categoryId}`);
      setCategories((current) => current.filter((entry) => entry.id !== categoryId));
      setItems((current) =>
        current.map((entry) =>
          entry.categoryId === categoryId || entry.category?.id === categoryId
            ? { ...entry, categoryId: null, category: null }
            : entry
        )
      );
      if (form.categoryId === categoryId) {
        setForm((current) => ({ ...current, categoryId: "" }));
      }
      setToast("Категория удалена");
      setTimeout(() => setToast(""), 2500);
    } catch (err) {
      setError(apiError(err));
    }
  }

  function openCreateModal() {
    setEditingItem(null);
    setForm(initialForm);
    setModalOpen(true);
  }

  function openEditModal(item: Item) {
    setEditingItem(item);
    setForm({
      type: item.type,
      name: item.name || "",
      description: item.description || "",
      price: String(item.price ?? ""),
      stock: item.stock === null || item.stock === undefined ? "" : String(item.stock),
      stockMode: item.stockMode === "TRACK_STOCK" ? "TRACK_STOCK" : "SIMPLE_AVAILABILITY",
      durationMinutes:
        item.durationMinutes === null || item.durationMinutes === undefined ? "" : String(item.durationMinutes),
      isPopular: Boolean(item.isPopular),
      isAvailable: Boolean(item.isAvailable),
      imageUrl: item.imageUrl || "",
      categoryId: item.categoryId || item.category?.id || "",
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingItem(null);
    setForm(initialForm);
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
    setForm((current) => ({ ...current, imageUrl: data.url || data.imageUrl || data.data?.url || "" }));
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault();
    if (!business) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        businessId: business.id,
        ...form,
        price: Number(form.price),
        stock: form.type === "PRODUCT" ? form.stock : "",
        stockMode: form.type === "PRODUCT" ? form.stockMode : "SIMPLE_AVAILABILITY",
        durationMinutes: form.type === "SERVICE" ? form.durationMinutes : "",
      };
      const res = editingItem
        ? await apiClient.patch(`/admin/items/${editingItem.id}`, payload)
        : await apiClient.post("/admin/items", payload);
      const saved = res.data.data;
      setItems((current) =>
        editingItem ? current.map((entry) => (entry.id === editingItem.id ? saved : entry)) : [saved, ...current]
      );
      closeModal();
      setToast(editingItem ? "Изменения сохранены" : "Сохранено");
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
            <button onClick={openCreateModal} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white">
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
                    <button onClick={() => openEditModal(item)} className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
                      <Pencil size={13} />
                      Редактировать
                    </button>
                    <button onClick={() => toggleItem(item, { isAvailable: !item.isAvailable })} className={`rounded-xl px-3 py-2 text-xs font-bold ${item.isAvailable ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      {item.isAvailable ? "Активен" : "Скрыт"}
                    </button>
                    <button onClick={() => toggleItem(item, { isPopular: !item.isPopular })} className={`rounded-xl px-3 py-2 text-xs font-bold ${item.isPopular ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                      {item.isPopular ? "Популярный" : "Обычный"}
                    </button>
                    <button onClick={() => deleteItem(item)} className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                      <Trash2 size={13} />
                      В архив
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
          <form onSubmit={saveItem} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl md:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-400">{business?.name}</p>
                <h2 className="text-xl font-black">{editingItem ? "Редактировать позицию" : "Новая позиция"}</h2>
              </div>
              <button type="button" onClick={closeModal} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setForm({ ...form, type: "PRODUCT" })} className={`rounded-xl px-3 py-3 text-sm font-black ${form.type === "PRODUCT" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}>Товар</button>
              <button type="button" onClick={() => setForm({ ...form, type: "SERVICE" })} className={`rounded-xl px-3 py-3 text-sm font-black ${form.type === "SERVICE" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}>Услуга</button>
            </div>

            {form.type === "PRODUCT" && (
              <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-700" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-indigo-950">AI-генератор карточки товара</h3>
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
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white transition hover:bg-indigo-700 disabled:bg-indigo-300"
                  >
                    {aiLoading ? "Генерация..." : "Создать с ИИ"}
                  </button>
                </div>
                {aiLoading && (
                  <div className="mt-3 flex animate-pulse items-center gap-2 text-xs font-bold text-indigo-600">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-600" />
                    Генерируем карточку товара...
                  </div>
                )}
                {aiError && (
                  <p className="mt-2 text-[10px] font-bold text-rose-600">⚠️ {aiError}</p>
                )}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Название"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field" /></Field>
              <Field label="Цена, ₽"><input required type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="field" /></Field>
              {form.type === "SERVICE" ? (
                <Field label="Длительность, минут"><input type="number" min="0" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} className="field" /></Field>
              ) : (
                <Field label="Учёт наличия">
                  <select value={form.stockMode} onChange={(e) => setForm({ ...form, stockMode: e.target.value as FormState["stockMode"] })} className="field">
                    <option value="SIMPLE_AVAILABILITY">Только в наличии / нет</option>
                    <option value="TRACK_STOCK">Считать точный остаток</option>
                  </select>
                </Field>
              )}
              {form.type === "PRODUCT" && form.stockMode === "TRACK_STOCK" && (
                <Field label="Остаток"><input required type="number" min="0" step="1" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="field" /></Field>
              )}
              <Field label="Категория">
                <div className="flex gap-2">
                  <BottomSheetPicker
                    title="Выберите категорию"
                    value={form.categoryId}
                    onChange={(categoryId) => setForm({ ...form, categoryId })}
                    buttonClassName="field cursor-pointer"
                    options={[
                      { value: "", label: "Без категории", icon: <AlertCircle size={16} /> },
                      ...categories.map((category) => ({
                        value: category.id,
                        label: category.name,
                        icon: <ShoppingBag size={16} />,
                      })),
                    ]}
                  />
                  <button
                    type="button"
                    onClick={() => form.categoryId && deleteCategory(form.categoryId)}
                    disabled={!form.categoryId}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Удалить категорию"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
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
              {saving ? "Сохраняем..." : editingItem ? "Сохранить изменения" : isBookingBusiness ? "Сохранить услугу" : "Сохранить"}
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
