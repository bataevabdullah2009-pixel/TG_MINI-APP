# AGENT

Vitrina AI - SaaS-маркетплейс Telegram Mini Apps на Next.js, Prisma и Supabase PostgreSQL.

Правила работы агента:
- сначала читать `docs/specs/README.md`;
- работать в порядке SPEC -> PLAN -> CODE;
- не переписывать проект с нуля;
- не менять реальные токены в `.env`;
- не сбрасывать production PostgreSQL и не удалять production-данные;
- не ломать Telegram bot `/start`, `/app`, `/app/[businessSlug]`, checkout, Super Admin, seller и courier;
- все пользовательские тексты писать на русском;
- новые публичные клиентские маршруты держать в `/app` и `/app/[businessSlug]`;
- бизнес-UI выбирать только по `Business.templateKey`.

Ключевые команды:
- `npm.cmd run dev` - запуск разработки;
- `npm.cmd run typecheck` - проверка TypeScript;
- `npm.cmd run build` - production build;
- `npx prisma validate` - проверка Prisma schema;
- `npx prisma generate` - генерация Prisma Client.

`db:push` и `db:seed` запускаются только после проверки целевого окружения.
