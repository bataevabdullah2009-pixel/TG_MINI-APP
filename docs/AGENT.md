# AGENT

SmartBiz AI - SaaS-маркетплейс Telegram Mini Apps на Next.js, Prisma и SQLite.

Правила работы агента:
- не переписывать проект с нуля;
- не менять реальные токены в `.env`;
- сохранять SQLite/Prisma;
- не ломать Telegram bot `/start`, `/app/demo-cafe`, Super Admin и seller admin;
- все пользовательские тексты писать на русском;
- новые публичные клиентские маршруты держать в `/app` и `/app/[businessSlug]`;
- бизнес-UI выбирать только по `Business.templateKey`.

Ключевые команды:
- `npm.cmd run dev` - запуск разработки;
- `npm.cmd run db:push` - синхронизация SQLite;
- `npm.cmd run db:seed` - демо-бизнесы;
- `npm.cmd run type-check` - проверка TypeScript.
