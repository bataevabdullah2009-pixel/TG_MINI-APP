"use client";

import React, { useState, useEffect } from "react";
import { 
  TrendingUp, 
  ShoppingBag, 
  Sparkles, 
  Image as ImageIcon, 
  Settings as SettingsIcon,
  Plus,
  Save,
  CheckCircle,
  XCircle,
  Copy,
  AlertCircle
} from "lucide-react";

interface SellerHomeProps {
  session: any;
  businessId: string;
}

export function SellerHome({ session, businessId }: SellerHomeProps) {
  const [activeTab, setActiveTab] = useState<"DASHBOARD" | "ITEMS" | "AI" | "MEDIA" | "SETTINGS">("DASHBOARD");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayRevenue: 0,
    activeQueue: 0,
    totalItems: 0,
    orders: [] as any[],
    bookings: [] as any[],
  });

  const [businessData, setBusinessData] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Quick Add Item Form
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");

  // AI copywriter state
  const [aiPrompt, setAiPrompt] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Settings State
  const [bizName, setBizName] = useState("");
  const [bizDesc, setBizDesc] = useState("");
  const [bizAddress, setBizAddress] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [bizIsOpen, setBizIsOpen] = useState(true);

  // Media state
  const [bizLogoUrl, setBizLogoUrl] = useState("");
  const [bizColor, setBizColor] = useState("#3B82F6");

  useEffect(() => {
    fetchSellerData();
  }, [businessId]);

  const fetchSellerData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Business Profile
      const bizRes = await fetch(`/api/businesses/${businessId}`);
      if (bizRes.ok) {
        const bData = await bizRes.json();
        setBusinessData(bData);
        setBizName(bData.name || "");
        setBizDesc(bData.description || "");
        setBizAddress(bData.address || "");
        setBizPhone(bData.phone || "");
        setBizIsOpen(bData.isOpen === undefined ? true : bData.isOpen);
        setBizLogoUrl(bData.logoUrl || "");
        setBizColor(bData.primaryColor || "#3B82F6");
      }

      // 2. Fetch Catalog (Items & Categories)
      const catRes = await fetch(`/api/businesses/${businessId}/catalog`);
      if (catRes.ok) {
        const cData = await catRes.json();
        setItems(cData.items || []);
        setCategories(cData.categories || []);
        if (cData.categories?.length > 0) {
          setNewItemCategory(cData.categories[0].id);
        }
      }

      // 3. Fetch Orders and calculate stats
      const ordRes = await fetch(`/api/orders?businessId=${businessId}`);
      const bookRes = await fetch(`/api/bookings?businessId=${businessId}`);
      
      let ords = [] as any[];
      let bks = [] as any[];

      if (ordRes.ok) ords = await ordRes.json();
      if (bookRes.ok) bks = await bookRes.json();

      // Calculate today's stats
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todayOrders = ords.filter((o: any) => new Date(o.createdAt) >= startOfDay);
      const revenue = todayOrders
        .filter((o: any) => o.status === "COMPLETED" || o.status === "READY" || o.status === "CONFIRMED")
        .reduce((sum: number, o: any) => sum + (o.totalPrice || 0), 0);

      const activeOrds = ords.filter((o: any) => o.status === "NEW" || o.status === "PROCESSING").length;
      const activeBks = bks.filter((b: any) => b.status === "NEW" || b.status === "CONFIRMED").length;

      setStats({
        todayRevenue: revenue,
        activeQueue: activeOrds + activeBks,
        totalItems: items.length,
        orders: ords,
        bookings: bks,
      });

    } catch (e) {
      console.error(e);
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  // Add a new item to the store
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice || !newItemCategory) {
      showError("Заполните обязательные поля!");
      return;
    }

    try {
      const res = await fetch("/api/admin/items", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-business-id": businessId // Pass businessId in custom header to bypass scope checks
        },
        body: JSON.stringify({
          businessId,
          categoryId: newItemCategory,
          name: newItemName,
          price: parseFloat(newItemPrice),
          description: newItemDesc,
          type: "PRODUCT",
          isAvailable: true,
        }),
      });

      if (res.ok) {
        showSuccess("Товар добавлен!");
        setNewItemName("");
        setNewItemPrice("");
        setNewItemDesc("");
        fetchSellerData();
      } else {
        const rData = await res.json();
        showError(rData.error || "Не удалось добавить товар");
      }
    } catch (e) {
      showError("Ошибка соединения с сервером");
    }
  };

  // AI marketing post copywriter
  const handleGenerateAI = async () => {
    if (!aiPrompt) {
      showError("Введите ключевые слова для ИИ!");
      return;
    }

    setAiLoading(true);
    setError(null);
    try {
      // Connects to actual generate AI endpoint
      const res = await fetch("/api/admin/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          prompt: aiPrompt,
          type: "marketing_post",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setGeneratedText(data.content || data.text || "");
      } else {
        throw new Error(data.error || "ИИ не смог сгенерировать текст");
      }
    } catch (e: any) {
      showError(e.message || "Ошибка генерации текста");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveAIDraft = async () => {
    if (!generatedText) return;
    try {
      const res = await fetch("/api/admin/ai/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          content: generatedText,
          prompt: aiPrompt,
        }),
      });
      if (res.ok) {
        showSuccess("Сохранено в черновики ИИ!");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Update Settings
  const handleUpdateSettings = async () => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/current-business`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "x-business-id": businessId 
        },
        body: JSON.stringify({
          name: bizName,
          description: bizDesc,
          address: bizAddress,
          phone: bizPhone,
          isOpen: bizIsOpen,
        }),
      });

      if (res.ok) {
        showSuccess("Настройки обновлены!");
        fetchSellerData();
      } else {
        showError("Не удалось обновить настройки");
      }
    } catch (e) {
      showError("Ошибка сохранения");
    }
  };

  // Update Media
  const handleUpdateMedia = async () => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/current-business`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "x-business-id": businessId 
        },
        body: JSON.stringify({
          logoUrl: bizLogoUrl,
          primaryColor: bizColor,
        }),
      });

      if (res.ok) {
        showSuccess("Медиа-центр обновлен!");
        fetchSellerData();
      } else {
        showError("Не удалось обновить медиа");
      }
    } catch (e) {
      showError("Ошибка сохранения");
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

  const handleCopyText = () => {
    navigator.clipboard.writeText(generatedText);
    showSuccess("Текст скопирован в буфер обмена!");
  };

  return (
    <div className="pb-24 text-slate-900 min-h-screen bg-slate-50">
      
      {/* Title Header */}
      <section className="bg-slate-900 text-white px-4 pb-4.5 pt-5 relative">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Управление бизнесом</p>
            <h1 className="text-xl font-black truncate">{bizName || "Панель Продавца"}</h1>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-black ${
            bizIsOpen ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
          }`}>
            {bizIsOpen ? "• В сети" : "• Офлайн"}
          </span>
        </div>

        {/* Inline Navigation tabs */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar mt-4 pt-1">
          {[
            { id: "DASHBOARD", label: "Главная", icon: <TrendingUp size={12} /> },
            { id: "ITEMS", label: "Товары", icon: <ShoppingBag size={12} /> },
            { id: "AI", label: "ИИ-Маркетинг", icon: <Sparkles size={12} /> },
            { id: "MEDIA", label: "Медиа", icon: <ImageIcon size={12} /> },
            { id: "SETTINGS", label: "Настройки", icon: <SettingsIcon size={12} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all ${
                activeTab === tab.id 
                  ? "bg-white text-slate-950 shadow-md shadow-slate-900/20" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Floating Notifications */}
      {error && (
        <div className="fixed top-4 inset-x-4 z-50 flex items-center gap-2 rounded-2xl bg-rose-600 p-3.5 text-xs font-black text-white shadow-xl animate-bounce">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="fixed top-4 inset-x-4 z-50 flex items-center gap-2 rounded-2xl bg-emerald-600 p-3.5 text-xs font-black text-white shadow-xl animate-fade-in">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Content Container */}
      <div className="p-4 max-w-md mx-auto">
        
        {/* Tab 1: Dashboard */}
        {activeTab === "DASHBOARD" && (
          <div className="space-y-4">
            
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">ВЫРУЧКА СЕГОДНЯ</span>
                <strong className="text-xl font-black text-slate-950 mt-1 block">{stats.todayRevenue} ₽</strong>
              </div>
              <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">АКТИВНАЯ ОЧЕРЕДЬ</span>
                <strong className="text-xl font-black text-slate-950 mt-1 block">{stats.activeQueue} шт.</strong>
              </div>
            </div>

            {/* Active Orders Section */}
            <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Текущие заказы</h3>
              {stats.orders.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-400 font-medium">Новых заказов нет</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {stats.orders.slice(0, 5).map((o: any) => (
                    <div key={o.id} className="flex justify-between items-center p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <strong className="text-xs text-slate-800">Заказ #{o.id.slice(-5).toUpperCase()}</strong>
                        <span className="text-[9px] block text-slate-400 font-semibold">{o.customerName} · {o.customerPhone}</span>
                      </div>
                      <span className="text-[10px] font-black text-slate-900">{o.totalPrice} ₽</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Bookings Section */}
            {stats.bookings.length > 0 && (
              <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Записи на сегодня</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {stats.bookings.slice(0, 5).map((b: any) => (
                    <div key={b.id} className="flex justify-between items-center p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <strong className="text-xs text-slate-800">{b.customerName}</strong>
                        <span className="text-[9px] block text-slate-400 font-semibold">
                          📅 {new Date(b.startTime).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5">{b.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Items Catalog */}
        {activeTab === "ITEMS" && (
          <div className="space-y-4">
            
            {/* Quick Add Form */}
            <form onSubmit={handleAddItem} className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Быстрое добавление товара</h3>
              
              <div className="space-y-2.5">
                <input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Название (например: Эспрессо)"
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                  required
                />
                
                <input
                  type="number"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  placeholder="Цена в ₽ (например: 150)"
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                  required
                />

                <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                >
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <textarea
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  placeholder="Краткое описание"
                  rows={2}
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none resize-none"
                />

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-black text-white hover:bg-indigo-600 transition"
                >
                  <Plus size={14} />
                  Добавить в меню
                </button>
              </div>
            </form>

            {/* List items */}
            <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Список позиций ({items.length})</h3>
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                {items.map((it) => (
                  <div key={it.id} className="flex justify-between items-center p-2 border-b border-slate-50">
                    <div>
                      <strong className="text-xs font-extrabold text-slate-900 block">{it.name}</strong>
                      <span className="text-[10px] font-black text-indigo-600">{it.price} ₽</span>
                    </div>
                    <span className={`text-[9px] font-black rounded-full px-2 py-0.5 ${
                      it.isAvailable ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
                    }`}>
                      {it.isAvailable ? "Есть" : "Нет"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: AI Copywriter */}
        {activeTab === "AI" && (
          <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100 space-y-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1">ИИ-Маркетолог</h3>
              <p className="text-[10px] font-medium text-slate-400">
                Создайте продающий пост или описание за 1 клик с помощью ИИ
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">О ЧЕМ НАПИСАТЬ?</label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="например: Акция! Скидка 20% на весь кофе сегодня до конца дня"
                  rows={3}
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none resize-none"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={aiLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-xs font-black text-white hover:bg-slate-900 transition shadow-lg shadow-indigo-600/10 disabled:opacity-50"
              >
                <Sparkles size={14} fill="white" />
                {aiLoading ? "⏳ Генерируем с ИИ..." : "Сгенерировать текст"}
              </button>

              {generatedText && (
                <div className="border border-indigo-100 bg-indigo-50/30 rounded-2xl p-3.5 mt-4 space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-black text-indigo-600 tracking-wider">
                    <span>СГЕНЕРИРОВАННЫЙ ТЕКСТ</span>
                    <div className="flex gap-2">
                      <button onClick={handleCopyText} className="flex items-center gap-1 hover:text-slate-900 transition">
                        <Copy size={11} /> Копировать
                      </button>
                      <button onClick={handleSaveAIDraft} className="flex items-center gap-1 hover:text-slate-900 transition">
                        <Save size={11} /> В Черновики
                      </button>
                    </div>
                  </div>
                  <p className="text-xs font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {generatedText}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Media Hub */}
        {activeTab === "MEDIA" && (
          <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Медиа-центр</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">ССЫЛКА НА ЛОГОТИП (URL)</label>
                <input
                  value={bizLogoUrl}
                  onChange={(e) => setBizLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">ФИРМЕННЫЙ ЦВЕТ (HEX)</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={bizColor}
                    onChange={(e) => setBizColor(e.target.value)}
                    className="h-10 w-10 border rounded-xl outline-none cursor-pointer"
                  />
                  <input
                    value={bizColor}
                    onChange={(e) => setBizColor(e.target.value)}
                    placeholder="#3B82F6"
                    className="flex-1 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleUpdateMedia}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-black text-white hover:bg-indigo-600 transition mt-2"
              >
                <Save size={14} />
                Сохранить оформление
              </button>
            </div>
          </div>
        )}

        {/* Tab 5: Settings */}
        {activeTab === "SETTINGS" && (
          <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Настройки заведения</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">НАЗВАНИЕ</label>
                <input
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  placeholder="Название заведения"
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">ОПИСАНИЕ</label>
                <textarea
                  value={bizDesc}
                  onChange={(e) => setBizDesc(e.target.value)}
                  placeholder="Краткое описание"
                  rows={2}
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">АДРЕС</label>
                <input
                  value={bizAddress}
                  onChange={(e) => setBizAddress(e.target.value)}
                  placeholder="Улица, дом..."
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">ТЕЛЕФОН</label>
                <input
                  value={bizPhone}
                  onChange={(e) => setBizPhone(e.target.value)}
                  placeholder="+7 (999) 000-00-00"
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs font-bold text-slate-700">Работает сейчас? (Статус)</span>
                <input
                  type="checkbox"
                  checked={bizIsOpen}
                  onChange={(e) => setBizIsOpen(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-indigo-600 outline-none cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={handleUpdateSettings}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-black text-white hover:bg-indigo-600 transition mt-2"
              >
                <Save size={14} />
                Сохранить настройки
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
