# Feature Spec

SmartBiz AI / Vitrina AI - Telegram Mini App SaaS для локального бизнеса. Цель MVP: дать клиенту удобный каталог и checkout в Telegram, а продавцу - простую панель для обработки заказов и управления витриной.

## Роли

Клиент:
- Открывает Mini App из Telegram bot или по ссылке `/app`.
- Смотрит каталог бизнесов.
- Открывает карточку бизнеса.
- Смотрит товары и услуги.
- Добавляет товары в корзину.
- Оформляет заказ.
- Подтверждает телефон через Telegram contact.
- Видит избранное и историю заказов/записей.

Продавец:
- Открывает seller panel внутри Mini App.
- Видит заказы и записи своего бизнеса.
- Меняет статусы заказов.
- Управляет товарами, услугами, категориями, медиа и базовыми настройками.
- Использует AI-помощник для описаний и маркетинговых текстов.

Менеджер:
- Работает с операционными задачами бизнеса.
- Видит доступные очереди, заказы и записи в рамках назначенного бизнеса.
- Не должен получать доступ к Super Admin функциям и глобальным настройкам платформы.

Super Admin:
- Управляет списком бизнесов.
- Создает и подключает продавцов.
- Видит SaaS-статистику.
- Управляет демо/production бизнесами.
- Проверяет onboarding, тарифы, шаблоны и AI-настройки.

## Основные сценарии

Client catalog:
- Пользователь открывает `/app`.
- Видит активные бизнесы.
- Использует поиск и категории.
- Переходит в `/app/[businessSlug]`.

Business shopping:
- Клиент открывает бизнес.
- Выбирает товары.
- Добавляет в корзину.
- Переходит в checkout.
- Подтверждает телефон, если требуется.
- Создает заказ.
- Продавец получает заказ в панели и Telegram notification, если настроен chat id.

Service booking:
- Клиент выбирает услугу.
- Выбирает дату, время и мастера, если доступно.
- Создает запись.
- Продавец видит запись в seller panel.

Seller operations:
- Продавец открывает Mini App в режиме seller.
- Видит dashboard, заказы, записи, товары, клиентов, медиа и настройки.
- Меняет статусы заказов и записей.
- Добавляет товары или услуги.

Super Admin operations:
- Super Admin открывает `/app?mode=super` или админские страницы.
- Создает бизнес.
- Привязывает owner/telegram id.
- Проверяет тариф и статус бизнеса.

AI content:
- Продавец открывает AI раздел.
- Выбирает тип генерации.
- Получает описание товара, маркетинговый текст или черновик поста.
- Используются лимиты и provider routing.

## Что уже работает

- Production Mini App entry: `/app`.
- Business route: `/app/[businessSlug]`.
- Catalog, business cards, products/services.
- Cart and order creation.
- Phone verification through Telegram contact.
- Favorites and customer order history.
- Seller panel with orders, bookings, catalog, media, settings and customers.
- Super Admin panel basics.
- Prisma schema for multi-business SaaS.
- Supabase Postgres and Supabase Storage integration.
- Telegram webhook and Mini App URL via Vercel production domain.
- AI provider abstraction: mock, OpenRouter, Polza AI.
- Manual SQL patch workflow for production schema drift.

## Запланировано

- Harden onboarding for real sellers.
- Add automated smoke tests for `/app`, checkout, seller panel and webhook.
- Improve payment flow and receipts.
- Add richer Telegram notifications for clients and sellers.
- Add commercial tariff gates.
- Add AI generator for product cards, images and Telegram posts.
- Add monitoring and error reporting.
- Add owner self-service setup wizard.
