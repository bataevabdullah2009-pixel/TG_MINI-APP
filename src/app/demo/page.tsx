import Link from "next/link";

export default function DemoPage() {
  const demos = [
    {
      slug: "demo-cafe",
      name: "☕ Кафе & Быстрый перекус",
      type: "CAFE",
      desc: "Витрина с разделами (бургеры, шаурма, напитки), корзина с накоплением суммы, выбор доставки/самовывоза, поля комментариев. Оптимально для фастфуда, кондитерских и пиццерий.",
      color: "from-orange-500 to-amber-600",
      accent: "bg-orange-500",
      badge: "Популярный шаблон",
      icon: "🍔",
      features: ["Каталог с фильтром по категориям", "Умная корзина снизу экрана", "Форма заказа (имя, телефон, адрес)", "Telegram-уведомление продавцу"]
    },
    {
      slug: "demo-barber",
      name: "✂️ Барбершоп & Салон красоты",
      type: "BARBERSHOP",
      desc: "Интерактивная запись клиентов. Выбор мастера (барбера), удобный календарь на ближайшие дни, сетка свободных тайм-слотов, подтверждение записи. Подходит для парикмахерских, спа и массажа.",
      color: "from-slate-700 to-slate-900",
      accent: "bg-slate-700",
      badge: "Запись по времени",
      icon: "💈",
      features: ["Список услуг с ценами и длительностью", "Выбор специалиста (мастера)", "Интерактивная сетка времени", "Синхронизация с календарем записи"]
    },
    {
      slug: "demo-shop",
      name: "🛍️ Локальный Ритейл & Одежда",
      type: "SHOP",
      desc: "Полноценный интернет-магазин одежды, обуви, косметики или гаджетов. Карточки товаров со скидками (старая/новая цена), подсчет остатков, брендированные цвета.",
      color: "from-pink-500 to-rose-600",
      accent: "bg-pink-500",
      badge: "Каталог товаров",
      icon: "👗",
      features: ["Учет остатков на складе (stock limit)", "Ярлыки скидок и ценников", "Полное описание с фотогалереей", "Корзина и мгновенное оформление"]
    },
    {
      slug: "demo-grocery",
      name: "🍏 Продуктовый магазин & Овощи",
      type: "GROCERY",
      desc: "Витрина продуктов питания, овощей, фруктов или напитков. Удобный выбор веса/количества товара, категории быстрой навигации и экспресс-доставка.",
      color: "from-emerald-500 to-green-600",
      accent: "bg-emerald-500",
      badge: "Весовой товар",
      icon: "🍎",
      features: ["Поддержка веса в граммах/килограммах", "Быстрый инкрементатор количества", "Разделы акций дня и бестселлеров", "Экологичный сочный интерфейс"]
    },
    {
      slug: "demo-hozmag",
      name: "🔧 Хозмаг & Строительный ритейл",
      type: "HARDWARE_STORE",
      desc: "Удобный поиск инструментов, крепежей или бытовых товаров. Включает форму быстрой консультации и кнопку 'Спросить продавца' (ИИ отвечает по каталогу товаров).",
      color: "from-blue-600 to-indigo-700",
      accent: "bg-blue-600",
      badge: "Крупный каталог",
      icon: "🔨",
      features: ["Быстрый текстовый поиск по каталогу", "Заявки на крупные/оптовые партии", "Кнопка 'Связаться с ИИ-консультантом'", "Контакты, карта проезда и самовывоз"]
    },
    {
      slug: "demo-carwash",
      name: "🚗 Автомойка & Детейлинг",
      type: "CARWASH",
      desc: "Интерфейс резервирования автомоечных постов. Выбор комплекса услуг (кузов, салон, химчистка, полировка), выбор даты и времени, отправка госномера машины.",
      color: "from-cyan-500 to-blue-600",
      accent: "bg-cyan-500",
      badge: "Авто-сервисы",
      icon: "🚿",
      features: ["Выбор категории авто (седан, джип)", "Детализация этапов выполнения мойки", "Учет свободных боксов и персонала", "Мгновенное SMS/TG-подтверждение"]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans relative overflow-hidden pb-16 selection:bg-indigo-500 selection:text-white">
      {/* Light glow effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[120px] pointer-events-none" />

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20 pointer-events-none" />

      {/* Navigation */}
      <header className="relative z-10 max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-slate-900/60">
        <Link href="/" className="flex items-center gap-3 group">
          <span className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-lg font-bold group-hover:border-indigo-500 transition">
            ←
          </span>
          <span className="text-sm font-bold text-slate-300 group-hover:text-white transition">Вернуться на главную</span>
        </Link>

        <span className="bg-slate-900 border border-slate-800 text-indigo-400 text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full">
          SmartBiz AI Demo
        </span>
      </header>

      {/* Hero Header */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pt-12 pb-10 text-center">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
          Интерактивный запуск демо-шаблонов
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
          Нажмите на любой шаблон ниже, чтобы мгновенно протестировать его интерфейс. Мы подготовили тестовый каталог товаров и формы бронирования для полноценной оценки.
        </p>
      </section>

      {/* Demos Catalog */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {demos.map((demo) => (
          <div 
            key={demo.slug}
            className="bg-slate-900/30 border border-slate-900 hover:border-slate-800/80 rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between group shadow-xl"
          >
            <div>
              {/* Top Banner */}
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-950 flex items-center justify-center text-2xl border border-slate-900">
                  {demo.icon}
                </div>
                <span className={`${demo.accent} text-white text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-lg`}>
                  {demo.badge}
                </span>
              </div>

              {/* Title & Description */}
              <h3 className="text-xl font-bold mb-3 text-white group-hover:text-indigo-400 transition-colors">
                {demo.name}
              </h3>
              
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
                {demo.desc}
              </p>

              {/* Features bullets */}
              <div className="mb-8 bg-slate-950/60 rounded-2xl p-4 border border-slate-900/60">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">Основные модули:</p>
                <div className="grid grid-cols-1 gap-2">
                  {demo.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                      <span className="text-indigo-500">•</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Launch CTA Button */}
            <Link 
              href={`/app/${demo.slug}`}
              className={`w-full py-4 bg-gradient-to-r ${demo.color} text-white font-extrabold text-sm rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2`}
            >
              <span>📱 Запустить Mini App</span>
              <span className="text-xs font-normal opacity-80">(в браузере / WebView)</span>
            </Link>
          </div>
        ))}
      </section>

      {/* Quick Admin Demo Promo banner */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 mt-12">
        <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-cyan-950/40 border border-slate-800/80 rounded-3xl p-8 flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
          
          <div className="text-center md:text-left">
            <span className="text-xs font-black uppercase text-indigo-400 tracking-widest block mb-2">Хотите управлять товарами и заказами?</span>
            <h3 className="text-xl sm:text-2xl font-extrabold text-white">Проверьте личный кабинет продавца</h3>
            <p className="text-slate-400 text-xs sm:text-sm mt-2 max-w-xl">
              Зайдите в админ-панель под учетной записью <span className="text-indigo-300 font-semibold font-mono">admin@example.com / admin123</span>, добавьте товар или поменяйте цены — и изменения мгновенно появятся в Mini App!
            </p>
          </div>

          <Link 
            href="/admin/login"
            className="px-6 py-4 bg-white hover:bg-slate-100 text-slate-950 font-black text-sm rounded-xl transition shadow-xl active:scale-[0.97] shrink-0"
          >
            🔑 Войти в админку продавца
          </Link>
        </div>
      </section>
    </div>
  );
}
