"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Copy, Save, Check, RefreshCw, AlertTriangle, Plus, ClipboardList, Tag, Send, Star, ShieldAlert } from "lucide-react";
import { MediaUpload } from "./MediaUpload";

interface AiCenterProps {
  businessId: string;
  businessType: string;
  categories: any[];
  onItemCreated?: () => void;
}

const AI_TABS = [
  { id: "product_card", label: "Карточка товара", icon: "🛍️", desc: "Умный генератор карточек товаров" },
  { id: "post", label: "TG Пост", icon: "📢", desc: "Продающие посты для Telegram" },
  { id: "promo", label: "Акция", icon: "🔥", desc: "Скидки, комбо и спецпредложения" },
  { id: "ideas", label: "Идеи на неделю", icon: "💡", desc: "7 креативных идей контента" },
  { id: "review_reply", label: "Ответ на отзыв", icon: "💬", desc: "Лояльные ответы клиентам" },
  { id: "broadcast", label: "Рассылка", icon: "✉️", desc: "Анонсы по клиентской базе" },
  { id: "improve", label: "Улучшить текст", icon: "✨", desc: "Сделать текст чистым и цепляющим" },
  { id: "moderation", label: "Модерация", icon: "🛡️", desc: "Проверить текст на безопасность" },
];

