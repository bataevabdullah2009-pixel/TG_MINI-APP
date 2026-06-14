# Deployment

This project deploys to Vercel with Supabase Postgres, Supabase Storage, Prisma and Telegram Bot API.

## 1. Supabase setup

1. Create a Supabase project.
2. Open Project Settings -> Database.
3. Copy pooled connection string to `DATABASE_URL`.
4. Copy direct connection string to `DIRECT_URL`.
5. Open Project Settings -> API.
6. Copy project URL to `NEXT_PUBLIC_SUPABASE_URL`.
7. Copy anon key to `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
8. Copy service role key to `SUPABASE_SERVICE_ROLE_KEY`.

Create storage buckets:
- `business-media`
- `product-images`
- `business-covers`

Bucket names can be overridden with:
- `SUPABASE_STORAGE_BUSINESS_MEDIA_BUCKET`
- `SUPABASE_STORAGE_PRODUCT_IMAGES_BUCKET`
- `SUPABASE_STORAGE_BUSINESS_COVERS_BUCKET`

## 2. Database schema

Before production deploy:

```bash
npx prisma validate
npx prisma generate
```

For new Prisma fields:
- Update `prisma/schema.prisma`.
- Add a manual SQL patch under `docs/manual-*.sql`.
- Apply the SQL patch in Supabase SQL Editor.
- Do not reset production database.
- Do not drop tables.

Known current manual patch:
- `docs/manual-supabase-hotfix-business-is-demo.sql`
- `docs/manual-supabase-hotfix-schema-sync.sql`

If Vercel logs show `column does not exist` for `Business.isDemo` or User phone verification fields, run `docs/manual-supabase-hotfix-schema-sync.sql` in Supabase SQL Editor, then redeploy without resetting the database.

## 3. Vercel setup

1. Import the repository into Vercel.
2. Set Framework Preset to Next.js.
3. Use build command:

```bash
npm run build
```

4. Add production env variables from [ENV.md](../ENV.md).
5. Deploy.

Minimum required production env:

```env
DATABASE_URL=""
DIRECT_URL=""
NEXT_PUBLIC_APP_URL="https://your-vercel-domain.vercel.app"
NEXT_PUBLIC_WEBAPP_URL="https://your-vercel-domain.vercel.app/app"
TELEGRAM_BOT_TOKEN=""
TELEGRAM_SUPER_ADMIN_IDS=""
TELEGRAM_WEBHOOK_URL="https://your-vercel-domain.vercel.app/api/telegram/webhook"
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""
JWT_SECRET=""
ENCRYPTION_SECRET=""
CRON_SECRET=""
AI_PROVIDER="polza"
POLZA_AI_API_KEY=""
POLZA_BASE_URL="https://polza.ai/api/v1"
POLZA_TEXT_MODEL="z-ai/glm-4.7-flash"
```

## 4. Telegram BotFather setup

1. Create a bot in BotFather.
2. Save token in `TELEGRAM_BOT_TOKEN`.
3. Set bot username in `TELEGRAM_BOT_USERNAME`.
4. Configure Mini App / Web App URL:

```text
https://your-vercel-domain.vercel.app/app
```

5. Do not configure production BotFather URLs with ngrok or localhost.

## 5. Webhook setup

Set:

```env
TELEGRAM_WEBHOOK_URL="https://your-vercel-domain.vercel.app/api/telegram/webhook"
```

Then run:

```bash
npm run telegram:webhook:set
npm run telegram:webhook:info
```

Direct check:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo
```

Delete webhook only when intentionally switching deployment:

```bash
npm run telegram:webhook:delete
```

## 6. Mini App URL setup

Canonical Mini App URL:

```text
NEXT_PUBLIC_APP_URL + /app
```

Business storefront:

```text
NEXT_PUBLIC_APP_URL + /app/[businessSlug]
```

Keep route structure stable. Do not change Mini App routes during deployment hotfixes.

## 7. Scheduled expiration

Create a Vercel Cron Job or external scheduler for:

```text
https://your-vercel-domain.vercel.app/api/cron/expire
```

Authorize the request with one of:

```text
Authorization: Bearer CRON_SECRET
```

or:

```text
https://your-vercel-domain.vercel.app/api/cron/expire?secret=CRON_SECRET
```

The endpoint expires:
- bookings that are still `PENDING`, `NEW` or `CONFIRMED` 5+ minutes after `startTime`;
- pickup orders that are not `COMPLETED`, `CANCELLED` or `EXPIRED` 24+ hours after `createdAt`.

## 8. Release checks

Run locally or in CI before final deploy:

```bash
npm run lint
npm run typecheck
npm run build
npx prisma validate
npx prisma generate
```

Manual QA:
- Open `/app`.
- Open a business page.
- Create a test order.
- Confirm seller panel sees the order.
- Check Telegram bot opens the Vercel Mini App URL.
- Check Supabase production logs for raw Prisma errors.

## 9. Rollback

If deploy breaks production:
- Roll back Vercel deployment first.
- Do not reset Supabase.
- Do not delete data.
- If a DB patch caused an issue, prepare a safe forward SQL patch.
