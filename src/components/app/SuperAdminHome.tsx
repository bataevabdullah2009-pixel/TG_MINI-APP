"use client";

import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Plus, 
  Store, 
  ClipboardList, 
  Settings, 
  Sparkles, 
  AlertCircle, 
  CheckCircle,
  TrendingUp,
  BookOpen,
  Sliders,
  DollarSign,
  User,
  Calendar,
  Layers,
  ArrowRight,
  Database,
  ExternalLink
} from "lucide-react";
import { miniAppFetch } from "@/lib/miniAppFetch";
import { BottomSheetPicker } from "@/components/ui/BottomSheetPicker";
import { buildBusinessUrl } from "@/lib/production-url";

interface SuperAdminHomeProps {
  session: any;
  onManageBusiness?: (businessId: string) => void;
}

export function SuperAdminHome({ session, onManageBusiness }: SuperAdminHomeProps) {
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "BUSINESSES" | "CREATE_BUSINESS" | "ORDERS" | "BOOKINGS" | "AI_COSTS" | "SETTINGS">("OVERVIEW");
  const [loading, setLoading] = useState(true);
  
  // Platform metrics
  const [stats, setStats] = useState({
    totalBusinesses: 0,
    activeBusinesses: 0,
    totalOrdersToday: 0,
    aiQueriesToday: 0,
    totalCustomers: 0,
    totalRevenue: 0,
    planStats: [] as any[],
  });

  const [businesses, setBusinesses] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [aiUsageLogs, setAiUsageLogs] = useState<any[]>([]);
  const [aiRequestLogs, setAiRequestLogs] = useState<any[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create Business Form
  const [bizName, setBizName] = useState("");
  const [bizSlug, setBizSlug] = useState("");
  const [bizType, setBizType] = useState("CAFE");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerTelegramId, setOwnerTelegramId] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [businessActionId, setBusinessActionId] = useState<string | null>(null);
  const [createdLinkCode, setCreatedLinkCode] = useState<string | null>(null);
  const [createdSellerDeepLink, setCreatedSellerDeepLink] = useState<string | null>(null);

  // Platform White-Label Customization
  const [platformTitle, setPlatformTitle] = useState("Vitrina AI");
  const [defaultAiProvider, setDefaultAiProvider] = useState("polza");
  const [defaultAiLimit, setDefaultAiLimit] = useState(15);
  const [allowedModules, setAllowedModules] = useState("catalog,cart,profile,booking,staff,calendar,delivery,pickup");

  useEffect(() => {
    fetchSaaSData();
  }, [activeTab]);

  const fetchSaaSData = async () => {
    setLoading(true);
    try {
      // 1. Fetch metrics
      try {
        const statsRes = await miniAppFetch("/api/admin/super/stats");
        if (statsRes.ok) {
          const sData = await statsRes.json();
          if (sData.ok && sData.data) {
            setStats(sData.data);
          } else if (sData.success) {
            setStats(sData.stats);
          }
        } else {
          console.warn("Failed to fetch stats, status:", statsRes.status);
        }
      } catch (err) {
        console.error("Error loading platform stats:", err);
      }

      // 2. Fetch businesses list
      try {
        const bizRes = await miniAppFetch("/api/admin/super/businesses");
        if (bizRes.ok) {
          const bData = await bizRes.json();
          setBusinesses(bData.data || []);
        } else {
          console.warn("Failed to fetch businesses list, status:", bizRes.status);
        }
      } catch (err) {
        console.error("Error loading businesses list:", err);
      }

      // 3. Fetch orders (global)
      if (activeTab === "ORDERS" || activeTab === "OVERVIEW") {
        try {
          const ordRes = await miniAppFetch("/api/orders?limit=50");
          if (ordRes.ok) {
            const oData = await ordRes.json();
            setOrders(oData || []);
          } else {
            console.warn("Failed to fetch orders, status:", ordRes.status);
          }
        } catch (err) {
          console.error("Error loading orders list:", err);
        }
      }

      // 4. Fetch bookings (global)
      if (activeTab === "BOOKINGS" || activeTab === "OVERVIEW") {
        try {
          const bookRes = await miniAppFetch("/api/bookings?limit=50");
          if (bookRes.ok) {
            const bkData = await bookRes.json();
            setBookings(bkData || []);
          } else {
            console.warn("Failed to fetch bookings, status:", bookRes.status);
          }
        } catch (err) {
          console.error("Error loading bookings list:", err);
        }
      }

      // 5. Fetch AI expenses logs
      if (activeTab === "AI_COSTS") {
        try {
          const aiLogsRes = await miniAppFetch("/api/admin/super/ai-logs?limit=50");
          if (aiLogsRes.ok) {
            const aiData = await aiLogsRes.json();
            if (aiData.ok && aiData.data) {
              setAiUsageLogs(aiData.data.usageLogs || []);
              setAiRequestLogs(aiData.data.requestLogs || []);
            } else if (aiData.success) {
              setAiUsageLogs(aiData.usageLogs || []);
              setAiRequestLogs(aiData.requestLogs || []);
            }
          } else {
            console.warn("Failed to fetch AI logs, status:", aiLogsRes.status);
          }
        } catch (err) {
          console.error("Error loading AI logs:", err);
        }
      }

    } catch (e) {
      console.error(e);
      showError("Ошибка загрузки данных платформы");
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
    setCreatedSellerDeepLink(null);
    setError(null);

    // Resolve templates key based on BusinessType selection
    let templateKey = "custom";
    const typeUpper = bizType.toUpperCase();
    if (typeUpper === "CAFE") templateKey = "cafe";
    else if (typeUpper === "BARBERSHOP") templateKey = "barbershop";
    else if (typeUpper === "SHOP") templateKey = "shop";
    else if (typeUpper === "GROCERY") templateKey = "grocery";
    else if (typeUpper === "HARDWARE_STORE") templateKey = "hardware_store";
    else if (typeUpper === "CARWASH") templateKey = "carwash";
    else if (typeUpper === "COURSES") templateKey = "courses";

    try {
      const res = await miniAppFetch("/api/admin/super/businesses", {
        method: "POST",
        body: JSON.stringify({
          name: bizName,
          slug: bizSlug,
          type: bizType,
          templateKey,
          ownerEmail,
          ownerPassword,
          ownerName,
          ownerPhone,
          ownerTelegramId,
          subscriptionStatus: "LIFETIME",
          aiEnabled: true,
          aiDailyLimit: defaultAiLimit.toString(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showSuccess("Бизнес успешно создан!");
        setBizName("");
        setBizSlug("");
        setOwnerEmail("");
        setOwnerPassword("");
        setOwnerName("");
        setOwnerPhone("");
        setOwnerTelegramId("");
        
        const linkCode = data.sellerLinkCode || data.owner?.telegramLinkCode;
        if (linkCode) {
          setCreatedLinkCode(linkCode);
          setCreatedSellerDeepLink(data.sellerDeepLink || null);
        } else {
          showError("Код продавца не создан сервером");
        }
        
        setActiveTab("OVERVIEW");
      } else {
        showError(data.error || "Ошибка создания бизнеса");
      }
    } catch (err) {
      showError("Не удалось связаться с сервером создания бизнеса. Проверьте соединение и попробуйте снова.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const savePlatformSettings = () => {
    showSuccess("Настройки платформы сохранены локально!");
  };

  const runBusinessAction = async (
    business: any,
    action: string,
    extra: Record<string, unknown> = {}
  ) => {
    setBusinessActionId(business.id);
    setError(null);
    try {
      const response = await miniAppFetch(
        `/api/admin/super/businesses/${business.id}/actions`,
        {
          method: "POST",
          body: JSON.stringify({ action, ...extra }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "Не удалось выполнить действие");
      }
      showSuccess("Изменения сохранены.");
      await fetchSaaSData();
    } catch (actionError) {
      showError(
        actionError instanceof Error
          ? actionError.message
          : "Не удалось выполнить действие"
      );
    } finally {
      setBusinessActionId(null);
    }
  };

  const markManualPayment = async (business: any) => {
    const amountText = window.prompt(
      "Сумма платежа в рублях",
      String(business.setupFeeAmount || 30000)
    );
    if (amountText === null) return;
    const comment = window.prompt("Комментарий к оплате", "") || "";
    await runBusinessAction(business, "PAYMENT", {
      type: "MANUAL",
      monthsAdded: 0,
      amount: Number(amountText),
      method: "MANUAL",
      comment,
    });
  };

  const editBusiness = async (business: any) => {
    const name = window.prompt("Название бизнеса", business.name);
    if (name === null) return;
    const ownerNameValue = window.prompt(
      "Имя владельца",
      business.owner?.name || ""
    );
    if (ownerNameValue === null) return;
    const ownerPhoneValue = window.prompt(
      "Телефон владельца",
      business.owner?.phone || ""
    );
    if (ownerPhoneValue === null) return;
    await runBusinessAction(business, "EDIT", {
      name,
      ownerName: ownerNameValue,
      ownerPhone: ownerPhoneValue,
    });
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const getTemplateIcon = (key: string) => {
    switch (key) {
      case "cafe": return "🍔";
      case "barbershop": return "💈";
      case "shop": return "🛒";
      case "grocery": return "🍎";
      case "hardware_store": return "🔧";
      case "carwash": return "🚗";
      case "courses": return "📚";
      default: return "⚙️";
    }
  };

  const subscriptionStatusLabel: Record<string, string> = {
    ACTIVE: "Активна",
    TRIAL: "Пробный период",
    PAST_DUE: "Просрочена",
    BLOCKED: "Заблокирована",
    LIFETIME: "Бессрочная",
    ARCHIVED: "Архив",
    EXPIRED: "Истекла",
  };

  const renewalOptions = [
    { action: "RENEW_1M", label: "Продлить 1 мес", months: 1 },
    { action: "RENEW_3M", label: "Продлить 3 мес", months: 3 },
    { action: "RENEW_6M", label: "Продлить 6 мес", months: 6 },
    { action: "RENEW_12M", label: "Продлить 12 мес", months: 12 },
  ];

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString("ru-RU") : "без срока";

  return (
    <div className="pb-24 text-slate-900 min-h-screen bg-slate-50">
      
      {/* SaaS Dashboard Title block */}
      <section className="bg-slate-950 text-white px-5 pb-5 pt-5 border-b border-slate-800">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400">Панель Управления Super Admin</p>
            <h1 className="text-xl font-black">{platformTitle} SaaS</h1>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <ShieldCheck size={18} />
          </span>
        </div>

        {/* Unified sub-navigation for Super Admin */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar pt-1">
          {[
            { id: "OVERVIEW", label: "Обзор SaaS", icon: <TrendingUp size={11} /> },
            { id: "BUSINESSES", label: "Бизнесы", icon: <Store size={11} /> },
            { id: "CREATE_BUSINESS", label: "Создать бизнес", icon: <Plus size={11} /> },
            { id: "ORDERS", label: "Заказы", icon: <ClipboardList size={11} /> },
            { id: "BOOKINGS", label: "Записи", icon: <Calendar size={11} /> },
            { id: "AI_COSTS", label: "ИИ-расходы", icon: <Sparkles size={11} /> },
            { id: "SETTINGS", label: "Настройки платформы", icon: <Settings size={11} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${
                activeTab === tab.id 
                  ? "bg-white text-slate-950 shadow-md" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Floating Alerts */}
      {error && (
        <div className="fixed top-4 inset-x-4 z-50 flex items-center gap-2.5 rounded-2xl bg-rose-600 p-3.5 text-xs font-black text-white shadow-xl">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="fixed top-4 inset-x-4 z-50 flex items-center gap-2.5 rounded-2xl bg-emerald-600 p-3.5 text-xs font-black text-white shadow-xl">
          <CheckCircle size={16} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {loading && (
        <div className="p-12 text-center text-xs text-slate-400 font-bold flex flex-col justify-center items-center">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-slate-950 mb-3" />
          Загрузка данных...
        </div>
      )}

      {/* Content Panels */}
      {!loading && (
        <div className="p-4 max-w-md mx-auto space-y-4">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === "OVERVIEW" && (
            <div className="space-y-4">
              
              {/* Metrics cards grid */}
              <div className="grid grid-cols-2 gap-2.5 text-slate-900">
                <div className="bg-white rounded-2xl p-3 shadow-sm ring-1 ring-slate-100">
                  <span className="text-[8px] font-black text-slate-400 uppercase block tracking-wider">Всего бизнесов</span>
                  <strong className="text-lg font-black text-slate-950 mt-1 block">{stats.totalBusinesses}</strong>
                  <span className="text-[8px] text-slate-400 font-semibold mt-0.5 block">Активных: {stats.activeBusinesses}</span>
                </div>
                <div className="bg-white rounded-2xl p-3 shadow-sm ring-1 ring-slate-100">
                  <span className="text-[8px] font-black text-slate-400 uppercase block tracking-wider">Выручка (заказы)</span>
                  <strong className="text-lg font-black text-slate-950 mt-1 block">{stats.totalRevenue.toLocaleString()} ₽</strong>
                  <span className="text-[8px] text-slate-400 font-semibold mt-0.5 block">Без учета отмененных</span>
                </div>
                <div className="bg-white rounded-2xl p-3 shadow-sm ring-1 ring-slate-100">
                  <span className="text-[8px] font-black text-slate-400 uppercase block tracking-wider">Заказы сегодня</span>
                  <strong className="text-lg font-black text-slate-950 mt-1 block">{stats.totalOrdersToday} шт</strong>
                  <span className="text-[8px] text-indigo-500 font-semibold mt-0.5 block">В реальном времени</span>
                </div>
                <div className="bg-white rounded-2xl p-3 shadow-sm ring-1 ring-slate-100">
                  <span className="text-[8px] font-black text-slate-400 uppercase block tracking-wider">Запросы ИИ сегодня</span>
                  <strong className="text-lg font-black text-slate-950 mt-1 block">{stats.aiQueriesToday} шт</strong>
                  <span className="text-[8px] text-emerald-500 font-semibold mt-0.5 block">Контроль квот</span>
                </div>
              </div>

              {/* Link Code Notification Banner */}
              {createdLinkCode && (
                <div className="rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-200 text-center space-y-2">
                  <h4 className="text-xs font-black text-amber-800 uppercase tracking-wider">КОД ПОДТВЕРЖДЕНИЯ ПРОДАВЦА</h4>
                  <div className="rounded-xl bg-white border border-amber-300 py-3 text-lg font-black text-slate-950 tracking-widest select-all shadow-sm">
                    {createdLinkCode}
                  </div>
                  <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
                    Передайте этот код владельцу бизнеса. Он должен отправить его боту в Telegram: <code className="bg-amber-100 px-1.5 py-0.5 rounded font-black text-[11px]">/link {createdLinkCode}</code> для завершения привязки и входа.
                  </p>
                  {createdSellerDeepLink && (
                    <a
                      href={createdSellerDeepLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-[10px] font-black text-white shadow-sm active:scale-95 transition"
                    >
                      <ExternalLink size={12} />
                      Открыть привязку продавца
                    </a>
                  )}
                </div>
              )}

              {/* Short Recent Businesses Table */}
              <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Последние подключенные ({businesses.length})</h3>
                  <button onClick={() => setActiveTab("BUSINESSES")} className="text-[10px] font-black text-indigo-600">Все →</button>
                </div>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {businesses.slice(0, 5).map((biz) => (
                    <div key={biz.id} className="flex justify-between items-center p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <strong className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                          <span>{getTemplateIcon(biz.templateKey)}</span>
                          {biz.name}
                        </strong>
                        <span className="text-[9px] font-bold text-slate-400 block mt-0.5">Ссылка: /app/{biz.slug}</span>
                      </div>
                      <button
                        onClick={() => onManageBusiness?.(biz.id)}
                        className="text-[9px] font-black bg-indigo-50 text-indigo-700 px-2.5 py-1.5 rounded-lg active:scale-95 transition"
                      >
                        Управлять →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BUSINESSES */}
          {activeTab === "BUSINESSES" && (
            <div className="space-y-3">
              <div className="mb-1">
                <h3 className="text-sm font-black text-slate-900">Каталог бизнесов на платформе</h3>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Полный список белых клиентов в системе ({businesses.length})</p>
              </div>

              {businesses.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-slate-100">
                  <span className="text-4xl">🏢</span>
                  <h4 className="text-xs font-black text-slate-800 mt-3">Нет созданных бизнесов</h4>
                  <button 
                    onClick={() => setActiveTab("CREATE_BUSINESS")}
                    className="mt-3 rounded-xl bg-indigo-600 text-white px-4 py-2 text-[10px] font-black"
                  >
                    Создать первый бизнес
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {businesses.map((biz) => (
                    <div 
                      key={biz.id} 
                      className="bg-white rounded-3xl p-4 ring-1 ring-slate-100 shadow-sm space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <strong className="text-sm font-black text-slate-950 flex items-center gap-1.5">
                            <span className="text-lg">{getTemplateIcon(biz.templateKey)}</span>
                            {biz.name}
                          </strong>
                          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                            Ссылка: <span className="text-slate-800 font-bold select-all">/app/{biz.slug}</span> | Тип: {biz.type}
                          </p>
                          <p className="mt-1 text-[10px] font-semibold text-slate-500">
                            Владелец: {biz.owner?.name || "не указан"} · {biz.owner?.phone || "телефон не указан"}
                          </p>
                        </div>
                        <span className={`text-[9px] font-black px-2 py-1 rounded-full ${
                          biz.subscriptionStatus === "BLOCKED" || biz.isBlocked
                            ? "bg-rose-50 text-rose-700"
                            : biz.subscriptionStatus === "PAST_DUE"
                              ? "bg-amber-50 text-amber-700"
                              : biz.isArchived || biz.isDeleted
                                ? "bg-slate-100 text-slate-600"
                                : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {subscriptionStatusLabel[biz.subscriptionStatus] || biz.subscriptionStatus}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 text-[10px] font-bold text-slate-600">
                        <div>
                          <span className="block text-[8px] uppercase tracking-wider text-slate-400">Тариф</span>
                          <strong>{biz.planName || biz.subscriptionPlan?.name || "Commercial"}</strong>
                        </div>
                        <div>
                          <span className="block text-[8px] uppercase tracking-wider text-slate-400">Стоимость</span>
                          <strong>{Number(biz.setupFeeAmount || 30000).toLocaleString("ru-RU")} ₽ + {Number(biz.monthlyFeeAmount || 3000).toLocaleString("ru-RU")} ₽/мес</strong>
                        </div>
                        <div>
                          <span className="block text-[8px] uppercase tracking-wider text-slate-400">Доступ</span>
                          <strong>{biz.subscriptionStatus === "LIFETIME" ? "Навсегда" : formatDate(biz.subscriptionEndDate)}</strong>
                        </div>
                        <div>
                          <span className="block text-[8px] uppercase tracking-wider text-slate-400">Осталось дней</span>
                          <strong>{biz.daysRemaining === null ? "∞" : biz.daysRemaining}</strong>
                        </div>
                        <div>
                          <span className="block text-[8px] uppercase tracking-wider text-slate-400">Заказы</span>
                          <strong>{biz._count?.orders || 0}</strong>
                        </div>
                        <div>
                          <span className="block text-[8px] uppercase tracking-wider text-slate-400">Создан</span>
                          <strong>{formatDate(biz.createdAt)}</strong>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => onManageBusiness?.(biz.id)}
                          disabled={businessActionId === biz.id}
                          className="rounded-xl bg-slate-900 px-2 py-2.5 text-[10px] font-black text-white disabled:opacity-50"
                        >
                          Управлять бизнесом
                        </button>
                        <button
                          onClick={() => window.location.assign(buildBusinessUrl(biz.slug))}
                          className="rounded-xl bg-indigo-50 px-2 py-2.5 text-[10px] font-black text-indigo-700"
                        >
                          Открыть витрину
                        </button>
                        <button onClick={() => editBusiness(biz)} className="rounded-xl bg-slate-100 px-2 py-2 text-[10px] font-black text-slate-700">
                          Редактировать
                        </button>
                        <button onClick={() => markManualPayment(biz)} disabled={businessActionId === biz.id} className="rounded-xl bg-amber-50 px-2 py-2 text-[10px] font-black text-amber-700 disabled:opacity-50">
                          Отметить оплату
                        </button>
                        <button onClick={() => runBusinessAction(biz, "PAY_SETUP")} disabled={businessActionId === biz.id || biz.setupPaid} className="rounded-xl bg-violet-50 px-2 py-2 text-[10px] font-black text-violet-700 disabled:opacity-40">
                          {biz.setupPaid ? "Подключение оплачено" : "Оплачено подключение"}
                        </button>
                        {renewalOptions.map((opt) => (
                          <button
                            key={opt.action}
                            onClick={() => runBusinessAction(biz, opt.action)}
                            disabled={businessActionId === biz.id}
                            className="rounded-xl bg-indigo-50 px-2 py-2 text-[10px] font-black text-indigo-700 disabled:opacity-50"
                          >
                            {opt.label} ({(3000 * opt.months).toLocaleString("ru-RU")} ₽)
                          </button>
                        ))}
                        {biz.isBlocked || biz.subscriptionStatus === "BLOCKED" ? (
                          <button onClick={() => runBusinessAction(biz, "UNBLOCK")} disabled={businessActionId === biz.id} className="rounded-xl bg-emerald-600 px-2 py-2 text-[10px] font-black text-white disabled:opacity-50">
                            Разблокировать
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              const reason = window.prompt("Причина блокировки", "Бизнес заблокирован администратором");
                              if (reason !== null) runBusinessAction(biz, "BLOCK", { reason });
                            }}
                            disabled={businessActionId === biz.id}
                            className="rounded-xl bg-rose-50 px-2 py-2 text-[10px] font-black text-rose-700 disabled:opacity-50"
                          >
                            Заблокировать вручную
                          </button>
                        )}
                        {biz.isArchived || biz.isDeleted ? (
                          <button onClick={() => runBusinessAction(biz, "RESTORE")} disabled={businessActionId === biz.id} className="rounded-xl bg-blue-600 px-2 py-2 text-[10px] font-black text-white disabled:opacity-50">
                            Восстановить бизнес
                          </button>
                        ) : (
                          <button
                            onClick={() => window.confirm("Архивировать бизнес? Клиенты перестанут его видеть.") && runBusinessAction(biz, "ARCHIVE")}
                            disabled={businessActionId === biz.id}
                            className="rounded-xl bg-slate-100 px-2 py-2 text-[10px] font-black text-slate-700 disabled:opacity-50"
                          >
                            Архивировать бизнес
                          </button>
                        )}
                        {!biz.isDeleted && (
                          <button
                            onClick={() => window.confirm("Безопасно удалить бизнес? Заказы сохранятся, бизнес можно восстановить.") && runBusinessAction(biz, "DELETE")}
                            disabled={businessActionId === biz.id}
                            className="col-span-2 rounded-xl bg-rose-600 px-2 py-2 text-[10px] font-black text-white disabled:opacity-50"
                          >
                            Удалить бизнес безопасно
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CREATE BUSINESS */}
          {activeTab === "CREATE_BUSINESS" && (
            <form onSubmit={handleCreateBusiness} className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Быстрый запуск предприятия</h3>
              
              <div className="space-y-3.5 text-xs font-bold">
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
                  <BottomSheetPicker
                    title="Выберите тип бизнеса"
                    value={bizType}
                    onChange={setBizType}
                    buttonClassName="rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                    options={[
                      { value: "CAFE", label: "Кафе / Ресторан", icon: <Store size={16} /> },
                      { value: "BARBERSHOP", label: "Барбершоп / Салон красоты", icon: <User size={16} /> },
                      { value: "SHOP", label: "Розничный магазин", icon: <Store size={16} /> },
                      { value: "GROCERY", label: "Продукты питания", icon: <Store size={16} /> },
                      { value: "HARDWARE_STORE", label: "Хозмаг / Стройматериалы", icon: <Layers size={16} /> },
                      { value: "CARWASH", label: "Автомойка / Автосервис", icon: <Sliders size={16} /> },
                      { value: "COURSES", label: "Курсы / Обучение", icon: <BookOpen size={16} /> },
                      { value: "CUSTOM", label: "Кастомный бизнес", icon: <Settings size={16} /> },
                    ]}
                  />
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

                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Имя владельца</label>
                  <input
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Абдуллах"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Телефон владельца</label>
                  <input
                    type="tel"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    placeholder="+7 999 123-45-67"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Telegram ID владельца</label>
                  <input
                    inputMode="numeric"
                    value={ownerTelegramId}
                    onChange={(e) => setOwnerTelegramId(e.target.value.replace(/[^\d-]/g, ""))}
                    placeholder="123456789"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                  />
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-indigo-500">Тариф</p>
                      <p className="mt-1 text-sm font-black text-slate-950">Commercial</p>
                    </div>
                    <div className="text-right text-[10px] font-bold text-slate-600">
                          <p>30 000 ₽ подключение</p>
                          <p>+ 3 000 ₽/мес подписка</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-amber-800">
                  После создания бизнес получает пробный период {14} дней. Для активации отметьте оплату подключения.
                </div>

                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-950 py-3 text-xs font-black text-white hover:bg-indigo-600 transition disabled:opacity-50 mt-1"
                >
                  <Plus size={13} />
                  {formSubmitting ? "Создаём бизнес..." : "Создать бизнес и код продавца"}
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: ORDERS */}
          {activeTab === "ORDERS" && (
            <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Все заказы на платформе ({orders.length})</h3>
              {orders.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-400 font-bold">Заказы отсутствуют</p>
              ) : (
                <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                  {orders.map((o) => (
                    <div key={o.id} className="p-3 border-b border-slate-100 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <strong className="text-slate-800">Заказ #{o.id.slice(-5).toUpperCase()}</strong>
                        <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                          {o.totalPrice} ₽
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold">
                        Бизнес: {o.business?.name || "Нейтральный"} · {new Date(o.createdAt).toLocaleString("ru-RU")}
                      </p>
                      <p className="text-[10px] text-slate-600 font-medium">
                        Клиент: {o.customerName} ({o.customerPhone})
                      </p>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-[9px] text-slate-400 font-black">Статус: {o.status}</span>
                        <span className="text-[9px] text-slate-400 font-bold">Доставка: {o.deliveryType}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: BOOKINGS */}
          {activeTab === "BOOKINGS" && (
            <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Все записи на платформе ({bookings.length})</h3>
              {bookings.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-400 font-bold">Записи отсутствуют</p>
              ) : (
                <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                  {bookings.map((b) => (
                    <div key={b.id} className="p-3 border-b border-slate-100 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <strong className="text-slate-800">{b.customerName}</strong>
                        <span className="text-[9px] font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                          {b.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold">
                        Бизнес: {b.business?.name || "Нейтральный"} · {new Date(b.startTime).toLocaleString("ru-RU")}
                      </p>
                      <p className="text-[10px] text-slate-600 font-medium">
                        Услуга: {b.service?.name || "Консультация"} ({b.service?.price || 0} ₽)
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold">
                        Специалист: {b.staff?.name || "Любой свободный"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: AI COSTS */}
          {activeTab === "AI_COSTS" && (
            <div className="space-y-4">
              
              {/* Request log breakdown */}
              <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Database size={13} className="text-indigo-500" />
                  Логи генерации ИИ ({aiRequestLogs.length})
                </h3>
                {aiRequestLogs.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-400 font-bold">Логи генерации отсутствуют</p>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 text-slate-800 text-[10px] font-bold">
                    {aiRequestLogs.map((log) => (
                      <div key={log.id} className="p-2 border-b border-slate-100 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-900 font-black truncate max-w-[120px]">{log.businessName}</span>
                          <span className="text-indigo-600 uppercase tracking-widest text-[8px]">{log.type}</span>
                        </div>
                        <p className="text-[9px] text-slate-400 font-semibold">Провайдер: {log.provider} ({log.model})</p>
                        <p className="text-slate-500 font-medium italic mt-0.5 truncate">Запрос: "{log.prompt}"</p>
                        <div className="flex justify-between pt-0.5 text-[8px] text-slate-400 font-black">
                          <span>Статус: {log.status}</span>
                          <span>{new Date(log.createdAt).toLocaleTimeString("ru-RU")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Usage & pricing control logs */}
              <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-amber-500" />
                  Учет расходов и квот ИИ ({aiUsageLogs.length})
                </h3>
                {aiUsageLogs.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-400 font-bold">Записи о расходах ИИ пусты</p>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 text-slate-800 text-[10px] font-bold">
                    {aiUsageLogs.map((log) => (
                      <div key={log.id} className="p-2 border-b border-slate-100 flex justify-between items-center">
                        <div>
                          <strong className="text-slate-900 block font-black">{log.businessName}</strong>
                          <span className="text-[9px] text-slate-400 font-semibold uppercase">{log.feature} · {log.provider}</span>
                        </div>
                        <div className="text-right">
                          <strong className="text-slate-900 block font-black">{log.cost.toFixed(4)} $</strong>
                          <span className="text-[8px] text-slate-400 font-bold block">{log.chars} симв.</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: PLATFORM SETTINGS */}
          {activeTab === "SETTINGS" && (
            <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100 space-y-3 text-slate-900">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Настройки SaaS Платформы</h3>
              
              <div className="space-y-3 text-xs font-bold">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Название платформы (White-Label)</label>
                  <input
                    value={platformTitle}
                    onChange={(e) => setPlatformTitle(e.target.value)}
                    className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Дефолтный ИИ-провайдер</label>
                  <BottomSheetPicker
                    title="Выберите AI-провайдера"
                    value={defaultAiProvider}
                    onChange={setDefaultAiProvider}
                    buttonClassName="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold outline-none"
                    options={[
                    { value: "polza", label: "Polza AI", description: "Провайдер для production", icon: <Sparkles size={16} /> },
                      { value: "openrouter", label: "OpenRouter", icon: <ArrowRight size={16} /> },
                    { value: "mock", label: "Тестовый ИИ", description: "Только для локальной разработки", icon: <Database size={16} /> },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Дневной лимит ИИ на один бизнес</label>
                  <input
                    type="number"
                    value={defaultAiLimit}
                    onChange={(e) => setDefaultAiLimit(parseInt(e.target.value) || 0)}
                    className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Включенные модули по умолчанию</label>
                  <textarea
                    value={allowedModules}
                    onChange={(e) => setAllowedModules(e.target.value)}
                    rows={3}
                    className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none resize-none leading-relaxed"
                  />
                </div>

                <button
                  type="button"
                  onClick={savePlatformSettings}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-black text-white hover:bg-indigo-600 transition mt-2"
                >
                  <Settings size={13} />
                  Сохранить настройки
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
