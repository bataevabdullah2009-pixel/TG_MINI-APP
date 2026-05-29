# 🚀 Инструкция по развертыванию SmartBiz AI на Vercel Staging

Этот документ содержит пошаговую инструкцию по деплою Telegram Mini App SaaS-платформы **SmartBiz AI** на хостинг **Vercel** с использованием СУБД **PostgreSQL** в качестве основной базы данных для продакшена.

---

## 🛠️ Предварительные требования

Перед началом убедитесь, что у вас готовы следующие компоненты:
1. Аккаунт **Vercel** ([vercel.com](https://vercel.com)).
2. Хостинг базы данных **PostgreSQL** (рекомендуются Vercel Postgres, Neon, Supabase, Railway или Render).
3. Учетная запись **GitHub** с импортированным репозиторием проекта.
4. Созданный Telegram-бот через [@BotFather](https://t.me/BotFather) для продакшена.

---

## 🏗️ Пошаговый процесс деплоя

### Шаг 1: Подготовка базы данных PostgreSQL
1. Создайте инстанс базы данных PostgreSQL на выбранной платформе (например, Neon или Supabase).
2. Скопируйте строку подключения `DATABASE_URL` (она должна начинаться с `postgres://` или `postgresql://`).

### Шаг 2: Первичный импорт и запуск миграций
Перед тем как развертывать приложение на Vercel, необходимо применить схему к вашей базе данных PostgreSQL:

1. Откройте локальный терминал в папке проекта.
2. Установите переменную окружения `DATABASE_URL` локально (или временно запишите ее в `.env` файл).
3. Выполните команду для инициализации схемы в PostgreSQL:
   ```bash
   npx prisma db push
   ```
   > [!NOTE]
   > Мы используем `db push` для первого развертывания, чтобы синхронизировать схему. В дальнейшем при изменениях структуры используйте `npx prisma migrate dev`.

4. (Опционально) Запустите скрипт сидирования данных для создания начальных демонстрационных шаблонов (кафе, автомойка, салон красоты) и суперадмина:
   ```bash
   npx prisma db seed
   ```

### Шаг 3: Настройка проекта на Vercel
1. Перейдите в Vercel Dashboard и нажмите **Add New** -> **Project**.
2. Выберите ваш GitHub репозиторий `TG_MINI-APP`.
3. В настройках сборки оставьте параметры по умолчанию (Next.js автоматически определится).
4. Разверните вкладку **Environment Variables** и добавьте все обязательные переменные окружения (см. полный список ниже).
5. Нажмите кнопку **Deploy**.

### Шаг 4: Настройка вебхука Telegram-бота
После успешного деплоя Vercel предоставит вам публичный домен приложения (например, `https://smartbiz-ai-staging.vercel.app`).
Вам нужно зарегистрировать вебхук у вашего Telegram-бота, чтобы он отправлял события вашему серверу:

1. Отправьте GET-запрос в браузере или через curl:
   ```
   https://smartbiz-ai-staging.vercel.app/api/admin/current-business/set-webhook?url=https://smartbiz-ai-staging.vercel.app/api/telegram/webhook
   ```
2. Бот должен вернуть JSON-ответ `{ ok: true, description: "Webhook was set" }`.
3. Откройте `@BotFather`, перейдите в меню вашего бота и настройте кнопку WebApp (Menu Button), указав ссылку: `https://smartbiz-ai-staging.vercel.app/app`.

---

## 🔑 Список переменных окружения (Environment Variables)

Добавьте эти переменные в панели управления Vercel:

| Переменная | Описание | Пример значения |
| :--- | :--- | :--- |
| **DATABASE_URL** | Строка подключения к PostgreSQL | `postgresql://user:password@ep-db-123.neon.tech/db` |
| **NODE_ENV** | Режим работы | `production` |
| **NEXT_PUBLIC_APP_URL** | Полный URL вашего развернутого приложения | `https://smartbiz-ai-staging.vercel.app` |
| **TELEGRAM_BOT_TOKEN** | API токен вашего бота от BotFather | `1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ` |
| **TELEGRAM_BOT_USERNAME** | Username вашего бота без символа `@` | `SmartBizAI_bot` |
| **TELEGRAM_SUPER_ADMIN_IDS** | Telegram ID суперадминов платформы (через запятую) | `8229830002,123456789` |
| **JWT_SECRET** | Секретный ключ шифрования авторизации JWT (мин. 32 симв.) | `a_very_long_random_string_for_jwt_security` |
| **ENCRYPTION_SECRET** | Секретный ключ для шифрования токенов клиентов | `another_secure_random_hash_code` |
| **AI_PROVIDER** | Провайдер искусственного интеллекта | `openrouter` (или `polza`) |
| **OPENROUTER_API_KEY** | Ключ API OpenRouter (требуется в production) | `sk-or-v1-xxxxxxxxxxxx...` |
| **POLZA_AI_API_KEY** | Ключ API Polza AI (если выбран `polza`) | `polza-api-key-xxxx...` |
| **AI_CACHE_ENABLED** | Кэширование ответов ИИ для экономии квот | `true` |

---

## ⚡ Оптимизация сборки на Vercel

> [!TIP]
> Для правильного создания клиента Prisma во время сборки на Vercel, добавьте в ваш `package.json` скрипт `postinstall`, если он еще не добавлен:
> ```json
> "postinstall": "prisma generate"
> ```
> Vercel автоматически запустит генерацию Prisma Client перед запуском Next.js компиляции.

---

## 🛡️ Безопасность и Специфика Production

1. **Запрет Mock-провайдера:** В режиме `production` система автоматически блокирует использование фейкового ИИ-генератора (`mock`). Если вы выберите ИИ-инструмент, не настроив ключ API, пользователю отобразится понятное русское предупреждение об отсутствии ключей, исключающее скрытые сбои или нереалистичное поведение.
2. **Изоляция данных:** Заказы и бронирования изолированы строго в рамках бизнеса продавца на уровне СУБД PostgreSQL.
3. **Безопасная верификация:** Опция обхода SMS/Telegram-верификации (bypass) принудительно отключается в режиме `production` на стороне фронтенда.
