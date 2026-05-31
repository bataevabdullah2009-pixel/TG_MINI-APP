import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  // Fetch some active businesses just to show the count or directory
  let businessesCount = 0;
  try {
    businessesCount = await prisma.business.count({ where: { isActive: true } });
  } catch (err) {
    console.error("DB error, using count fallback", err);
    businessesCount = 6;
  }

  const templates = [
    {
      key: "cafe",
      name: "☕ Кафе и Фастфуд",
      desc: "Интерактивное меню с категориями, корзиной, оформлением доставки и самовывоза. Идеально для ресторанов, шаурмы и бургерных.",
      slug: "demo-cafe",
      color: "from-amber-500 to-orange-600",
      icon: "🍔",
      badge: "Популярно",
    },
    {
      key: "barber",
      name: "✂️ Барбершоп и Салон",
      desc: "Удобная запись по времени к конкретному мастеру, интерактивный календарь, напоминания о сеансе и отзывы клиентов.",
      slug: "demo-barber",
      color: "from-slate-700 to-slate-900",
      icon: "💈",
      badge: "Новинка",
    },
    {
      key: "shop",
      name: "🛍️ Локальный Магазин",
      desc: "Полноценный каталог одежды, аксессуаров или техники. Корзина, отслеживание наличия на складе и быстрый расчет заказа.",
      slug: "demo-shop",
      color: "from-pink-500 to-rose-600",
      icon: "👗",
      badge: "Бестселлер",
    },
    {
      key: "grocery",
      name: "🍏 Продукты и Вес",
      desc: "Заказ свежих овощей, фруктов и напитков с подсчетом стоимости за вес или упаковку. Быстрая курьерская сборка.",
      slug: "demo-grocery",
      color: "from-emerald-500 to-green-600",
      icon: "🥝",
      badge: "Выгодно",
    },
    {
      key: "hozmag",
      name: "🔧 Хозмаг и Строительный",
      desc: "Каталог строительных инструментов и электротоваров. Полноценный текстовый поиск и кнопка 'Спросить продавца' через ИИ.",
      slug: "demo-hozmag",
      color: "from-blue-600 to-indigo-700",
      icon: "🔨",
      badge: "Для Бизнеса",
    },
    {
      key: "carwash",
      name: "🚗 Автомойка и Сервис",
      desc: "Запись на конкретные боксы и услуги (мойка, химчистка, шиномонтаж) с автоматическим расчетом занятости времени.",
      slug: "demo-carwash",
      color: "from-cyan-500 to-blue-600",
      icon: "🧼",
      badge: "Автозапись",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Light glow effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[120px] pointer-events-none" />

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20 pointer-events-none" />

      {/* Header / Navbar */}
      <header className="relative z-10 max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-slate-900/60">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="" className="w-10 h-10 rounded-xl shadow-md shadow-indigo-500/20" />
          <span className="text-xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            SmartBiz AI
          </span>
        </div>
        
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
          <Link href="/templates" className="hover:text-white transition">Шаблоны</Link>
          <Link href="/pricing" className="hover:text-white transition">Тарифы</Link>
          <Link href="/demo" className="hover:text-white transition">Демо-версии</Link>
        </nav>

        <div className="flex items-center gap-4">
          <Link 
            href="/admin/login" 
            className="text-sm font-bold text-slate-300 hover:text-white px-4 py-2 rounded-lg border border-slate-800 bg-slate-950/80 hover:bg-slate-900 transition"
          >
            Войти в админку
          </Link>
          <Link 
            href="/demo" 
            className="hidden sm:inline-flex text-sm font-bold bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white px-4 py-2 rounded-lg shadow-lg shadow-indigo-500/10 active:scale-[0.98] transition-all"
          >
            Смотреть демо
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-indigo-400 text-xs font-semibold tracking-wider uppercase mb-6">
          <span>✨</span> Революция в мобильных продажах
        </div>
        
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-none mb-6">
          Ваш Бизнес в <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Telegram Mini App
          </span>
        </h1>
        
        <p className="text-slate-400 text-lg sm:text-xl max-w-3xl mx-auto mb-10 leading-relaxed">
          Превратите подписчиков в клиентов. Запустите автоматизированную витрину, форму бронирования, программу лояльности и умного AI-ассистента всего за 5 минут. Без дизайнеров и кодеров.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link 
            href="/demo" 
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 text-white font-extrabold rounded-xl shadow-2xl shadow-indigo-500/20 active:scale-[0.97] transition-all flex items-center justify-center gap-2"
          >
            🚀 Попробовать демо-шаблоны
          </Link>
          <Link 
            href="/admin/login" 
            className="w-full sm:w-auto px-8 py-4 bg-slate-900/80 hover:bg-slate-900 text-slate-200 hover:text-white font-bold rounded-xl border border-slate-800 transition flex items-center justify-center gap-2"
          >
            🔒 Панель управления
          </Link>
        </div>

        {/* Floating statistics banner */}
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mt-16 p-4 rounded-2xl bg-slate-900/40 border border-slate-900 backdrop-blur-md">
          <div>
            <p className="text-2xl sm:text-3xl font-black text-indigo-400">6+</p>
            <p className="text-xs text-slate-500 font-bold uppercase mt-1">Шаблонов</p>
          </div>
          <div className="border-x border-slate-900">
            <p className="text-2xl sm:text-3xl font-black text-cyan-400">100%</p>
            <p className="text-xs text-slate-500 font-bold uppercase mt-1">No-code</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-purple-400">{businessesCount * 12 + 14}</p>
            <p className="text-xs text-slate-500 font-bold uppercase mt-1">Клиентов</p>
          </div>
        </div>
      </section>

      {/* Templates Section */}
      <section id="templates" className="relative z-10 max-w-7xl mx-auto px-6 py-20 border-t border-slate-900">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Готовые отраслевые шаблоны
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
            Выберите готовый скелет для вашей ниши. Все шаблоны адаптированы под мобильные интерфейсы Telegram, поддерживают кастомный брендинг и AI-инструменты.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((tpl) => (
            <div 
              key={tpl.key}
              className="bg-slate-900/40 border border-slate-900 hover:border-slate-800 rounded-3xl p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-slate-950 flex items-center justify-center text-2xl">
                    {tpl.icon}
                  </div>
                  <span className="bg-slate-950 text-indigo-400 text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full border border-slate-900">
                    {tpl.badge}
                  </span>
                </div>

                <h3 className="text-xl font-bold mb-3 text-white group-hover:text-indigo-400 transition">
                  {tpl.name}
                </h3>
                
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  {tpl.desc}
                </p>
              </div>

              <Link 
                href={`/app/${tpl.slug}`}
                className="w-full py-3 bg-slate-950 group-hover:bg-indigo-600 group-hover:text-white text-slate-300 font-bold text-xs rounded-xl border border-slate-800 hover:border-transparent transition-all flex items-center justify-center gap-1.5"
              >
                📱 Тестировать в WebView
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Platform Features Section */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-16 border-t border-slate-900">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Система управления</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2 mb-6">
              Мощный Личный Кабинет для каждой точки продаж
            </h2>
            <div className="space-y-4 text-slate-400 text-sm sm:text-base">
              <div className="flex gap-3">
                <span className="text-indigo-400 font-bold">✓</span>
                <p><span className="text-white font-semibold">Управление витриной:</span> быстрое добавление товаров, настройка цен, остатков и ярлыков скидок.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-indigo-400 font-bold">✓</span>
                <p><span className="text-white font-semibold">Обработка заказов и бронирования:</span> списки заявок с мгновенным изменением статусов и push-уведомлениями в Telegram.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-indigo-400 font-bold">✓</span>
                <p><span className="text-white font-semibold">ИИ-Помощник продавца:</span> генератор рекламных постов, подарочных акций, описаний товаров и шаблонов ответов на отзывы клиентов.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-indigo-400 font-bold">✓</span>
                <p><span className="text-white font-semibold">Дизайн и цвета:</span> меняйте логотипы, адреса, расписание работы и основные цвета Mini App в один клик.</p>
              </div>
            </div>
            
            <div className="mt-8">
              <Link 
                href="/admin/login" 
                className="inline-flex px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl border border-slate-800 transition"
              >
                🔑 Попробовать демо-админку
              </Link>
            </div>
          </div>
          
          <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
            <div className="flex justify-between items-center pb-4 border-b border-slate-900">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-xs text-slate-500 font-mono">dashboard_preview.tsx</span>
            </div>
            
            {/* Mock Code Block or mock graphics */}
            <div className="mt-4 space-y-4 font-mono text-xs text-slate-400">
              <div className="text-cyan-400">// Инициализация нового заведения из шаблона</div>
              <div>
                <span className="text-purple-400">const</span> business = <span className="text-indigo-400">await</span> createBusiness(&#123;
                <div className="pl-4">slug: <span className="text-green-400">"sultan-barber"</span>,</div>
                <div className="pl-4">type: <span className="text-green-400">"BARBERSHOP"</span>,</div>
                <div className="pl-4">theme: <span className="text-green-400">"#1F1F1F"</span>,</div>
                <div className="pl-4">aiEnabled: <span className="text-green-400">true</span></div>
                &#125;);
              </div>
              <div className="text-emerald-400">// Готово! Вебхуки зарегистрированы автоматически</div>
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-900">
                <p className="text-white font-bold mb-1">📢 Telegram-Бот:</p>
                <p className="text-slate-400">🤖 سلطان Barbershop успешно создан! Ссылка: <span className="text-blue-400 underline">t.me/Automaticbit_bot?start=sultan-barber</span></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 max-w-6xl mx-auto px-6 py-20 border-t border-slate-900">
        <div className="text-center mb-16">
          <span className="text-xs font-black uppercase tracking-widest text-purple-400">Тарифные планы</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2 mb-4">
            Простые и прозрачные условия
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto text-sm">
            Выберите план, подходящий для вашего масштаба бизнеса. Изменить тариф можно в любое время.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Plan 1 */}
          <div className="bg-slate-900/40 border border-slate-900 hover:border-slate-800 rounded-3xl p-6 transition flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold mb-1">🚀 START</h3>
              <p className="text-xs text-slate-500 mb-4">Для старта продаж</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-black text-white">$0</span>
                <span className="text-xs text-slate-500">/ навсегда</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-400 mb-6">
                <li>• 1 магазин / Mini App</li>
                <li>• До 50 активных товаров</li>
                <li>• Базовая витрина с корзиной</li>
                <li>• Лимит заказов: 200 / мес</li>
                <li>• AI-помощник: выключен</li>
              </ul>
            </div>
            <Link href="/admin/login" className="w-full py-3 bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs rounded-xl border border-slate-800 transition text-center block">
              Зарегистрироваться
            </Link>
          </div>

          {/* Plan 2 */}
          <div className="bg-slate-900/60 border border-indigo-500/40 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between shadow-2xl">
            <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[9px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider">
              Рекомендуем
            </div>
            <div>
              <h3 className="text-lg font-bold mb-1 text-indigo-400">🔥 PRO</h3>
              <p className="text-xs text-slate-500 mb-4">Для быстрого роста</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-black text-white">$99</span>
                <span className="text-xs text-slate-500">/ мес</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-300 mb-6">
                <li>• Все функции тарифа START</li>
                <li>• До 300 активных товаров</li>
                <li>• Формы бронирования записей</li>
                <li>• До 5 мастеров / боксов</li>
                <li>• Интеграция с Telegram Bot</li>
                <li>• AI-помощник: 30 запросов / день</li>
              </ul>
            </div>
            <Link href="/admin/login" className="w-full py-3 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:brightness-110 text-white font-bold text-xs rounded-xl transition text-center block shadow-md shadow-indigo-500/20">
              Купить PRO
            </Link>
          </div>

          {/* Plan 3 */}
          <div className="bg-slate-900/40 border border-slate-900 hover:border-slate-800 rounded-3xl p-6 transition flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold mb-1">👑 BUSINESS</h3>
              <p className="text-xs text-slate-500 mb-4">Для сетей и масштаба</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-black text-white">$299</span>
                <span className="text-xs text-slate-500">/ мес</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-400 mb-6">
                <li>• Все функции тарифа PRO</li>
                <li>• Неограниченное число товаров</li>
                <li>• Интеграция API и внешних CRM</li>
                <li>• До 20 сотрудников</li>
                <li>• Приоритетная поддержка</li>
                <li>• Безлимитный ИИ для бизнеса</li>
              </ul>
            </div>
            <Link href="/admin/login" className="w-full py-3 bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs rounded-xl border border-slate-800 transition text-center block">
              Купить BUSINESS
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl mx-auto px-6 py-12 border-t border-slate-900 text-center text-slate-500 text-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-indigo-400 font-black">🤖</span>
          <span>© 2026 SmartBiz AI. Все права защищены. Разработано LocalAI Systems.</span>
        </div>
        <div className="flex gap-6">
          <Link href="/templates" className="hover:text-slate-300">Шаблоны</Link>
          <Link href="/pricing" className="hover:text-slate-300">Тарифы</Link>
          <Link href="/demo" className="hover:text-slate-300">Демо-версии</Link>
        </div>
      </footer>
    </div>
  );
}
