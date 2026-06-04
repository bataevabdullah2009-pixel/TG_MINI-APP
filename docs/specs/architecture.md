# ARCHITECTURE

Проект построен на Next.js App Router.

Слои:
- `src/app/app/page.tsx` - главный каталог Mini App;
- `src/app/app/[businessSlug]/page.tsx` - публичный Mini App конкретного бизнеса;
- `src/app/(admin)/admin/*` - браузерная админка продавца и Super Admin;
- `src/app/api/*` - публичные, admin и super API;
- `src/lib/business-templates.ts` - шаблоны бизнеса и seed-данные;
- `src/lib/ai/*` - AI routing, лимиты, провайдеры и кеш;
- `src/lib/notifications/notification-service.ts` - Telegram-уведомления;
- `prisma/schema.prisma` - SQLite-модель SaaS.

Главная модель - `Business`. Она связывает владельца, каталог, заказы, записи, клиентов, staff, настройки, AI usage и маркетинговые черновики.
