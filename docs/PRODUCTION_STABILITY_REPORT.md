# Production Stability Report

Дата проверки: 4 июня 2026
Ветка: `fix/production-stability-vitrina`

## Что стабилизировано

- `/app` оставлен общим каталогом, `/app/{slug}` открывает конкретный бизнес, ошибки каталога и неизвестный slug не роняют Mini App.
- Предпросмотр продавца открывает внутренний `/app/{business.slug}` без `window.open`.
- Production URL валидируются: localhost, 127.0.0.1, ngrok и Vercel Preview не используются для Telegram production routing.
- Избранное использует реальные данные, фото и ссылки на магазин/товар; добавлено удаление и безопасное состояние `Недоступно`.
- Загрузка чеков принимает JPG/JPEG/PNG/WEBP/PDF до 10 MB, проверяет MIME/signature, сохраняет metadata и переводит оплату в `AWAITING_REVIEW`.
- Продавец видит чек и может подтвердить/отклонить оплату; клиент видит понятное сообщение об отклонении.
- Polza AI используется как реальный provider для чатов, карточек и вспомогательной проверки чеков; mock в production не используется.
- Генератор карточек требует строгий JSON, делает один retry и не сохраняет карточку без подтверждения продавца.
- Добавлены/стабилизированы зоны доставки, курьеры, назначения, статусы, уведомления и удаление курьеров.
- Добавлено безопасное удаление категорий с отвязкой товаров.
- Системные select для требуемых полей заменены на mobile bottom sheet picker.
- Checkout полноэкранный, с фото, способами получения/оплаты, зоной, чеком и блокировкой кнопки до заполнения обязательных полей.
- Заказы требуют подтверждённый телефон и подписанный Telegram `initData`; rate limit: максимум 5 попыток за 10 минут по Telegram ID, телефону или IP.
- Telegram Contact подтверждается только webhook-контактом с совпадающим `contact.user_id`. Webhook защищён `TELEGRAM_WEBHOOK_SECRET`.
- Добавлена расширенная диагностика `/api/health/db?diagnose=1`.

