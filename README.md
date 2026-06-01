# SmartBiz AI / Vitrina AI

Telegram Mini App SaaS-платформа для локального бизнеса: каталог заведений, карточки бизнеса, товары и услуги, корзина, заказы, записи, панель продавца, Super Admin и AI-помощник для контента.

Рабочее название в коде пока не меняется. В документации допустимые будущие варианты бренда: Vitrina AI, LocalBiz AI, BizMini AI, SmartVitrina.

## Что уже есть

- Клиентский каталог бизнесов: `/app`.
- Страница бизнеса: `/app/[businessSlug]`.
- Каталог товаров и услуг, корзина, checkout и создание заказов.
- Подтверждение телефона через Telegram contact.
- Избранное и история заказов клиента.
- Панель продавца внутри Mini App.
- Управление заказами, записями, товарами, медиа и настройками бизнеса.
- Super Admin панель для SaaS-управления бизнесами.
- Telegram bot открывает Mini App через production Vercel URL.
- Supabase Postgres + Prisma ORM.
- Supabase Storage для изображений.
- AI-помощник через mock, OpenRouter или Polza AI.

## Stack

- Next.js App Router, React, TypeScript.
- Tailwind CSS, lucide-react.
- Next.js API routes.
- Prisma ORM.
- Supabase Postgres и Supabase Storage.
- Telegram WebApp SDK и Bot API.
- Vercel deployment.

## Локальный запуск

1. Установить зависимости:

```bash
npm install
```

2. Создать `.env` из шаблона:

```bash
copy .env.example .env
```

На macOS/Linux:

```bash
cp .env.example .env
```

3. Заполнить минимум:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_WEBAPP_URL="http://localhost:3000/app"
TELEGRAM_BOT_TOKEN="telegram_bot_token"
JWT_SECRET="long_random_secret"
ENCRYPTION_SECRET="long_random_secret"
```

4. Сгенерировать Prisma Client:

```bash
npx prisma generate
```

5. Проверить схему:

```bash
npx prisma validate
```

6. Запустить dev-сервер:

```bash
npm run dev
```

Открыть:

- Клиентский Mini App shell: `http://localhost:3000/app`
- Бизнес: `http://localhost:3000/app/[businessSlug]`
- Admin: `http://localhost:3000/admin`

## Env переменные

Полный список в [docs/ENV.md](docs/ENV.md).

Ключевые production env:

```env
DATABASE_URL=""
DIRECT_URL=""
NEXT_PUBLIC_APP_URL="https://your-vercel-domain.vercel.app"
NEXT_PUBLIC_WEBAPP_URL="https://your-vercel-domain.vercel.app/app"
TELEGRAM_BOT_TOKEN=""
TELEGRAM_BOT_USERNAME=""
TELEGRAM_SUPER_ADMIN_IDS=""
TELEGRAM_WEBHOOK_URL="https://your-vercel-domain.vercel.app/api/telegram/webhook"
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""
JWT_SECRET=""
ENCRYPTION_SECRET=""
AI_PROVIDER="mock"
```

Не хранить реальные ключи в репозитории.

## Деплой на Vercel

1. Создать Supabase проект.
2. Скопировать pooled connection string в `DATABASE_URL`.
3. Скопировать direct connection string в `DIRECT_URL`.
4. Добавить все env в Vercel Project Settings.
5. Выполнить manual SQL patches из `docs/manual-*.sql`, если production база отстает от `prisma/schema.prisma`.
6. Убедиться, что build command использует:

```bash
npm run build
```

7. Задеплоить в Vercel.
8. Настроить Telegram BotFather Mini App URL:

```text
https://your-vercel-domain.vercel.app/app
```

9. Настроить webhook:

```bash
npm run telegram:webhook:set
npm run telegram:webhook:info
```

Подробно: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Как открыть Mini App

Production Mini App должен открываться только через Vercel HTTPS URL:

```text
https://your-vercel-domain.vercel.app/app
```

Business page:

```text
https://your-vercel-domain.vercel.app/app/[businessSlug]
```

Telegram bot должен использовать production URL. Не возвращать ngrok, localhost или 127.0.0.1 в production Telegram routes/webhooks.

## Проверки перед сдачей

```bash
npm run lint
npm run typecheck
npm run build
npx prisma validate
npx prisma generate
```

QA checklist: [docs/TESTING_CHECKLIST.md](docs/TESTING_CHECKLIST.md).

## Документация

- Product spec: [docs/FEATURE_SPEC.md](docs/FEATURE_SPEC.md)
- Technical spec: [docs/TECHNICAL_SPEC.md](docs/TECHNICAL_SPEC.md)
- Database schema: [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)
- Env: [docs/ENV.md](docs/ENV.md)
- Deployment: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)
- Project rules: [docs/PROJECT_RULES.md](docs/PROJECT_RULES.md)
- Agent rules: [AGENTS.md](AGENTS.md)
