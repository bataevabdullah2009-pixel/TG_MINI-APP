import Link from "next/link";

export default function PricingPage() {
  const plans = [
    {
      id: "plan-commercial",
      name: "Commercial",
      price: "50 000 ₽",
      period: "разово",
      setupFee: "Бессрочный доступ без ежемесячной оплаты",
      desc: "Коммерческий тариф для локального бизнеса с готовой Telegram-витриной, заказами, доставкой, уведомлениями и ИИ.",
      features: [
        "Подключение и настройка бизнеса",
        "Telegram Mini App с каталогом товаров и услуг",
        "Панель продавца и управление заказами",
        "Самовывоз, зоны доставки и работа с курьерами",
        "Оплата переводом и проверка чеков",
        "ИИ-помощник по данным текущего бизнеса",
        "Telegram-уведомления продавцу и клиентам",
        "Поддержка и обновления платформы",
      ],
      missing: [],
      actionText: "Подключить тариф",
      color: "border-indigo-500/50 bg-slate-900/50 shadow-2xl relative"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans relative overflow-hidden pb-16 selection:bg-indigo-500 selection:text-white">
      {/* Glow */}
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
        
        <span className="text-slate-500 text-xs font-bold font-mono">Vitrina AI / Тарифы</span>
      </header>

      {/* Heading */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pt-12 pb-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
          Коммерческий тариф Vitrina AI
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
          Разовая оплата 50 000 ₽ включает подключение бизнеса и бессрочный доступ к платформе, заказам, ИИ и уведомлениям.
        </p>
      </section>

      {/* Plans Section */}
      <section className="relative z-10 mx-auto max-w-xl px-6">
        {plans.map((p) => (
          <div 
            key={p.id}
            className={`border rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:border-slate-700/80 ${p.color}`}
          >
            {p.id === "plan-commercial" && (
              <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-lg">
                Рекомендуемый
              </div>
            )}
            
            <div>
              <h3 className="text-xl font-bold text-white mb-2">{p.name}</h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-6 h-12">{p.desc}</p>
              
              <div className="flex items-baseline gap-1.5 mb-8 pb-6 border-b border-slate-900">
                <span className="text-4xl font-black text-white">{p.price}</span>
                <span className="text-slate-500 text-xs">/ {p.period}</span>
              </div>
              <p className="-mt-4 mb-8 rounded-xl bg-indigo-500/10 px-3 py-2 text-center text-xs font-bold text-indigo-200">
                {p.setupFee}
              </p>

              {/* Feature items */}
              <div className="space-y-3 mb-8">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">В тариф включено:</p>
                {p.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                    <span className="text-indigo-400 font-bold shrink-0">✓</span>
                    <span>{f}</span>
                  </div>
                ))}
                
                {p.missing.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest pt-4">Недоступно в тарифе:</p>
                    {p.missing.map((m, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs text-slate-500">
                        <span className="text-slate-700 shrink-0">✕</span>
                        <span className="line-through">{m}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            <Link
              href="/admin/login"
              className={`w-full py-4 text-center font-extrabold text-xs rounded-xl transition-all shadow-md ${
                p.id === "plan-commercial"
                  ? "bg-gradient-to-r from-indigo-500 to-cyan-500 hover:brightness-110 text-white shadow-indigo-500/20" 
                  : "bg-slate-950 hover:bg-slate-900 text-slate-200 border border-slate-800 hover:border-slate-700"
              }`}
            >
              {p.actionText}
            </Link>
          </div>
        ))}
      </section>

      {/* FAQ Grid */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 mt-20">
        <h2 className="text-2xl font-black text-center mb-10">Часто задаваемые вопросы (FAQ)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5">
            <h4 className="font-bold text-sm text-white mb-2">Как клиент открывает мой Mini App?</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Вы привязываете свой юзернейм бота. Когда клиент переходит по вашей ссылке в Telegram или отправляет команду <span className="font-mono text-indigo-400">/start</span> в вашем боте, перед ним открывается витрина Mini App со всем ассортиментом.
            </p>
          </div>
          <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5">
            <h4 className="font-bold text-sm text-white mb-2">Нужна ли помощь разработчика?</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Нет. Наша SaaS-платформа построена по принципу 100% no-code. Вы просто выбираете нужный шаблон (кафе, барбершоп, хозмаг и т.д.), вбиваете товары в админке, и система автоматически собирает ваше готовое приложение.
            </p>
          </div>
          <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5">
            <h4 className="font-bold text-sm text-white mb-2">Как работает AI-помощник продавца?</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              В админ-панели заведения во вкладке 'ИИ' вы можете генерировать яркие рекламные посты для своего Telegram-канала, составлять специальные акции, генерировать продающие описания новых товаров или быстро формулировать тактичные ответы на отзывы.
            </p>
          </div>
          <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5">
            <h4 className="font-bold text-sm text-white mb-2">Где я могу увидеть заказы?</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Все заказы мгновенно появляются в панели продавца во вкладке 'Заказы'. Дополнительно наш бот присылает вам уведомление с данными покупателя прямо в ваш личный Telegram-чат (Telegram Admin Chat ID).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
