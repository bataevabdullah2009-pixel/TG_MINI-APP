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
  AlertCircle,
  ClipboardList,
  Calendar,
  Users,
  ExternalLink,
  Phone,
  Trash2,
  AlertTriangle,
  Layers,
  MapPin,
  Check,
  User,
  Clock
} from "lucide-react";
import { MediaUpload } from "./MediaUpload";
import { AiCenter } from "./AiCenter";

interface SellerHomeProps {
  session: any;
  businessId: string;
}

export function SellerHome({ session, businessId }: SellerHomeProps) {
  const [activeTab, setActiveTab] = useState<
    "DASHBOARD" | "ORDERS" | "BOOKINGS" | "ITEMS" | "AI" | "CLIENTS" | "MEDIA" | "SETTINGS"
  >("DASHBOARD");
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
  const [customers, setCustomers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Catalog tab forms
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemType, setNewItemType] = useState<"PRODUCT" | "SERVICE">("PRODUCT");
  const [newItemImage, setNewItemImage] = useState("");
  
  // Category management inside catalog
  const [newCatName, setNewCatName] = useState("");
  const [showCatForm, setShowCatForm] = useState(false);

  // Settings State
  const [bizName, setBizName] = useState("");
  const [bizDesc, setBizDesc] = useState("");
  const [bizAddress, setBizAddress] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [bizIsOpen, setBizIsOpen] = useState(true);

  // Media state
  const [bizLogoUrl, setBizLogoUrl] = useState("");
  const [bizCoverUrl, setBizCoverUrl] = useState("");
  const [bizColor, setBizColor] = useState("#3B82F6");

  // Filters for orders and bookings
  const [orderFilter, setOrderFilter] = useState<string>("ALL");
  const [bookingFilter, setBookingFilter] = useState<string>("ALL");

  useEffect(() => {
    fetchSellerData();
  }, [businessId]);

  const fetchSellerData = async () => {
    setLoading(true);
    try {
      const initData = typeof window !== "undefined" ? (window as any).Telegram?.WebApp?.initData : "";
      const authHeaders = initData ? { "x-telegram-init-data": initData } : {};

      // 1. Fetch Business Profile
      const bizRes = await fetch(`/api/businesses/${businessId}`, { headers: authHeaders });
      if (bizRes.ok) {
        const bData = await bizRes.json();
        setBusinessData(bData);
        setBizName(bData.name || "");
        setBizDesc(bData.description || "");
        setBizAddress(bData.address || "");
        setBizPhone(bData.phone || "");
        setBizIsOpen(bData.isOpen === undefined ? true : bData.isOpen);
        setBizLogoUrl(bData.logoUrl || "");
        setBizCoverUrl(bData.coverImageUrl || "");
        setBizColor(bData.primaryColor || "#3B82F6");
      }

      let fetchedItemsCount = 0;

      // 2. Fetch Catalog (Items & Categories)
      const catRes = await fetch(`/api/businesses/${businessId}/catalog`, { headers: authHeaders });
      if (catRes.ok) {
        const cData = await catRes.json();
        setItems(cData.items || []);
        fetchedItemsCount = cData.items?.length || 0;
        setCategories(cData.categories || []);
        if (cData.categories?.length > 0 && !newItemCategory) {
          setNewItemCategory(cData.categories[0].id);
        }
      }

      // 3. Fetch CRM Customers
      const custRes = await fetch(`/api/admin/customers?businessId=${businessId}`, { headers: authHeaders });
      if (custRes.ok) {
        const custData = await custRes.json();
        setCustomers(custData.data || []);
      }

      // 4. Fetch Orders and Bookings
      const ordRes = await fetch(`/api/orders?businessId=${businessId}`, { headers: authHeaders });
      const bookRes = await fetch(`/api/bookings?businessId=${businessId}`, { headers: authHeaders });
      
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
        totalItems: fetchedItemsCount,
        orders: ords,
        bookings: bks,
      });

    } catch (e) {
      console.error(e);
      showError("Ошибка загрузки данных продавца");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;

    try {
      const initData = typeof window !== "undefined" ? (window as any).Telegram?.WebApp?.initData : "";
      const res = await fetch(`/api/businesses/${businessId}/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(initData ? { "x-telegram-init-data": initData } : {}),
        },
        body: JSON.stringify({
          name: newCatName,
          isActive: true,
        }),
      });

      if (res.ok) {
        showSuccess("Категория добавлена!");
        setNewCatName("");
        setShowCatForm(false);
        fetchSellerData();
      } else {
        const d = await res.json();
        showError(d.error || "Не удалось создать категорию");
      }
    } catch (err) {
      showError("Ошибка сети");
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice) {
      showError("Заполните обязательные поля!");
      return;
    }

    try {
      const initData = typeof window !== "undefined" ? (window as any).Telegram?.WebApp?.initData : "";
      const res = await fetch("/api/admin/items", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(initData ? { "x-telegram-init-data": initData } : {})
        },
        body: JSON.stringify({
          businessId,
          categoryId: newItemCategory,
          name: newItemName,
          price: parseFloat(newItemPrice),
          description: newItemDesc,
          type: newItemType,
          imageUrl: newItemImage || undefined,
          isAvailable: true,
        }),
      });

      if (res.ok) {
        showSuccess("Позиция успешно добавлена!");
        setNewItemName("");
        setNewItemPrice("");
        setNewItemDesc("");
        setNewItemImage("");
        fetchSellerData();
      } else {
        const rData = await res.json();
        showError(rData.error || "Не удалось добавить товар");
      }
    } catch (e) {
      showError("Ошибка соединения с сервером");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Вы действительно хотите удалить эту позицию?")) return;

    try {
      const initData = typeof window !== "undefined" ? (window as any).Telegram?.WebApp?.initData : "";
      const res = await fetch(`/api/admin/items/${itemId}`, {
        method: "DELETE",
        headers: {
          ...(initData ? { "x-telegram-init-data": initData } : {})
        }
      });

      if (res.ok) {
        showSuccess("Позиция удалена!");
        fetchSellerData();
      } else {
        showError("Не удалось удалить товар");
      }
    } catch (err) {
      showError("Ошибка сети");
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        showSuccess("Статус заказа обновлен!");
        fetchSellerData();
      } else {
        showError("Не удалось обновить статус заказа");
      }
    } catch (err) {
      showError("Ошибка сети");
    }
  };

  const handleUpdateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        showSuccess("Статус записи изменен!");
        fetchSellerData();
      } else {
        showError("Не удалось обновить запись");
      }
    } catch (err) {
      showError("Ошибка сети");
    }
  };

  const handleUpdateSettings = async () => {
    setError(null);
    try {
      const initData = typeof window !== "undefined" ? (window as any).Telegram?.WebApp?.initData : "";
      const res = await fetch(`/api/admin/current-business`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          ...(initData ? { "x-telegram-init-data": initData } : {}),
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
        showSuccess("Настройки сохранены!");
        fetchSellerData();
      } else {
        showError("Не удалось обновить настройки");
      }
    } catch (e) {
      showError("Ошибка сохранения");
    }
  };

  const handleUpdateMedia = async () => {
    setError(null);
    try {
      const initData = typeof window !== "undefined" ? (window as any).Telegram?.WebApp?.initData : "";
      const res = await fetch(`/api/admin/current-business`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          ...(initData ? { "x-telegram-init-data": initData } : {}),
          "x-business-id": businessId 
        },
        body: JSON.stringify({
          logoUrl: bizLogoUrl,
          coverImageUrl: bizCoverUrl,
          primaryColor: bizColor,
        }),
      });

      if (res.ok) {
        showSuccess("Оформление обновлено!");
        fetchSellerData();
      } else {
        showError("Не удалось сохранить оформление");
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

  const openStorefront = () => {
    if (businessData?.slug) {
      window.open(`/${businessData.slug}/catalog`, "_blank");
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-500">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent mb-3" />
        <span className="text-xs font-black tracking-wider uppercase">Загрузка панели...</span>
      </div>
    );
  }

  return (
    <div className="pb-28 text-slate-900 min-h-screen bg-slate-50 relative">
      {/* Dynamic Header */}
      <section className="bg-slate-900 text-white px-4 pb-4.5 pt-5 relative shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Управление бизнесом</p>
            <h1 className="text-xl font-black truncate max-w-[200px]">{bizName || "Панель Продавца"}</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-black ${
              bizIsOpen ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
            }`}>
              {bizIsOpen ? "• Открыто" : "• Закрыто"}
            </span>
            <button 
              onClick={openStorefront}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-white"
              title="Открыть витрину"
            >
              <ExternalLink size={12} />
            </button>
          </div>
        </div>

        {/* Dynamic Nav tabs */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar mt-4 pt-1">
          {[
            { id: "DASHBOARD", label: "Главная", icon: <TrendingUp size={11} /> },
            { id: "ORDERS", label: "Заказы", icon: <ClipboardList size={11} /> },
            { id: "BOOKINGS", label: "Записи", icon: <Calendar size={11} /> },
            { id: "ITEMS", label: "Товары", icon: <ShoppingBag size={11} /> },
            { id: "AI", label: "ИИ-Маркетинг", icon: <Sparkles size={11} /> },
            { id: "CLIENTS", label: "Клиенты", icon: <Users size={11} /> },
            { id: "MEDIA", label: "Медиа", icon: <ImageIcon size={11} /> },
            { id: "SETTINGS", label: "Настройки", icon: <SettingsIcon size={11} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${
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

      {/* Page Context render switcher */}
      <div className="p-4 max-w-md mx-auto">
        
        {/* Tab 1: Dashboard */}
        {activeTab === "DASHBOARD" && (
          <div className="space-y-4">
            
            {/* KPI metrics row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100/80">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">ВЫРУЧКА СЕГОДНЯ</span>
                <strong className="text-xl font-black text-slate-950 mt-1 block">{stats.todayRevenue} ₽</strong>
              </div>
              <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100/80">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">ОЧЕРЕДЬ ЗАПРОСОВ</span>
                <strong className="text-xl font-black text-slate-950 mt-1 block">{stats.activeQueue} шт.</strong>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="bg-white rounded-3xl p-4.5 shadow-sm ring-1 ring-slate-100/80 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Быстрые действия</h3>
              <div className="grid grid-cols-2 gap-2 text-center text-[11px] font-black">
                <button 
                  onClick={() => { setActiveTab("ITEMS"); setNewItemType("PRODUCT"); }}
                  className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl hover:bg-indigo-100 transition active:scale-95 flex flex-col items-center gap-1.5"
                >
                  <Plus size={16} /> Добавить товар
                </button>
                <button 
                  onClick={() => { setActiveTab("ITEMS"); setNewItemType("SERVICE"); }}
                  className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl hover:bg-indigo-100 transition active:scale-95 flex flex-col items-center gap-1.5"
                >
                  <Plus size={16} /> Добавить услугу
                </button>
                <button 
                  onClick={() => setActiveTab("AI")}
                  className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl hover:bg-emerald-100 transition active:scale-95 flex flex-col items-center gap-1.5 col-span-2"
                >
                  <Sparkles size={16} fill="currentColor" /> Создать промо-пост с ИИ
                </button>
                <button 
                  onClick={() => setActiveTab("MEDIA")}
                  className="p-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition active:scale-95"
                >
                  Изменить логотип
                </button>
                <button 
                  onClick={openStorefront}
                  className="p-2.5 bg-slate-950 text-white rounded-xl hover:bg-slate-900 transition active:scale-95 flex items-center justify-center gap-1"
                >
                  Витрина <ExternalLink size={10} />
                </button>
              </div>
            </div>

            {/* Active/Today Orders */}
            <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100/80">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Новые заказы</h3>
                <button onClick={() => setActiveTab("ORDERS")} className="text-[10px] font-black text-indigo-600 hover:underline">
                  Все ({stats.orders.length}) →
                </button>
              </div>
              {stats.orders.filter(o => o.status === "NEW").length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-400 font-medium">Новых заказов нет</p>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {stats.orders.filter(o => o.status === "NEW").slice(0, 4).map((o: any) => (
                    <div key={o.id} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <strong className="text-xs text-slate-800">Заказ #{o.id.slice(-5).toUpperCase()}</strong>
                        <span className="text-[9px] block text-slate-400 font-semibold">{o.customerName} · {o.customerPhone}</span>
                      </div>
                      <button 
                        onClick={() => handleUpdateOrderStatus(o.id, "PROCESSING")}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] px-3 py-1 rounded-lg"
                      >
                        Принять
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bookings shortcut */}
            {stats.bookings.filter(b => b.status === "NEW").length > 0 && (
              <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100/80">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Новые записи</h3>
                  <button onClick={() => setActiveTab("BOOKINGS")} className="text-[10px] font-black text-indigo-600 hover:underline">
                    Все →
                  </button>
                </div>
                <div className="space-y-2">
                  {stats.bookings.filter(b => b.status === "NEW").slice(0, 3).map((b: any) => (
                    <div key={b.id} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <strong className="text-xs text-slate-800">{b.customerName}</strong>
                        <span className="text-[9px] block text-slate-400 font-semibold">
                          📅 {new Date(b.startTime).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <button 
                          onClick={() => handleUpdateBookingStatus(b.id, "CONFIRMED")}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] px-2.5 py-1 rounded-lg"
                        >
                          Подтвердить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Orders Panel */}
        {activeTab === "ORDERS" && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-4.5 shadow-sm ring-1 ring-slate-100/80">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3.5">Управление заказами</h3>
              
              {/* Filter statuses */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-3">
                {["ALL", "NEW", "PROCESSING", "READY", "COMPLETED", "CANCELLED"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setOrderFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black tracking-wider uppercase transition-all ${
                      orderFilter === status 
                        ? "bg-indigo-600 text-white shadow-xs" 
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {status === "ALL" ? "Все" : status}
                  </button>
                ))}
              </div>

              {/* Orders List */}
              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                {stats.orders.filter(o => orderFilter === "ALL" || o.status === orderFilter).length === 0 ? (
                  <p className="text-center py-10 text-xs text-slate-400 font-medium">Нет заказов с этим статусом</p>
                ) : (
                  stats.orders.filter(o => orderFilter === "ALL" || o.status === orderFilter).map((order: any) => (
                    <div key={order.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <strong className="text-xs text-slate-900 block font-extrabold">
                            Заказ #{order.id.slice(-6).toUpperCase()}
                          </strong>
                          <span className="text-[10px] font-bold text-slate-400">
                            {new Date(order.createdAt).toLocaleString("ru-RU")}
                          </span>
                        </div>
                        <span className={`text-[9px] font-black rounded-full px-2 py-0.5 ${
                          order.status === "NEW" ? "bg-amber-100 text-amber-700" :
                          order.status === "PROCESSING" ? "bg-indigo-100 text-indigo-700" :
                          order.status === "READY" ? "bg-cyan-100 text-cyan-700" :
                          order.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                          "bg-slate-200 text-slate-500"
                        }`}>
                          {order.status}
                        </span>
                      </div>

                      {/* Info customer */}
                      <div className="text-xs text-slate-600 bg-white rounded-xl p-2.5 border border-slate-100/50 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <User size={12} className="text-slate-400" />
                          <span className="font-bold">{order.customerName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone size={12} className="text-slate-400" />
                          <a href={`tel:${order.customerPhone}`} className="text-indigo-600 underline font-semibold">
                            {order.customerPhone}
                          </a>
                        </div>
                        {order.customerAddress && (
                          <div className="flex items-center gap-1.5">
                            <MapPin size={12} className="text-slate-400" />
                            <span>{order.customerAddress}</span>
                          </div>
                        )}
                        {order.comment && (
                          <div className="text-[10px] text-slate-500 italic mt-1 border-t pt-1">
                            💬 "{order.comment}"
                          </div>
                        )}
                      </div>

                      {/* Items Ordered */}
                      <div className="text-[11px] font-bold text-slate-500 space-y-1 pl-1">
                        {order.items?.map((item: any) => (
                          <div key={item.id} className="flex justify-between">
                            <span>{item.name || item.item?.name} × {item.quantity}</span>
                            <span>{item.price * item.quantity} ₽</span>
                          </div>
                        ))}
                        <div className="border-t pt-1.5 flex justify-between font-black text-slate-900">
                          <span>Итого:</span>
                          <span className="text-indigo-600">{order.totalPrice} ₽</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-1 border-t border-slate-200/50">
                        {order.status === "NEW" && (
                          <>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, "PROCESSING")}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs py-2 rounded-xl transition"
                            >
                              Принять
                            </button>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, "CANCELLED")}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs px-3.5 py-2 rounded-xl transition"
                            >
                              Отклонить
                            </button>
                          </>
                        )}
                        {order.status === "PROCESSING" && (
                          <>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, "READY")}
                              className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs py-2 rounded-xl transition"
                            >
                              Готов к выдаче
                            </button>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, "CANCELLED")}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs px-3 py-2 rounded-xl transition"
                            >
                              Отменить
                            </button>
                          </>
                        )}
                        {order.status === "READY" && (
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, "COMPLETED")}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle size={14} /> Выдан клиенту
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Bookings Panel */}
        {activeTab === "BOOKINGS" && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-4.5 shadow-sm ring-1 ring-slate-100/80">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3.5">График записей</h3>

              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-3">
                {["ALL", "NEW", "CONFIRMED", "COMPLETED", "CANCELLED"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setBookingFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black tracking-wider uppercase transition-all ${
                      bookingFilter === status 
                        ? "bg-indigo-600 text-white shadow-xs" 
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {status === "ALL" ? "Все" : status}
                  </button>
                ))}
              </div>

              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                {stats.bookings.filter(b => bookingFilter === "ALL" || b.status === bookingFilter).length === 0 ? (
                  <p className="text-center py-10 text-xs text-slate-400 font-medium">Записей не обнаружено</p>
                ) : (
                  stats.bookings.filter(b => bookingFilter === "ALL" || b.status === bookingFilter).map((bk: any) => (
                    <div key={bk.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <strong className="text-xs text-slate-900 block font-extrabold">{bk.customerName}</strong>
                          <span className="text-[10px] font-bold text-indigo-600 block mt-0.5">
                            {bk.service?.name || "Услуга"}
                          </span>
                        </div>
                        <span className={`text-[9px] font-black rounded-full px-2 py-0.5 ${
                          bk.status === "NEW" ? "bg-amber-100 text-amber-700" :
                          bk.status === "CONFIRMED" ? "bg-indigo-100 text-indigo-700" :
                          bk.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                          "bg-slate-200 text-slate-500"
                        }`}>
                          {bk.status}
                        </span>
                      </div>

                      {/* Detail row */}
                      <div className="text-xs text-slate-600 bg-white rounded-xl p-2.5 border border-slate-100/50 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-slate-400" />
                          <span className="font-bold">
                            {new Date(bk.startTime).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone size={12} className="text-slate-400" />
                          <a href={`tel:${bk.customerPhone}`} className="text-indigo-600 underline font-semibold">
                            {bk.customerPhone}
                          </a>
                        </div>
                        {bk.staff?.name && (
                          <div className="flex items-center gap-1.5">
                            <User size={12} className="text-slate-400" />
                            <span>Мастер: {bk.staff.name}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {bk.status === "NEW" && (
                          <>
                            <button
                              onClick={() => handleUpdateBookingStatus(bk.id, "CONFIRMED")}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-750 text-white font-black text-xs py-2 rounded-xl transition"
                            >
                              Подтвердить
                            </button>
                            <button
                              onClick={() => handleUpdateBookingStatus(bk.id, "CANCELLED")}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs px-3 py-2 rounded-xl transition"
                            >
                              Отменить
                            </button>
                          </>
                        )}
                        {bk.status === "CONFIRMED" && (
                          <button
                            onClick={() => handleUpdateBookingStatus(bk.id, "COMPLETED")}
                            className="w-full bg-emerald-600 hover:bg-emerald-755 text-white font-black text-xs py-2 rounded-xl transition flex items-center justify-center gap-1.5"
                          >
                            <Check size={14} /> Выполнено (Завершить)
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Items catalog management */}
        {activeTab === "ITEMS" && (
          <div className="space-y-4">
            
            {/* Toggle category form */}
            <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100/80">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Категории меню ({categories.length})</h3>
                <button 
                  onClick={() => setShowCatForm(!showCatForm)}
                  className="text-[10px] font-black text-indigo-600 hover:underline flex items-center gap-0.5"
                >
                  <Plus size={10} /> Добавить
                </button>
              </div>

              {showCatForm && (
                <form onSubmit={handleCreateCategory} className="mt-3.5 flex gap-2">
                  <input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Например: Десерты"
                    className="flex-1 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none"
                    required
                  />
                  <button type="submit" className="rounded-xl bg-slate-900 text-white font-black text-xs px-4 py-2 hover:bg-indigo-600 transition">
                    Создать
                  </button>
                </form>
              )}
            </div>

            {/* Item add form */}
            <form onSubmit={handleAddItem} className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-slate-100/80 space-y-3.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Быстрое добавление</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">ФОТО ТОВАРА</label>
                  <MediaUpload
                    businessId={businessId}
                    type="gallery"
                    initialUrl={newItemImage}
                    onUploadComplete={setNewItemImage}
                  />
                </div>

                <div>
                  <input
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Название позиции (например: Эспрессо)"
                    className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    placeholder="Цена в ₽"
                    className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                    required
                  />

                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none cursor-pointer"
                  >
                    <option value="">Выберите категорию</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-100/50 p-1.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setNewItemType("PRODUCT")}
                    className={`py-2 text-[10px] font-black rounded-lg transition-all ${
                      newItemType === "PRODUCT" ? "bg-white text-slate-900 shadow-xs" : "text-slate-400"
                    }`}
                  >
                    🛍️ Товар
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewItemType("SERVICE")}
                    className={`py-2 text-[10px] font-black rounded-lg transition-all ${
                      newItemType === "SERVICE" ? "bg-white text-slate-900 shadow-xs" : "text-slate-400"
                    }`}
                  >
                    💇 Услуга
                  </button>
                </div>

                <textarea
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  placeholder="Описание состава, веса или особенностей..."
                  rows={2.5}
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none resize-none"
                />

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-950 py-3 text-xs font-black text-white hover:bg-indigo-650 transition"
                >
                  <Plus size={14} /> Добавить на витрину
                </button>
              </div>
            </form>

            {/* Listing grid catalog */}
            <div className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-slate-100/80">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Витрина заведения ({items.length})</h3>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-400 font-semibold">Ваш каталог пока пуст.</p>
                ) : (
                  items.map((it) => (
                    <div key={it.id} className="flex gap-3 items-center justify-between p-2 rounded-2xl border border-slate-50 bg-slate-50/40">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center text-slate-400">
                          {it.imageUrl ? (
                            <img src={it.imageUrl} className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon size={14} />
                          )}
                        </div>
                        <div>
                          <strong className="text-xs font-black text-slate-900 block">{it.name}</strong>
                          <span className="text-[10px] font-black text-indigo-600">{it.price} ₽</span>
                          {it.category?.name && (
                            <span className="text-[9px] font-bold text-slate-400 ml-1.5">
                              · {it.category.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteItem(it.id)}
                        className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 active:scale-95 transition"
                        title="Удалить"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: AI Marketing Center */}
        {activeTab === "AI" && (
          <div className="space-y-4">
            <AiCenter
              businessId={businessId}
              businessType={businessData?.type || "CAFE"}
              categories={categories}
              onItemCreated={fetchSellerData}
            />
          </div>
        )}

        {/* Tab 6: Customers List CRM */}
        {activeTab === "CLIENTS" && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-slate-100/80">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3.5">База клиентов ({customers.length})</h3>

              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {customers.length === 0 ? (
                  <p className="text-center py-12 text-xs text-slate-400 font-medium">Клиенты пока не заказывали товары</p>
                ) : (
                  customers.map((c) => (
                    <div key={c.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <strong className="text-xs font-black text-slate-900 block">{c.name || "Клиент"}</strong>
                          <span className="text-[9px] font-bold text-slate-400 font-mono">TG: @{c.username || "скрыт"}</span>
                        </div>
                        <a href={`tel:${c.phone}`} className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition">
                          <Phone size={11} />
                        </a>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-bold text-slate-500 bg-white p-2 rounded-xl border border-slate-100/50">
                        <div>
                          <p className="font-black text-xs text-slate-800">{c._count?.orders || 0}</p>
                          <p className="text-[8px] uppercase mt-0.5">Заказы</p>
                        </div>
                        <div className="border-l">
                          <p className="font-black text-xs text-slate-800">{c._count?.bookings || 0}</p>
                          <p className="text-[8px] uppercase mt-0.5">Записи</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 7: Media Design Configurator */}
        {activeTab === "MEDIA" && (
          <div className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-slate-100/80 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Медиа-оформление витрины</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">ЛОГОТИП ЗАВЕДЕНИЯ</label>
                <MediaUpload
                  businessId={businessId}
                  type="logo"
                  initialUrl={bizLogoUrl}
                  onUploadComplete={setBizLogoUrl}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">ОБЛОЖКА ВИТРИНЫ (COVER)</label>
                <MediaUpload
                  businessId={businessId}
                  type="cover"
                  initialUrl={bizCoverUrl}
                  onUploadComplete={setBizCoverUrl}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">ФИРМЕННЫЙ ЦВЕТ (HEX)</label>
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
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-950 py-3.5 text-xs font-black text-white hover:bg-indigo-650 transition mt-2 shadow-md shadow-indigo-600/5"
              >
                <Save size={14} /> Сохранить оформление
              </button>
            </div>
          </div>
        )}

        {/* Tab 8: Business Settings info */}
        {activeTab === "SETTINGS" && (
          <div className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-slate-100/80 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Параметры заведения</h3>
            
            <div className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">НАЗВАНИЕ</label>
                <input
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  placeholder="например: Кофейня Вкусняшка"
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">ОПИСАНИЕ</label>
                <textarea
                  value={bizDesc}
                  onChange={(e) => setBizDesc(e.target.value)}
                  placeholder="Свежий кофе, десерты и хорошее настроение."
                  rows={2.5}
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">АДРЕС</label>
                <input
                  value={bizAddress}
                  onChange={(e) => setBizAddress(e.target.value)}
                  placeholder="Москва, ул. Ленина, д. 10"
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">ТЕЛЕФОН</label>
                <input
                  value={bizPhone}
                  onChange={(e) => setBizPhone(e.target.value)}
                  placeholder="+7 (999) 000-00-00"
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs font-bold text-slate-700">Работает сейчас?</span>
                <input
                  type="checkbox"
                  checked={bizIsOpen}
                  onChange={(e) => setBizIsOpen(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-350 text-indigo-600 outline-none cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={handleUpdateSettings}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-950 py-3.5 text-xs font-black text-white hover:bg-indigo-650 transition mt-2 shadow-md shadow-indigo-600/5"
              >
                <Save size={14} /> Сохранить настройки
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