Поведение `requestContact` сверено с [официальной документацией Telegram Mini Apps](https://core.telegram.org/bots/webapps): callback сообщает статус отправки, а подтверждённый номер приходит боту через webhook.

## SQL

Перед деплоем нужно скопировать **целиком всё содержимое** `docs/production-stability.sql` в Supabase SQL Editor и выполнить один раз.

SQL аддитивный: использует `IF NOT EXISTS`, добавляет таблицы/поля/индексы/RLS/storage bucket и не содержит `DROP` или удаления production-данных.

## Обязательные Vercel env

```text
DATABASE_URL
DIRECT_URL
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_WEBAPP_URL
TELEGRAM_WEBHOOK_URL
TELEGRAM_WEBHOOK_SECRET
TELEGRAM_BOT_TOKEN
TELEGRAM_BOT_USERNAME
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
VALIDATE_TELEGRAM_DATA=true
AI_PROVIDER=polza
POLZA_AI_API_KEY
POLZA_TEXT_MODEL
POLZA_VISION_MODEL
POLZA_IMAGE_MODEL
POLZA_BASE_URL
POLZA_CHAT_BASE_URL
POLZA_MEDIA_BASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_PAYMENT_PROOFS_BUCKET=payment-proofs
JWT_SECRET
ENCRYPTION_SECRET
CRON_SECRET
SMS_PROVIDER=mock
PHONE_TEST_CODE_ENABLED=false
```

После добавления или ротации `TELEGRAM_WEBHOOK_SECRET` нужно выполнить `npm run telegram:webhook:set` для основного бота и повторно подключить webhook каждого бизнес-бота из админки.

## Проверки

| Проверка | Результат |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, только существующие warnings по hooks и `<img>` |
| `npm run build` | PASS |
| `npx prisma generate` | PASS |
| `npx prisma validate` | PASS с временным placeholder `DIRECT_URL`, без подключения к БД |
| `git diff --check` | PASS |
| `npm run smoke:polza-ai` | PASS: реальный Polza ответил, карточка вернула строгий JSON без retry |
| Локальный security smoke | PASS: webhook secret, order/favorites/contact auth возвращают ожидаемые 200/401 |
| `npm run env:diagnose` | Ожидаемый FAIL: в локальном `.env` отсутствуют `DIRECT_URL` и `TELEGRAM_WEBHOOK_SECRET` |
| Live production smoke | PARTIAL: `/app`, `/app/mir-conditera`, marketplace, `mir-conditera` и `demo-cafe` каталоги прошли; deployed версия ещё старая и не содержит новый `TELEGRAM_AUTH_INVALID/401` до деплоя этой ветки |

Локальная БД `localhost:5432` недоступна, поэтому build использовал предусмотренный fallback каталога. Production write-smoke намеренно не запускался, чтобы не создавать реальные заказы.

## Ручные сценарии

| # | Сценарий | Результат |
| --- | --- | --- |
| 1 | Клиент открывает `/app` | PASS, local и live route smoke |
| 2 | Клиент открывает `/app/mir-conditera` | PASS, local и live route smoke |
| 3 | Добавляет товар в корзину | PARTIAL: UI/build проверены, live click-flow не выполнялся |
| 4 | Добавляет товар в избранное | PARTIAL: API/UI защищены, нужен подписанный Telegram session |
| 5 | Открывает избранное и переходит в товар | PARTIAL: ссылка `/app/{slug}?item={id}` реализована, нужен Telegram session |
| 6 | Самовывоз наличными | BLOCKED до staging write-smoke с подтверждённым телефоном |
| 7 | Доставка наличными | BLOCKED до staging write-smoke с зоной доставки |
| 8 | Перевод и загрузка чека | BLOCKED до применения SQL/bucket и staging write-smoke |
| 9 | Продавец получает уведомление | BLOCKED до реального Telegram order smoke |
| 10 | Продавец видит заказ | BLOCKED до staging write-smoke |
| 11 | Продавец подтверждает оплату | BLOCKED до staging write-smoke |
| 12 | Продавец назначает курьера | BLOCKED до staging write-smoke |
| 13 | Курьер получает уведомление | BLOCKED до реального Telegram courier smoke |
| 14 | Polza AI отвечает по товарам текущего бизнеса | PARTIAL: provider live smoke PASS, business-specific Telegram chat требует реальный chat smoke |
| 15 | Генератор карточки через Polza AI возвращает JSON | PASS, live Polza smoke |

## Порядок выкладки

1. Добавить обязательные Vercel env, особенно `DIRECT_URL` и `TELEGRAM_WEBHOOK_SECRET`.
2. Выполнить целиком SQL из `docs/production-stability.sql` в Supabase SQL Editor.
3. Задеплоить ветку `fix/production-stability-vitrina`.
4. Переустановить webhook основного и бизнес-ботов с новым secret token.
5. Проверить `/api/health/db?diagnose=1` с `Authorization: Bearer <CRON_SECRET>`.
6. Выполнить staging write-smoke для заказов, чеков, продавца и курьера с тестовыми Telegram-пользователями.

## Что осталось на потом

- Подключить реального SMS-провайдера, если нужен ручной OTP fallback. Сейчас production безопасно требует Telegram Contact; mock-код отключён.
- Перевести bucket чеков с public URL на private/signed URLs как отдельное security-hardening изменение.
- Устранить существующие lint warnings по React hooks и `<img>`.
- Выполнить полный live write-smoke после SQL/env/deploy; без этого нельзя честно подтвердить сценарии 6-13.

## Изменённые файлы

Environment, schema, docs:

```text
.env.example
docs/ENV.md
docs/production-stability.sql
docs/PRODUCTION_STABILITY_REPORT.md
prisma/schema.prisma
```

Scripts:

```text
scripts/env-diagnostics.mjs
scripts/smoke-polza-ai.mjs
scripts/smoke-production-flow.js
scripts/telegram-webhook.mjs
```

Pages and components:

```text
src/app/(admin)/admin/items/page.tsx
src/app/(admin)/admin/super/businesses/new/page.tsx
src/app/(miniapp)/[slug]/checkout/page.tsx
src/app/app/[businessSlug]/page.tsx
src/app/app/page.tsx
src/components/app/AiCenter.tsx
src/components/app/ClientFavorites.tsx
src/components/app/ClientOrders.tsx
src/components/app/PhoneVerificationScreen.tsx
src/components/app/SellerCouriers.tsx
src/components/app/SellerHome.tsx
src/components/app/SellerStoreTools.tsx
src/components/app/SuperAdminHome.tsx
src/components/courier/CourierDashboard.tsx
src/components/storefront/FullScreenCheckout.tsx
src/components/ui/BottomSheetPicker.tsx
```

API routes:

```text
src/app/api/admin/ai/generate/route.ts
src/app/api/admin/ai/route.ts
src/app/api/admin/couriers/[id]/route.ts
src/app/api/admin/couriers/route.ts
src/app/api/admin/current-business/set-webhook/route.ts
src/app/api/admin/orders/[id]/assign-courier/route.ts
src/app/api/admin/orders/[id]/route.ts
src/app/api/admin/super/businesses/route.ts
src/app/api/admin/super/seed/route.ts
src/app/api/ai/generate-content/route.ts
src/app/api/auth/phone/verify-contact/route.ts
src/app/api/businesses/[slug]/catalog/route.ts
src/app/api/categories/route.ts
src/app/api/courier/orders/[orderId]/route.ts
src/app/api/courier/orders/route.ts
src/app/api/customer/orders/route.ts
src/app/api/favorites/business/route.ts
src/app/api/favorites/product/route.ts
src/app/api/orders/[id]/route.ts
src/app/api/orders/payment-proof/route.ts
src/app/api/orders/route.ts
src/app/api/seller/orders/[orderId]/reject-payment/route.ts
src/app/api/telegram/debug/route.ts
src/app/api/telegram/set-webhook/route.ts
src/app/api/telegram/webhook/route.ts
```

Libraries and types:

```text
src/lib/ai/ai-cost-control.ts
src/lib/ai/ai-service.ts
src/lib/ai/payment-proof-analyzer.ts
src/lib/ai/polza-provider.ts
src/lib/ai/provider.ts
src/lib/ai/safe-ai-json.ts
src/lib/api-client.ts
src/lib/auth-telegram.ts
src/lib/business-share-links.ts
src/lib/db-diagnostics.ts
src/lib/delivery/delivery-service.ts
src/lib/env-validation.ts
src/lib/favorites-api.ts
src/lib/notifications/notification-service.ts
src/lib/phone/phone-utils.ts
src/lib/phone/phone-verification-service.ts
src/lib/production-url.ts
src/lib/supabase-storage.ts
src/lib/telegram-webhook-config.ts
src/types/index.ts
```

Существующие несвязанные изменения `TG_MINI APP` и `tsconfig.tsbuildinfo` не откатывались и намеренно не включены в список изменений задачи.
