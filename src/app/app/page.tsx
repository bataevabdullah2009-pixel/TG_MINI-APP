"use client";

import { useEffect, useState } from "react";
import { Search, Settings, Star, Store, UserRound, Heart, ClipboardList, Shield, Home } from "lucide-react";
import { ClientHome } from "@/components/app/ClientHome";
import { ClientFavorites } from "@/components/app/ClientFavorites";
import { ClientOrders } from "@/components/app/ClientOrders";
import { ClientProfile } from "@/components/app/ClientProfile";
import { SellerHome } from "@/components/app/SellerHome";
import { ManagerWorkPanel } from "@/components/app/ManagerWorkPanel";
import { SuperAdminHome } from "@/components/app/SuperAdminHome";

type Business = {
  id: string;
  slug: string;
  name: string;
  type: string;
  typeLabel: string;
  templateKey: string;
  description?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  primaryColor: string;
  accentColor: string;
  rating: number;
  isOpen: boolean;
};

export default function MarketplacePage() {
  const [session, setSession] = useState<any>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Client tabs
  const [activeClientTab, setActiveClientTab] = useState<"HOME" | "FAVORITES" | "ORDERS" | "PROFILE">("HOME");
  
  // Upper Switcher for Owners/Admins
  const [activeWorkspaceMode, setActiveWorkspaceMode] = useState<"CUSTOMER" | "SELLER" | "MANAGER" | "SUPER_ADMIN">("CUSTOMER");

  // Search/Filters for ClientHome
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [favorites, setFavorites] = useState<string[]>([]);

  // Browser testing mock initData override
  const [mockInitData, setMockInitData] = useState("");
  const [showMockLogin, setShowMockLogin] = useState(false);
  const [selectedAdminBusinessId, setSelectedAdminBusinessId] = useState<string | null>(null);

  useEffect(() => {
    // Global fetch interceptor for Telegram Mini App
    if (typeof window !== "undefined" && !(window as any).__fetchIntercepted) {
      (window as any).__fetchIntercepted = true;
      const originalFetch = window.fetch;
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const tg = (window as any).Telegram?.WebApp;
        const tgInitData = tg?.initData || sessionStorage.getItem("tgInitData") || "";
        
        let url = "";
        if (typeof input === "string") {
          url = input;
        } else if (input instanceof URL) {
          url = input.toString();
        } else {
          url = input.url;
        }

        if (tgInitData && (url.startsWith("/") || url.includes(window.location.host))) {
          const headers = new Headers(init?.headers);
          if (!headers.has("x-telegram-init-data")) {
            headers.set("x-telegram-init-data", tgInitData);
          }
          const token = localStorage.getItem("accessToken");
          if (token && !headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${token}`);
          }
          
          if (input instanceof Request) {
            const newRequest = new Request(input, { ...init, headers });
            return originalFetch(newRequest);
          }
          
          return originalFetch(input, { ...init, headers });
        }
        return originalFetch(input, init);
      };
    }

    const tg = (window as any).Telegram?.WebApp;
    tg?.ready?.();
    tg?.expand?.();

    // Load favorites from localstorage
    const localFavorites = localStorage.getItem("favoriteBusinesses");
    if (localFavorites) setFavorites(JSON.parse(localFavorites));

    // Resolve URL query overrides (?mode=seller or ?mode=super)
    const searchParams = new URLSearchParams(window.location.search);
    const modeParam = searchParams.get("mode")?.toUpperCase();

    // Check Telegram initData
    const initData = tg?.initData || "";
    if (initData) {
      resolveUserSession(initData, modeParam);
    } else {
      // In development or browser mode, allow Mock Login
      setLoading(false);
      setShowMockLogin(true);
    }

    // Load global catalog businesses
    fetch(`/api/marketplace/businesses`)
      .then((res) => res.json())
      .then((data) => {
        setBusinesses(data.businesses || []);
      })
      .catch((err) => console.error("Error loading businesses:", err));
  }, []);

  const resolveUserSession = async (initData: string, modeOverride?: string) => {
    setLoading(true);
    setError(null);
    try {
      sessionStorage.setItem("tgInitData", initData); // Save to sessionStorage
      const res = await fetch("/api/auth/telegram-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.ok) {
        throw new Error(resData.error || "Не удалось авторизоваться");
      }

      const sessionData = resData.data;
      setSession(sessionData);

      // Determine initial workspace mode
      if (modeOverride === "SELLER" && (sessionData.role === "BUSINESS_OWNER" || sessionData.role === "SUPER_ADMIN")) {
        setActiveWorkspaceMode("SELLER");
      } else if (modeOverride === "SUPER" && sessionData.role === "SUPER_ADMIN") {
        setActiveWorkspaceMode("SUPER_ADMIN");
      } else if (sessionData.role === "MANAGER") {
        setActiveWorkspaceMode("MANAGER");
      } else {
        setActiveWorkspaceMode("CUSTOMER");
      }

      setShowMockLogin(false);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Ошибка авторизации");
    } finally {
      setLoading(false);
    }
  };

  const handleMockLogin = (role: "CUSTOMER" | "BUSINESS_OWNER" | "MANAGER" | "SUPER_ADMIN") => {
    // Generate valid mock user payloads depending on role
    let userId = 999901;
    let name = "Иван Клиент";
    let username = "customer_test";

    if (role === "BUSINESS_OWNER") {
      userId = 999902;
      name = "Дмитрий Продавец";
      username = "seller_test";
    } else if (role === "MANAGER") {
      userId = 999903;
      name = "Мария Менеджер";
      username = "manager_test";
    } else if (role === "SUPER_ADMIN") {
      userId = 999904;
      name = "Администратор SaaS";
      username = "saas_admin_test";
      // Ensure we push this ID to standard super admins list for tests if needed
    }

    const mockUser = {
      id: userId,
      first_name: name.split(" ")[0],
      last_name: name.split(" ")[1],
      username: username,
      language_code: "ru"
    };

    const searchParams = new URLSearchParams();
    searchParams.set("user", JSON.stringify(mockUser));
    searchParams.set("hash", "mock_hash");

    const mockInitDataStr = searchParams.toString();
    setMockInitData(mockInitDataStr);
    resolveUserSession(mockInitDataStr, role === "BUSINESS_OWNER" ? "SELLER" : role === "SUPER_ADMIN" ? "SUPER" : undefined);
  };

  const toggleFavorite = async (slug: string) => {
    const next = favorites.includes(slug) ? favorites.filter((item) => item !== slug) : [...favorites, slug];
    setFavorites(next);
    localStorage.setItem("favoriteBusinesses", JSON.stringify(next));

    if (session?.telegramUserId) {
      const biz = businesses.find((b) => b.slug === slug);
      if (biz) {
        await fetch("/api/customers/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telegramUserId: session.telegramUserId.toString(),
            businessId: biz.id,
          }),
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center text-slate-900">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-slate-950 mb-3" />
        <h4 className="font-extrabold text-sm">SmartBiz AI</h4>
        <p className="text-xs text-slate-400 mt-1">Авторизация...</p>
      </div>
    );
  }

  // Auth Fallback UI if not loaded via Telegram
  if (showMockLogin) {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-6 select-none">
        <div className="my-auto max-w-sm mx-auto text-center space-y-6">
          <div>
            <span className="grid h-16 w-16 place-items-center rounded-3xl bg-indigo-600/20 text-indigo-400 mx-auto text-4xl shadow-xl">
              🤖
            </span>
            <h1 className="text-2xl font-black mt-4">Вход через Telegram</h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Это приложение спроектировано для работы внутри Telegram Mini App.
            </p>
          </div>

          <div className="rounded-3xl bg-slate-800 p-5 ring-1 ring-slate-700/60 text-left space-y-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block text-center mb-1">
              💻 Эмулятор Разработчика (Browser Test)
            </span>
            
            <p className="text-[11px] text-slate-400 text-center leading-normal">
              Выберите демо-роль для моментального входа в систему без Telegram-клиента:
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-900">
              <button
                onClick={() => handleMockLogin("CUSTOMER")}
                className="rounded-xl bg-white hover:bg-indigo-50 py-3 text-center transition"
              >
                Покупатель
              </button>
              <button
                onClick={() => handleMockLogin("BUSINESS_OWNER")}
                className="rounded-xl bg-white hover:bg-indigo-50 py-3 text-center transition"
              >
                Продавец
              </button>
              <button
                onClick={() => handleMockLogin("MANAGER")}
                className="rounded-xl bg-white hover:bg-indigo-50 py-3 text-center transition"
              >
                Менеджер
              </button>
              <button
                onClick={() => handleMockLogin("SUPER_ADMIN")}
                className="rounded-xl bg-amber-400 hover:bg-amber-300 py-3 text-center transition"
              >
                Super Admin
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-600 font-medium">
          SmartBiz Platform © 2026
        </p>
      </main>
    );
  }

  return (
    <main className="w-full max-w-[480px] mx-auto min-h-[100dvh] bg-slate-50 text-slate-900 flex flex-col justify-between relative pb-24 overflow-x-hidden shadow-sm">
      
      {/* 1. UPPER ROLE SWITCHER (For Seller / Super Admin / Manager roles to switch back to Marketplace client catalog) */}
      {(session?.role === "BUSINESS_OWNER" || session?.role === "SUPER_ADMIN" || session?.role === "MANAGER") && activeWorkspaceMode !== "CUSTOMER" && (
        <div className="sticky top-0 z-40 bg-slate-900 text-white px-3 py-2 border-b border-slate-800 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between shadow-md">
          <span className="text-[10px] font-black text-indigo-400 tracking-wider uppercase">
            {session.role === "SUPER_ADMIN" ? "Администратор" : session.role === "BUSINESS_OWNER" ? "Владелец бизнеса" : "Управляющий"}
          </span>
          <div className="flex gap-1 overflow-x-auto no-scrollbar justify-end w-full sm:w-auto text-[10px] font-black">
            <button
              onClick={() => setActiveWorkspaceMode("CUSTOMER")}
              className={`rounded-lg px-2.5 py-1.5 transition shrink-0 ${
                (activeWorkspaceMode as string) === "CUSTOMER" ? "bg-indigo-600 text-white" : "bg-white/10 text-slate-300"
              }`}
            >
              Каталог
            </button>
            
            {session.role === "BUSINESS_OWNER" && (
              <button
                onClick={() => {
                  if (!session.businessId) {
                    setError("У вас пока нет подключённого бизнеса. Обратитесь к администратору платформы.");
                    setTimeout(() => setError(null), 4000);
                  } else {
                    setActiveWorkspaceMode("SELLER");
                  }
                }}
                className={`rounded-lg px-2.5 py-1.5 transition shrink-0 ${
                  activeWorkspaceMode === "SELLER" ? "bg-indigo-600 text-white" : "bg-white/10 text-slate-300"
                }`}
              >
                Мой бизнес
              </button>
            )}

            {session.role === "MANAGER" && (
              <button
                onClick={() => {
                  if (!session.businessId) {
                    setError("Вы пока не привязаны к бизнесу.");
                    setTimeout(() => setError(null), 4000);
                  } else {
                    setActiveWorkspaceMode("MANAGER");
                  }
                }}
                className={`rounded-lg px-2.5 py-1.5 transition shrink-0 ${
                  activeWorkspaceMode === "MANAGER" ? "bg-indigo-600 text-white" : "bg-white/10 text-slate-300"
                }`}
              >
                Моя работа
              </button>
            )}

            {session.role === "SUPER_ADMIN" && (
              <>
                <button
                  onClick={() => setActiveWorkspaceMode("SELLER")}
                  className={`rounded-lg px-2.5 py-1.5 transition shrink-0 ${
                    activeWorkspaceMode === "SELLER" ? "bg-indigo-600 text-white" : "bg-white/10 text-slate-300"
                  }`}
                >
                  Мой бизнес
                </button>
                <button
                  onClick={() => setActiveWorkspaceMode("SUPER_ADMIN")}
                  className={`rounded-lg px-2.5 py-1.5 transition shrink-0 ${
                    activeWorkspaceMode === "SUPER_ADMIN" ? "bg-indigo-600 text-white" : "bg-white/10 text-slate-300"
                  }`}
                >
                  SaaS Панель
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Dynamic Warning Notification */}
      {error && (
        <div className="m-4 flex items-center gap-2.5 rounded-2xl bg-rose-50 p-4 text-xs font-black text-rose-700 ring-1 ring-rose-200">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. DYNAMIC WORKSPACE DISPLAY BASED ON NAVIGATION ROLE MODE */}
      <div className="flex-1">
        
        {/* Case A: Client View (Default Customer Mode) */}
        {activeWorkspaceMode === "CUSTOMER" && (
          <>
            {activeClientTab === "HOME" && (
              <ClientHome
                businesses={businesses}
                query={query}
                setQuery={setQuery}
                activeCategory={activeCategory}
                setActiveCategory={setActiveCategory}
                loading={loading}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
              />
            )}

            {activeClientTab === "FAVORITES" && (
              <ClientFavorites telegramUserId={session?.telegramUserId?.toString()} />
            )}

            {activeClientTab === "ORDERS" && (
              <ClientOrders telegramUserId={session?.telegramUserId?.toString()} />
            )}

            {activeClientTab === "PROFILE" && (
              <ClientProfile
                session={session}
                onRefreshSession={() => resolveUserSession(mockInitData || (window as any).Telegram?.WebApp?.initData || "")}
                onSwitchMode={setActiveWorkspaceMode}
              />
            )}
          </>
        )}

        {/* Case B: Seller Dashboard Panel */}
        {activeWorkspaceMode === "SELLER" && (() => {
          const effectiveBusinessId = session.businessId || selectedAdminBusinessId;
          
          if (effectiveBusinessId) {
            return (
              <div>
                {session.role === "SUPER_ADMIN" && (
                  <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-800">
                    <span>Управление бизнесом как SUPER_ADMIN.</span>
                    <button 
                      onClick={() => setSelectedAdminBusinessId(null)}
                      className="underline font-bold"
                    >
                      Сменить заведение
                    </button>
                  </div>
                )}
                <SellerHome session={session} businessId={effectiveBusinessId} />
              </div>
            );
          }

          if (session.role === "SUPER_ADMIN") {
            if (businesses.length === 0) {
              return (
                <div className="p-8 text-center my-auto min-h-[50vh] flex flex-col justify-center items-center">
                  <span className="text-5xl mb-4">🏢</span>
                  <h3 className="text-lg font-black text-slate-800">Нет активных бизнесов</h3>
                  <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed mb-4">
                    В системе пока нет ни одного созданного бизнеса.
                  </p>
                  <button
                    onClick={() => setActiveWorkspaceMode("SUPER_ADMIN")}
                    className="rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-black text-white active:scale-95 transition-all shadow-md shadow-indigo-600/10"
                  >
                    Создать бизнес в SaaS Панели
                  </button>
                </div>
              );
            }

            return (
              <div className="p-6">
                <div className="mb-5">
                  <h3 className="text-lg font-black text-slate-900">Выберите бизнес для управления</h3>
                  <p className="text-xs font-semibold text-slate-400 mt-0.5">Вам доступны все бизнесы на платформе</p>
                </div>
                
                <div className="space-y-3">
                  {businesses.map((biz) => (
                    <button
                      key={biz.id}
                      onClick={() => setSelectedAdminBusinessId(biz.id)}
                      className="w-full text-left flex items-center gap-3.5 rounded-2xl bg-white p-4 ring-1 ring-slate-100 shadow-sm hover:shadow transition"
                    >
                      <div 
                        className="grid h-12 w-12 place-items-center rounded-xl text-white text-lg font-bold animate-pulse-subtle"
                        style={{ backgroundColor: biz.primaryColor || "#4F46E5" }}
                      >
                        {biz.name ? biz.name[0] : "🏢"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="text-sm font-extrabold text-slate-900 truncate">{biz.name}</h5>
                        <p className="text-[11px] font-semibold text-slate-400 mt-0.5 truncate">
                          Адрес: /{biz.slug}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                        Выбрать →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          if (session.role === "BUSINESS_OWNER") {
            return (
              <div className="p-8 text-center my-auto min-h-[50vh] flex flex-col justify-center items-center">
                <span className="text-5xl mb-4">💼</span>
                <h3 className="text-lg font-black text-slate-800">Ваш аккаунт продавца ещё не привязан к бизнесу</h3>
                <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
                  Ваш профиль владельца бизнеса не связан ни с одним активным заведением. Пожалуйста, обратитесь к администратору для привязки.
                </p>
              </div>
            );
          }

          if (session.role === "MANAGER") {
            return (
              <div className="p-8 text-center my-auto min-h-[50vh] flex flex-col justify-center items-center">
                <span className="text-5xl mb-4">💼</span>
                <h3 className="text-lg font-black text-slate-800">Менеджер ещё не привязан к точке продаж</h3>
                <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
                  Ваш профиль менеджера не привязан к конкретному филиалу или точке продаж.
                </p>
              </div>
            );
          }

          return (
            <div className="p-8 text-center my-auto min-h-[50vh] flex flex-col justify-center items-center">
              <span className="text-5xl mb-4">💼</span>
              <h3 className="text-lg font-black text-slate-800">Доступ ограничен</h3>
              <p className="text-xs text-slate-400 mt-2">У вас нет прав для просмотра этого раздела.</p>
            </div>
          );
        })()}

        {/* Case C: Manager Workflow Panel */}
        {activeWorkspaceMode === "MANAGER" && (() => {
          if (session.businessId) {
            return <ManagerWorkPanel session={session} businessId={session.businessId} />;
          }
          return (
            <div className="p-8 text-center my-auto min-h-[50vh] flex flex-col justify-center items-center">
              <span className="text-5xl mb-4">💼</span>
              <h3 className="text-lg font-black text-slate-800">Менеджер ещё не привязан к точке продаж</h3>
              <p className="text-xs text-slate-400 mt-2">Обратитесь к администратору для привязки к филиалу.</p>
            </div>
          );
        })()}

        {/* Case D: SaaS Super Admin Dashboard */}
        {activeWorkspaceMode === "SUPER_ADMIN" && (
          <SuperAdminHome 
            session={session} 
            onManageBusiness={(businessId) => {
              setSelectedAdminBusinessId(businessId);
              setActiveWorkspaceMode("SELLER");
            }}
          />
        )}
      </div>

      {/* 3. LOWER NAVIGATION TAB BAR (Only renders in customer/client view mode) */}
      {activeWorkspaceMode === "CUSTOMER" && (
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-3xl border-t border-slate-200 bg-white/95 px-4 pt-2 pb-3 pb-safe backdrop-blur shadow-lg">
          <div className="grid grid-cols-4 text-center text-[10px] font-black text-slate-400">
            <button
              onClick={() => setActiveClientTab("HOME")}
              className={`flex flex-col items-center py-1 rounded-xl transition ${
                activeClientTab === "HOME" ? "text-indigo-600 font-black" : "hover:text-slate-600"
              }`}
            >
              <Home size={16} className="mb-0.5" />
              Главная
            </button>
            
            <button
              onClick={() => setActiveClientTab("FAVORITES")}
              className={`flex flex-col items-center py-1 rounded-xl transition ${
                activeClientTab === "FAVORITES" ? "text-indigo-600 font-black" : "hover:text-slate-600"
              }`}
            >
              <Heart size={16} className="mb-0.5" />
              Избранное
            </button>
            
            <button
              onClick={() => setActiveClientTab("ORDERS")}
              className={`flex flex-col items-center py-1 rounded-xl transition ${
                activeClientTab === "ORDERS" ? "text-indigo-600 font-black" : "hover:text-slate-600"
              }`}
            >
              <ClipboardList size={16} className="mb-0.5" />
              Заказы
            </button>
            
            <button
              onClick={() => setActiveClientTab("PROFILE")}
              className={`flex flex-col items-center py-1 rounded-xl transition ${
                activeClientTab === "PROFILE" ? "text-indigo-600 font-black" : "hover:text-slate-600"
              }`}
            >
              <UserRound size={16} className="mb-0.5" />
              Профиль
            </button>
          </div>
        </nav>
      )}
    </main>
  );
}

const AlertCircle = ({ size, className }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className} style={{ width: size, height: size }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
  </svg>
);
