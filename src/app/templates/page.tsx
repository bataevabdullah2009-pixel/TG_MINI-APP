import Link from "next/link";
import { buildBusinessUrl } from "@/lib/production-url";

export default function TemplatesPage() {
  const templates = [
    {
      key: "cafe",
      name: "☕ Шаблон 'Кафе & Фастфуд'",
      type: "CAFE",
      desc: "Идеален для кофеен, суши-баров, пиццерий, фастфуд-забегаловок и служб доставки готовой еды.",
      color: "from-amber-500/20 to-orange-600/20 border-orange-500/30",
      accent: "text-orange-400 border-orange-500/20",
      icon: "🍔",
      demoSlug: "demo-cafe",
      features: [
        "Разделы меню: Шаурма, Бургеры, Напитки, Десерты",
        "Модули 'Доставка' и 'Самовывоз' при оформлении",
        "Интерактивная корзина с моментальным расчетом сумм",
        "Ввод контактов (Имя, Телефон, Адрес, Комментарий к готовке)",
        "Оповещения о статусах: Готовится, Доставляется, Выполнен"
      ]
    },
    {
      key: "barber",
      name: "✂️ Шаблон 'Барбершоп & Салон'",
      type: "BARBERSHOP",
      desc: "Создан для парикмахерских, салонов красоты, барбершопов, тату-студий и соляриев.",
      color: "from-slate-700/20 to-slate-900/20 border-slate-500/30",
      accent: "text-slate-400 border-slate-500/20",
      icon: "💈",
      demoSlug: "demo-barber",
      features: [
        "Каталог оказываемых услуг с разбивкой по категориям",
        "Выбор конкретного специалиста/мастера в штате",
        "Интерактивный календарь бронирования на свободные дни",
        "Сетка тайм-слотов (занятое время автоматически скрывается)",
        "SMS/TG-оповещения клиенту и уведомления мастеру"
      ]
    },
    {
      key: "shop",
      name: "🛍️ Шаблон 'Локальный Магазин'",
      type: "SHOP",
      desc: "Отличный no-code старт для бутиков одежды, шоурумов, магазинов косметики, подарков и сувениров.",
      color: "from-pink-500/20 to-rose-600/20 border-pink-500/30",
      accent: "text-pink-400 border-pink-500/20",
      icon: "👗",
      demoSlug: "demo-shop",
      features: [
        "Полноценный каталог товаров с поиском и категориями",
        "Интерактивные ярлыки: ⭐ ТОП, 🔥 ХИТ, 🏷️ Скидки",
        "Учет остатков на складе для предотвращения перепродаж",
        "Корзина покупателя и форма заказа в 1 клик",
        "Интеграция с платежными системами"
      ]
    },
    {
      key: "grocery",
      name: "🍏 Шаблон 'Продуктовый магазин'",
      type: "GROCERY",
      desc: "Разработан для фермерских лавок, магазинов овощей/фруктов, мясных лавок и экспресс-доставки еды.",
      color: "from-emerald-500/20 to-green-600/20 border-green-500/30",
      accent: "text-green-400 border-green-500/20",
      icon: "🥝",
      demoSlug: "demo-grocery",
      features: [
        "Категории: Овощи, Фрукты, Молочные продукты, Мясо, Напитки",
        "Выбор веса/количества товара (граммы, килограммы, штуки)",
        "Быстрое увеличение/уменьшение товара в корзине в один клик",
        "Форма экспресс-доставки с указанием подъезда, этажа и квартиры",
        "Разделы 'Товары дня' со сниженными ценами"
      ]
    },
    {
      key: "hozmag",
      name: "🔧 Шаблон 'Хозтовары & Инструменты'",
      type: "HARDWARE_STORE",
      desc: "Для строительных магазинов, хозтоваров, автозапчастей и сантехники.",
      color: "from-blue-600/20 to-indigo-700/20 border-blue-500/30",
      accent: "text-blue-400 border-blue-500/20",
      icon: "🔨",
      demoSlug: "demo-hozmag",
      features: [
        "Каталог товаров: Инструменты, Электрика, Сантехника, Хозтовары",
        "Интегрированная форма быстрой заявки на консультацию по позициям",
        "Модуль 'Спросить продавца' (ИИ отвечает на вопросы о применимости)",
        "Подробная карта проезда, адрес магазина и график работы",
        "Выгрузка сметы заказа покупателя в PDF/Excel"
      ]
    },
    {
      key: "carwash",
      name: "🚗 Шаблон 'Автомойка & Сервис'",
      type: "CARWASH",
      desc: "Идеально подходит для автомойщиков, шиномонтажей, станций ТО и детейлинг-центров.",
      color: "from-cyan-500/20 to-blue-600/20 border-cyan-500/30",
      accent: "text-cyan-400 border-cyan-500/20",
      icon: "🧼",
      demoSlug: "demo-carwash",
      features: [
        "Сортировка услуг: Кузовная мойка, Химчистка, Детейлинг, Полировка",
        "Выбор типа кузова автомобиля для автоматического расчета цены",
        "Сетка бронирования времени по свободным боксам/постам",
        "Указание госномера авто для быстрого въезда через шлагбаум",
        "Статусы бронирования: Принят, На мойке, Готово, Отменено"
      ]
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

        <span className="bg-slate-900 border border-slate-800 text-cyan-400 text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full">
          6 Шаблонов в 1 Платформе
        </span>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pt-12 pb-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
          Потрясающие готовые интерфейсы
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
          Ознакомьтесь с подробными возможностями каждого шаблона. Вся логика, стили и анимации уже настроены нашими продуктовыми архитекторами.
        </p>
      </section>

      {/* Templates List */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 space-y-12">
        {templates.map((tpl) => (
          <div 
            key={tpl.key}
            className={`border rounded-3xl p-6 sm:p-8 bg-gradient-to-br transition-all duration-300 hover:shadow-2xl flex flex-col md:flex-row gap-8 items-start justify-between ${tpl.color}`}
          >
            {/* Template Card details */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{tpl.icon}</span>
                <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black tracking-widest uppercase ${tpl.accent}`}>
                  {tpl.type}
                </span>
              </div>
              
              <h3 className="text-2xl font-extrabold text-white mb-3">{tpl.name}</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">{tpl.desc}</p>
              
              {/* Feature Points */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Что умеет этот шаблон:</p>
                {tpl.features.map((f, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                    <span className="text-indigo-400 font-bold">✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Launch button column */}
            <div className="w-full md:w-64 bg-slate-950/80 rounded-2xl border border-slate-900/60 p-5 flex flex-col justify-between shrink-0">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-4 text-center">Готов к тесту</p>
              <div className="text-center mb-6">
                <span className="text-4xl block mb-2">📱</span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Запустите демонстрационный Mini App в режиме реального времени.
                </p>
              </div>
              <Link 
                href={buildBusinessUrl(tpl.demoSlug)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition text-center shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
              >
                Запустить демо
              </Link>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
