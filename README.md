# TelebiznezHub - Telegram Mini App Platform

White-label SaaS платформа для создания Telegram Mini App бизнесом. Один код - много бизнесов.

## 🚀 Возможности

- **Multi-business архитектура** - один код для всех клиентов
- **Telegram Mini App** - полностью встроенная в Telegram
- **Admin Panel** - управление бизнесом
- **Автоматические уведомления** - через Telegram Bot
- **Готовые шаблоны**: Кафе, Барбершоп, Автомойка, Магазин
- **White-label настройки** - логотип, цвета, брендирование
- **Система заказов** - с доставкой/самовывозом
- **Онлайн-записи** - с календарем и расписанием
- **Управление товарами** - категории, популярные, остатки
- **Клиентская база** - с историей покупок

## 🛠️ Технологический стек

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL + Prisma ORM
- **State**: Zustand
- **Validation**: Zod
- **Telegram**: Telegram WebApp SDK, Bot API
- **UI**: shadcn/ui components

## 📋 Требования

- Node.js 18+
- PostgreSQL 13+
- npm или pnpm

## ⚙️ Установка

### 1. Клонирование репозитория

```bash
git clone <repository>
cd telegram-miniapp-platform
```

### 2. Установка зависимостей

```bash
npm install
# или
pnpm install
```

### 3. Настройка базы данных

Скопируйте `.env.example` в `.env`:

```bash
cp .env.example .env
```

Отредактируйте `.env` и установите `DATABASE_URL`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/telegram_miniapp_db"
```

### 4. Запуск PostgreSQL

**С Docker:**

```bash
docker run --name postgres \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=telegram_miniapp_db \
  -p 5432:5432 \
  -d postgres:15
```

**Или установите PostgreSQL локально**

### 5. Создание таблиц

Сначала сгенерируйте клиент:

```bash
npx prisma generate
```

Затем создайте таблицы:

```bash
npx prisma db push
```

Или с миграциями:

```bash
npm run db:migrate
```

### 6. Заполнение демо-данных

```bash
npm run db:seed
```

Это создаст:
- Super admin (admin@example.com / admin123)
- 4 demo бизнеса (кафе, барбершоп, автомойка, магазин)
- Категории и товары/услуги
- Демо сотрудников, клиентов, заказов и записей

### 7. Запуск dev сервера

```bash
npm run dev
```

Приложение будет доступно на: **http://localhost:3000**

## 🔐 Demo Accounts

### Admin Panel
- **Email**: admin@example.com
- **Password**: admin123
- **URL**: http://localhost:3000/admin

### Telegram Mini App
- Откройте ссылку бизнеса на главной странице
- Или используйте Telegram Bot (при наличии token)

## 📱 Mini App Routes

- `/` - Home страница с выбором бизнеса
- `/:slug` - Главная бизнеса
- `/:slug/catalog` - Каталог товаров/услуг
- `/:slug/item/:id` - Карточка товара/услуги
- `/:slug/cart` - Корзина
- `/:slug/checkout` - Оформление заказа
- `/:slug/booking` - Онлайн-запись
- `/:slug/orders/:id` - Статус заказа
- `/:slug/profile` - Профиль клиента
- `/:slug/contacts` - Контакты

## 🖥️ Admin Panel Routes

- `/admin/login` - Вход
- `/admin` - Dashboard
- `/admin/businesses` - Список бизнесов (Super Admin)
- `/admin/orders` - Управление заказами
- `/admin/bookings` - Управление записями
- `/admin/items` - Товары/услуги
- `/admin/categories` - Категории
- `/admin/customers` - Клиенты
- `/admin/staff` - Сотрудники
- `/admin/settings` - Настройки бизнеса
- `/admin/design` - Дизайн (цвета, логотип)

## 🤖 Telegram Bot

### Подготовка

1. Создайте бота через @BotFather в Telegram
2. Скопируйте bot token в `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   ```

### Запуск бота

```bash
npm run bot:dev
```

### Команды

- `/start` - Начало, открытие Mini App
- `/admin` - Ссылка на админ-панель (для владельца)
- `/orders` - Последние заказы
- `/bookings` - Ближайшие записи

## 🤖 ИИ-Модуль (OpenRouter & Polza AI)

### Проверка OpenRouter

В `.env` укажите:
```env
AI_PROVIDER="openrouter"
OPENROUTER_API_KEY="ваш_ключ"
OPENROUTER_MODEL="z-ai/glm-4.6"
```

Затем:
1. Запустите проект `npm run dev`
2. Откройте `/admin/ai`
3. Нажмите кнопку "Проверить AI" (тестирование бота) или перейдите в `/admin/content` для генерации.

### Проверка Polza AI

В `.env` укажите:
```env
AI_PROVIDER="polza"
POLZA_AI_API_KEY="ваш_ключ"
POLZA_TEXT_MODEL="z-ai/glm-4.7-flash"
```

Затем:
1. Запустите проект `npm run dev`
2. Откройте `/admin/ai`
3. Протестируйте ответы или сгенерируйте пост в `/admin/content`.

⚠️ **Контроль расходов:** Лимиты ИИ настроены в `.env` (например, `AI_FREE_PLAN_DAILY_LIMIT=10`). Все генерации записываются в базу данных (таблица `AIUsageLog`). Если лимит превышен, генератор выдаст ошибку, а бот переведет диалог на менеджера.

## 📊 Database Schema

Основные модели:

- **Business** - Бизнес (кафе, магазин и т.д.)
- **Category** - Категория товаров/услуг
- **Item** - Товар или услуга
- **Order** - Заказ
- **OrderItem** - Позиция в заказе
- **Booking** - Запись на услугу
- **Customer** - Клиент
- **Staff** - Сотрудник
- **User** - Пользователь (админ)
- **Payment** - Платеж
- **Notification** - Уведомление

## 🎨 White-Label Настройки

В Admin Panel > Settings можно менять:

- Название бизнеса
- Логотип и обложка
- Основной и дополнительный цвета
- Адрес и контакты
- Социальные сети (Telegram, WhatsApp, Instagram)
- Включенные модули (каталог, корзина, записи и т.д.)

## 🔐 Безопасность

- ✅ Telegram initData валидация
- ✅ JWT tokens
- ✅ Role-based access control (RBAC)
- ✅ Input validation с Zod
- ✅ Business data isolation (все запросы фильтруются по businessId)
- ✅ Environment variables для secrets

## 📝 Переменные окружения

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/db

# App
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Telegram
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_BOT_USERNAME=your_bot_username

# JWT
JWT_SECRET=your_super_secret_key_min_32_chars

# Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=password
```