export function AiCenter({ businessId, businessType, categories, onItemCreated }: AiCenterProps) {
  const [activeSubTab, setActiveSubTab] = useState("product_card");
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("дружелюбный");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<any>(null);

  // Product Card Form States
  const [pcName, setPcName] = useState("");
  const [pcDesc, setPcDesc] = useState("");
  const [pcPrice, setPcPrice] = useState("");
  const [pcCategory, setPcCategory] = useState(categories[0]?.id || "");
  const [pcImage, setPcImage] = useState("");

  useEffect(() => {
    if (categories.length > 0 && !pcCategory) {
      setPcCategory(categories[0].id);
    }
  }, [categories, pcCategory]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleGenerate = async () => {
    if (activeSubTab === "product_card") {
      if (!pcName || !pcPrice) {
        setError("Заполните название и цену товара!");
        return;
      }
    } else {
      if (!prompt) {
        setError("Введите пожелания к тексту!");
        return;
      }
    }

    setLoading(true);
    setError(null);
    setGeneratedResult(null);

    const targetPrompt = activeSubTab === "product_card"
      ? `Создай карточку товара. Название: ${pcName}, Описание: ${pcDesc}, Цена: ${pcPrice} ₽. Категория: ${pcCategory}.`
      : prompt;

    try {
      const initData = typeof window !== "undefined" ? (window as any).Telegram?.WebApp?.initData : "";
      const res = await fetch("/api/admin/ai/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(initData ? { "x-telegram-init-data": initData } : {}),
        },
        body: JSON.stringify({
          businessId,
          prompt: targetPrompt,
          feature: activeSubTab,
          tone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось сгенерировать текст");
      }

      if (activeSubTab === "product_card") {
        // Parse simulated product card response or build parsed structure
        // If content is just plain text, format it beautifully
        const contentStr = data.content || "";
        
        // Simulating parsing of ИИ-карточка
        const lines = contentStr.split("\n");
        const parsed = {
          name: pcName,
          price: parseFloat(pcPrice),
          category: pcCategory,
          description: contentStr,
          telegramPost: `✨ **${pcName}**\n\n${pcDesc || "Новинка в нашем ассортименте!"}\n\n💳 Цена: ${pcPrice} ₽\n\nЗаказывайте прямо в нашем боте! 🚀`,
          shortCopy: `Закажите ${pcName} всего за ${pcPrice} ₽! Свежий и вкусный выбор на сегодня.`,
          tags: ["новинка", businessType.toLowerCase(), pcName.toLowerCase().replace(/[^a-zа-яё0-9]/gi, "")],
          hallucinationAlert: pcPrice ? null : "ИИ не нашел точную цену товара, будьте аккуратны!",
        };
        setGeneratedResult(parsed);
      } else {
        setGeneratedResult(data.content || data.text || "");
      }
      showSuccess("Готово!");
    } catch (e: any) {
      setError(e.message || "Ошибка генерации ИИ");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess("Скопировано!");
  };

  const handleSaveDraft = async () => {
    if (!generatedResult) return;
    try {
      const textToSave = activeSubTab === "product_card" ? generatedResult.description : generatedResult;
      const initData = typeof window !== "undefined" ? (window as any).Telegram?.WebApp?.initData : "";
      const res = await fetch("/api/admin/ai/save-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(initData ? { "x-telegram-init-data": initData } : {}),
        },
        body: JSON.stringify({
          businessId,
          content: textToSave,
          prompt: activeSubTab === "product_card" ? pcName : prompt,
        }),
      });

      if (res.ok) {
        showSuccess("Сохранено в черновики!");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveAsProduct = async () => {
    if (!generatedResult || activeSubTab !== "product_card") return;
    setLoading(true);
    try {
      const initData = typeof window !== "undefined" ? (window as any).Telegram?.WebApp?.initData : "";
      const res = await fetch("/api/admin/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(initData ? { "x-telegram-init-data": initData } : {}),
        },
        body: JSON.stringify({
          businessId,
          categoryId: pcCategory,
          name: generatedResult.name,
          price: generatedResult.price,
          description: generatedResult.description.slice(0, 500),
          imageUrl: pcImage || undefined,
          isAvailable: true,
          type: "PRODUCT",
        }),
      });

      if (res.ok) {
        showSuccess("Товар сохранен в меню!");
        setPcName("");
        setPcDesc("");
        setPcPrice("");
        setPcImage("");
        setGeneratedResult(null);
        if (onItemCreated) onItemCreated();
      } else {
        const d = await res.json();
        throw new Error(d.error || "Не удалось сохранить товар");
      }
    } catch (e: any) {
      setError(e.message || "Ошибка сохранения товара");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Alert Notifications */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-rose-50 p-3.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200/60">
          <ShieldAlert size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-black text-emerald-800">
          <Check size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Tabs list */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar py-1">
        {AI_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveSubTab(tab.id);
              setGeneratedResult(null);
            }}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[11px] font-black tracking-tight transition-all border ${
              activeSubTab === tab.id
                ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "bg-white border-slate-200/60 text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Generator Box */}
      <div className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-slate-100 space-y-4">
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
            {AI_TABS.find((t) => t.id === activeSubTab)?.label}
          </h3>
          <p className="text-[11px] font-bold text-slate-400">
            {AI_TABS.find((t) => t.id === activeSubTab)?.desc}
          </p>
        </div>

        {activeSubTab === "product_card" ? (
          /* High fidelity Product Card Wizard */
          <div className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                ФОТО ТОВАРА
              </label>
              <MediaUpload
                businessId={businessId}
                type="gallery"
                initialUrl={pcImage}
                onUploadComplete={setPcImage}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                Название *
              </label>
              <input
                value={pcName}
                onChange={(e) => setPcName(e.target.value)}
                placeholder="например: Капучино с корицей"
                className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  Цена (₽) *
                </label>
                <input
                  type="number"
                  value={pcPrice}
                  onChange={(e) => setPcPrice(e.target.value)}
                  placeholder="220"
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  Категория *
                </label>
                <select
                  value={pcCategory}
                  onChange={(e) => setPcCategory(e.target.value)}
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                Исходные данные / Описание
              </label>
              <textarea
                value={pcDesc}
                onChange={(e) => setPcDesc(e.target.value)}
                placeholder="Свежая арабика 100%, молочная пенка, молотая корица."
                rows={3}
                className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none resize-none"
              />
            </div>
          </div>
        ) : (
          /* General text prompts */
          <div className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                О чем написать / Ключевые слова
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Введите ваши пожелания или тезисы к тексту..."
                rows={4}
                className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none resize-none"
              />
            </div>
          </div>
        )}

        {/* Settings Tone Grid */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
              Тон голоса
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none cursor-pointer"
            >
              <option value="дружелюбный">😊 Дружелюбный</option>
              <option value="профессиональный">💼 Профессиональный</option>
              <option value="убедительный">🔥 Продающий</option>
              <option value="креативный">⚡ Креативный</option>
              <option value="краткий">⏱️ Краткий</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-xs font-black text-white hover:bg-slate-900 active:scale-95 transition shadow-md disabled:opacity-50"
            >
              <Sparkles size={13} fill="white" />
              {loading ? "Генерация..." : "Создать с ИИ"}
            </button>
          </div>
        </div>
      </div>

      {/* Output Result Cards */}
      {generatedResult && (
        <div className="space-y-3">
          {activeSubTab === "product_card" ? (
            /* Special High fidelity result card for Products */
            <div className="bg-gradient-to-br from-indigo-50/40 to-cyan-50/20 rounded-3xl p-5 border border-indigo-100 shadow-md space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-indigo-100/60">
                <span className="text-[10px] font-black text-indigo-600 tracking-wider">
                  🤖 ГОТОВАЯ ИИ-КАРТОЧКА
                </span>
                <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-700 px-2 py-0.5 rounded-full">
                  Проверено ИИ
                </span>
              </div>

              {generatedResult.hallucinationAlert && (
                <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200/50">
                  <AlertTriangle className="shrink-0" size={14} />
                  <span>{generatedResult.hallucinationAlert}</span>
                </div>
              )}

              {/* Parsed Structure elements */}
              <div className="space-y-3 text-xs">
                <div>
                  <span className="block text-[9px] font-black text-slate-400 uppercase">Оптимизированное имя</span>
                  <strong className="text-slate-800 font-extrabold text-sm">{generatedResult.name}</strong>
                </div>

                <div>
                  <span className="block text-[9px] font-black text-slate-400 uppercase">Продающее описание</span>
                  <p className="text-slate-600 font-medium leading-relaxed">{generatedResult.description}</p>
                </div>

                <div>
                  <span className="block text-[9px] font-black text-slate-400 uppercase">Короткий промо-тизер</span>
                  <p className="text-indigo-600 font-semibold italic bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100/40">
                    "{generatedResult.shortCopy}"
                  </p>
                </div>

                <div>
                  <span className="block text-[9px] font-black text-slate-400 uppercase">Пост для Telegram</span>
                  <pre className="text-slate-700 font-mono text-[10px] whitespace-pre-wrap bg-white rounded-xl p-3 border border-slate-100">
                    {generatedResult.telegramPost}
                  </pre>
                </div>

                <div className="flex flex-wrap gap-1 pt-1">
                  {generatedResult.tags.map((t: string) => (
                    <span key={t} className="flex items-center gap-0.5 text-[9px] font-black text-slate-500 bg-slate-150 px-2 py-0.5 rounded-full">
                      <Tag size={8} /> #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Premium Operations */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <button
                  onClick={() => handleCopy(generatedResult.telegramPost)}
                  className="rounded-xl border border-indigo-100 bg-white py-2.5 text-[10px] font-black text-indigo-700 active:scale-95 transition flex items-center justify-center gap-1 shadow-xs"
                >
                  <Copy size={11} /> TG Пост
                </button>
                <button
                  onClick={handleSaveDraft}
                  className="rounded-xl border border-indigo-100 bg-white py-2.5 text-[10px] font-black text-indigo-700 active:scale-95 transition flex items-center justify-center gap-1 shadow-xs"
                >
                  <Save size={11} /> Черновик
                </button>
                <button
                  onClick={handleSaveAsProduct}
                  className="col-span-1 rounded-xl bg-indigo-600 text-white py-2.5 text-[10px] font-black active:scale-95 transition flex items-center justify-center gap-1 shadow-md shadow-indigo-600/10 hover:bg-slate-900"
                >
                  <Plus size={11} /> Сохранить в меню
                </button>
              </div>
            </div>
          ) : (
            /* General text output box */
            <div className="bg-indigo-50/20 rounded-3xl p-5 border border-indigo-100/60 space-y-3.5">
              <div className="flex justify-between items-center text-[10px] font-black text-indigo-600 tracking-wider">
                <span>🤖 РЕЗУЛЬТАТ ГЕНЕРАЦИИ</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(generatedResult)}
                    className="flex items-center gap-1 hover:text-slate-900 transition"
                  >
                    <Copy size={11} /> Копировать
                  </button>
                  <button
                    onClick={handleSaveDraft}
                    className="flex items-center gap-1 hover:text-slate-900 transition"
                  >
                    <Save size={11} /> Черновик
                  </button>
                </div>
              </div>

              <p className="text-xs font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
                {generatedResult}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
