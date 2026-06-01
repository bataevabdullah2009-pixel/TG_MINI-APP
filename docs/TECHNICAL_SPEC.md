# Technical Spec

## Stack

- Framework: Next.js App Router.
- Language: TypeScript.
- UI: React client components, Tailwind CSS, lucide-react.
- Backend: Next.js API routes.
- ORM: Prisma Client.
- Database: Supabase Postgres.
- Storage: Supabase Storage buckets.
- Hosting: Vercel.
- Telegram: Telegram WebApp SDK and Telegram Bot API.
- AI: local mock provider, OpenRouter, Polza AI.

## Next.js

Key app routes:
- `/app` - customer Mini App shell and global marketplace catalog.
- `/app/[businessSlug]` - single business storefront.
- `/[slug]` and nested `[slug]` routes - legacy/business-specific Mini App routes still present.
- `/admin` - admin/seller web panel.
- `/admin/super` - Super Admin panel.

Key API groups:
- `/api/marketplace/businesses`
- `/api/businesses`
- `/api/businesses/[slug]`
- `/api/businesses/[slug]/catalog`
- `/api/orders`
- `/api/bookings`
- `/api/customers/favorites`
- `/api/customers/history`
- `/api/auth/telegram-session`
- `/api/telegram/webhook`
- `/api/admin/*`

## Prisma

Prisma schema is in `prisma/schema.prisma`.

Rules:
- Prisma Client must be generated before build.
- Production schema changes must be represented in `prisma/schema.prisma`.
- Production Supabase changes must also have a manual SQL patch under `docs/manual-*.sql`.
- Never reset production database.
- Never use `DROP TABLE` for hotfixes.

Useful commands:

```bash
npx prisma validate
npx prisma generate
npm run db:push
npm run db:seed
```

Use `db:push` carefully and only against intended environments.

## Supabase

Supabase is used for:
- Postgres production database.
- Storage buckets for business media, product images and covers.

Required storage buckets:
- `business-media`
- `product-images`
- `business-covers`

Important connection strings:
- `DATABASE_URL` - pooled connection for app runtime.
- `DIRECT_URL` - direct connection for Prisma migrations/validation.

## Telegram Bot

Telegram responsibilities:
- Validate or parse Telegram initData.
- Open Mini App through production Vercel URL.
- Receive webhook updates at `/api/telegram/webhook`.
- Send seller notifications for new orders/bookings when chat id is configured.
- Support seller linking/onboarding flows.

Production Telegram URLs must not use ngrok, localhost or 127.0.0.1.

Webhook scripts:

```bash
npm run telegram:webhook:info
npm run telegram:webhook:set
npm run telegram:webhook:delete
```

## Vercel

Vercel hosts the Next.js app and API routes. Build command:

```bash
npm run build
```

The build script runs `prisma generate` before `next build`.

Required Vercel setup:
- Add all production env variables.
- Use production Supabase URLs.
- Set `NEXT_PUBLIC_APP_URL` to the Vercel HTTPS domain.
- Set `NEXT_PUBLIC_WEBAPP_URL` to `NEXT_PUBLIC_APP_URL + /app`.
- Set `TELEGRAM_WEBHOOK_URL` to `NEXT_PUBLIC_APP_URL + /api/telegram/webhook`.

## Folder Structure

- `src/app` - Next.js App Router pages and API routes.
- `src/app/app` - Telegram Mini App customer/seller shell.
- `src/app/api` - backend API routes.
- `src/components/app` - Mini App UI components.
- `src/components/mini-app` - business-specific Mini App components.
- `src/lib` - shared server/client helpers.
- `src/lib/ai` - AI provider and cost control logic.
- `src/lib/notifications` - Telegram notification service.
- `src/lib/phone` - phone verification helpers.
- `prisma` - Prisma schema and seed.
- `docs` - specs, deployment, manual SQL patches and QA docs.
- `scripts` - operational scripts such as Telegram webhook setup.

## Error Handling

User-facing APIs must not expose raw Prisma errors. Known schema drift errors such as `P2022` must be logged server-side and converted into a normal message or safe empty state.
