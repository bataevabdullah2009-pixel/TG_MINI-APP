# Vitrina AI Tech Spec

## Stack

- Next.js 15 App Router.
- React 19 and TypeScript.
- Prisma ORM.
- Supabase Postgres in production.
- Telegram Bot API and Telegram WebApp SDK.
- Vercel deployment target.

## Environment

Required production URL variables:

- `NEXT_PUBLIC_APP_URL`: base deployed domain, for example `https://production-domain.vercel.app`.
- `NEXT_PUBLIC_WEBAPP_URL`: public application origin without `/app`, for example `https://production-domain.vercel.app`.
- `TELEGRAM_WEBHOOK_URL`: webhook URL, for example `https://production-domain.vercel.app/api/telegram/webhook`.

In production, Telegram URLs must be HTTPS and must not use ngrok, localhost, or 127.0.0.1.

## Routes

- `/app`: global catalog.
- `/app/[slug]`: business page.
- `/admin`: business admin.
- `/admin/super`: SaaS admin.
- `/api/telegram/webhook`: Telegram webhook.
- `/api/health`: health probe.

## API Endpoints

- `GET /api/marketplace/businesses`
- `GET /api/businesses/[slug]/catalog`
- `POST /api/businesses/[slug]/orders`
- `POST /api/businesses/[slug]/bookings`
- `GET /api/telegram/set-webhook`
- `GET /api/telegram/debug`

## Deployment Checks

Run before deploy:

```bash
npm run build
npm run lint
npm run typecheck
```
