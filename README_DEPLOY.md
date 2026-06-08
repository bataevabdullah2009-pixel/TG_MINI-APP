# 🚀 Инструкция по развертыванию Vitrina AI на Vercel & Supabase

Этот документ содержит пошаговую инструкцию по деплою Telegram Mini App SaaS-платформы **Vitrina AI** на хостинг **Vercel** с использованием СУБД **Supabase PostgreSQL** в качестве основной базы данных для продакшена.

---

## 🛠️ Предварительные требования

Перед началом убедитесь, что у вас готовы следующие компоненты:
1. Аккаунт **Vercel** ([vercel.com](https://vercel.com)).
2. Проект на **Supabase** ([supabase.com](https://supabase.com)).
3. Учетная запись **GitHub** с импортированным репозиторием проекта.
4. Созданный Telegram-бот через [@BotFather](https://t.me/BotFather) для продакшена.

---

## 🏗️ Пошаговый процесс деплоя

### Шаг 1: Подготовка базы данных Supabase и Connection Pooler
Prisma в serverless-среде (Vercel) требует настройки двух строк подключения, чтобы избежать перегрузки пула соединений Supabase:

1. Перейдите в ваш проект **Supabase > Project Settings > Database**.
2. В секции **Connection string** переключитесь на вкладку **URI**.
3. Скопируйте две строки подключения:
   * **Transaction Pooler (Рекомендуется для Vercel):** Режим пулера транзакций (порт `6543`). Добавьте в конец строки параметры `?pgbouncer=true&connection_limit=1`. Это ваша переменная **`DATABASE_URL`**.
     * *Пример:* `postgresql://postgres.bkqmpjeghuloyzldppwa:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`
   * **Direct Connection (Прямое подключение):** Прямое подключение к СУБД (порт `5432`). Это ваша переменная **`DIRECT_URL`** (используется Prisma для применения миграций и `db push`).
     * *Пример:* `postgresql://postgres.bkqmpjeghuloyzldppwa:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`

---

### Шаг 2: Первичная инициализация таблиц и Seed-данных
Перед тем как развертывать приложение на Vercel, необходимо локально применить схему к вашей облачной базе данных Supabase:

1. Откройте локальный терминал в папке проекта.
2. Временно добавьте в ваш локальный файл `.env` полученные строки подключения:
   ```env
   DATABASE_URL="строка_с_портом_6543_и_pgbouncer=true"
   DIRECT_URL="строка_с_портом_5432_прямого_подключения"
   ```
3. Выполните команду генерации клиента Prisma:
   ```bash
   npx prisma generate
   ```
4. Выполните команду для инициализации таблиц схемы в Supabase:
   ```bash
   npx prisma db push
   ```
   > [!IMPORTANT]
   > Команда `db push` создаст все необходимые таблицы в Supabase. Убедитесь, что в Supabase Table Editor появились таблицы `User`, `Business`, `Category`, `Item` и другие.

5. Заполните базу данных начальными демонстрационными шаблонами (кафе, автомойка, салон красоты) и суперадмином:
   ```bash
   npm run db:seed
   ```

---

### Шаг 3: Настройка проекта на Vercel
1. Перейдите в Vercel Dashboard и нажмите **Add New** -> **Project**.
2. Выберите ваш GitHub репозиторий `TG_MINI-APP`.
3. В настройках сборки оставьте параметры по умолчанию (Next.js автоматически определится).
4. Разверните вкладку **Environment Variables** и добавьте все обязательные переменные окружения (см. полный список ниже).
5. Нажмите кнопку **Deploy**.

---

### Шаг 4: Настройка вебхука Telegram-бота
После успешного деплоя Vercel предоставит вам публичный домен приложения (например, `https://tg-mini-app-two-ruby.vercel.app`).
Вам нужно зарегистрировать вебхук у вашего Telegram-бота:

1. Откройте браузер и перейдите по адресу:
   ```
   https://tg-mini-app-two-ruby.vercel.app/api/telegram/set-webhook
   ```
2. Бот должен вернуть JSON-ответ с успешным результатом:
   ```json
   {
     "ok": true,
     "webhookUrl": "https://tg-mini-app-two-ruby.vercel.app/api/telegram/webhook",
     "telegramResponse": {
       "ok": true,
       "result": true,
       "description": "Webhook was set"
     }
   }
   ```
3. Откройте `@BotFather`, выберите вашего бота, перейдите в **Bot Settings** -> **Menu Button** -> **Configure Menu Button**.
4. Укажите тип кнопки: **WebApp**.
5. Напишите текст (например, `🏪 Открыть Vitrina AI`) и укажите ссылку на ваш Mini App:
   ```
   https://tg-mini-app-two-ruby.vercel.app/app
   ```

---

## 🔑 Список переменных окружения для Vercel

Добавьте эти переменные в панели управления Vercel:

| Переменная | Описание | Пример значения |
| :--- | :--- | :--- |
| **DATABASE_URL** | Пулер Supabase (порт 6543) | `postgresql://postgres.xxx:pass@host:6543/postgres?pgbouncer=true&connection_limit=1` |
| **DIRECT_URL** | Прямое подключение (порт 5432) | `postgresql://postgres.xxx:pass@host:5432/postgres` |
| **NODE_ENV** | Режим работы | `production` |
| **NEXT_PUBLIC_APP_URL** | Полный URL вашего приложения Vercel | `https://tg-mini-app-two-ruby.vercel.app` |
| **NEXT_PUBLIC_WEBAPP_URL** | URL Mini App клиента (с `/app`) | `https://tg-mini-app-two-ruby.vercel.app/app` |
| **TELEGRAM_WEBHOOK_URL** | Вебхук URL | `https://tg-mini-app-two-ruby.vercel.app/api/telegram/webhook` |
| **TELEGRAM_BOT_TOKEN** | API токен бота от BotFather | `1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ` |
| **TELEGRAM_BOT_USERNAME** | Username бота без символа `@` | `VitrinaAI_bot` |
| **TELEGRAM_SUPER_ADMIN_IDS** | Telegram ID суперадминов (через запятую) | `8229830002,123456789` |
| **JWT_SECRET** | Секретный ключ авторизации JWT (мин. 32 симв.) | `a_very_long_random_string_for_jwt_security` |
| **ENCRYPTION_SECRET** | Секретный ключ шифрования токенов | `another_secure_random_hash_code` |
| **AI_PROVIDER** | Провайдер искусственного интеллекта | `openrouter` (или `polza` / `mock`) |
| **OPENROUTER_API_KEY** | Ключ API OpenRouter | `sk-or-v1-xxxxxxxxxxxx...` |
| **AI_CACHE_ENABLED** | Кэширование ответов ИИ | `true` |

---

## ⚡ Оптимизация сборки на Vercel

Для правильного создания клиента Prisma во время сборки на Vercel убедитесь, что в файле `package.json` в секции `scripts` присутствует команда `postinstall`:
```json
"postinstall": "prisma generate"
```
Vercel автоматически запустит генерацию Prisma Client перед сборкой Next.js, что гарантирует полную работоспособность приложения.
