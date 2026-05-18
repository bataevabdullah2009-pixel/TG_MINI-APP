# TECHNICAL SPEC

Стек:
- Next.js App Router;
- React client components для Mini App;
- Prisma Client;
- SQLite `prisma/dev.db`;
- Telegram Bot API через `src/lib/telegram-bot-service.ts`;
- AI через `mock`, OpenRouter или Polza.

Публичные маршруты:
- `/app` - каталог активных бизнесов;
- `/app/[businessSlug]` - конкретный бизнес;
- `/api/marketplace/businesses`;
- `/api/businesses/[slug]`;
- `/api/businesses/[slug]/catalog`;
- `/api/businesses/[slug]/orders`;
- `/api/businesses/[slug]/bookings`;
- `/api/businesses/[slug]/slots`;
- `/api/businesses/[slug]/favorites`.

Админские маршруты:
- `/admin`;
- `/admin/orders`;
- `/admin/bookings`;
- `/admin/items`;
- `/admin/customers`;
- `/admin/ai`;
- `/admin/settings`;
- `/admin/super`.