## 🚀 Деплой

### Vercel (Frontend)

1. Подключите репозиторий к Vercel
2. Установите env переменные
3. Deploy

```bash
vercel deploy
```

### VPS (Full Stack)

```bash
# Установите Node.js и PostgreSQL
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql

# Клонируйте проект
git clone <repo>
cd project

# Установите зависимости
npm install

# Настройте .env
cp .env.example .env
# Отредактируйте .env

# Запустите миграции
npm run db:push
npm run db:seed

# Запустите PM2
npm install -g pm2
pm2 start npm --name "app" -- start
pm2 save
pm2 startup
```

## 📚 API Documentation

### Orders

```bash
# Создать заказ
POST /api/orders
{
  "businessId": "uuid",
  "customerName": "Иван",
  "customerPhone": "+7...",
  "items": [{ "itemId": "uuid", "quantity": 2 }],
  "deliveryType": "DELIVERY"
}

# Получить заказ
GET /api/orders/[id]

# Обновить статус
PATCH /api/orders/[id]
{ "status": "ACCEPTED" }
```

### Bookings

```bash
# Создать запись
POST /api/bookings
{
  "businessId": "uuid",
  "serviceId": "uuid",
  "customerName": "Иван",
  "customerPhone": "+7...",
  "startTime": "2024-01-15T10:00:00Z"
}

# Получить доступные слоты
GET /api/bookings?businessId=uuid&startDate=...&endDate=...
```

### Items

```bash
# Получить товары
GET /api/items/[slug]?categoryId=uuid&search=query
```

## 🐛 Troubleshooting

### "Database connection error"
- Проверьте, запущен ли PostgreSQL
- Проверьте DATABASE_URL в .env
- Запустите `npm run db:push`

### "Prisma not found"
```bash
npm run db:generate
```

### "Seed error"
```bash
npm run db:push
npm run db:seed
```

## 📖 Документация

- [Prisma](https://www.prisma.io/docs)
- [Next.js](https://nextjs.org/docs)
- [Telegram WebApp](https://core.telegram.org/bots/webapps)
- [Tailwind CSS](https://tailwindcss.com/docs)

## 🎯 Roadmap MVP

- [x] Database schema
- [x] Demo seed data
- [x] API endpoints
- [ ] Mini App UI pages
- [ ] Admin Panel UI
- [ ] Telegram Bot integration
- [ ] Notifications system
- [ ] Payment integration
- [ ] Testing

## 📄 Лицензия

Proprietary - для коммерческого использования

## 👥 Автор

TelebiznezHub Team

## 📞 Поддержка

Для вопросов и проблем создавайте issues в репозитории.

---

**Готово к запуску! 🚀**

Начните с установки, затем откройте http://localhost:3000 в браузере.
