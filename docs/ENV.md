# Environment Variables

Do not commit real secrets. Use `.env.example` as a template and store production values in Vercel Project Settings.

## Required for production

`DATABASE_URL`
- Pooled Supabase Postgres connection string.
- Used by Prisma Client at runtime.
- Source: Supabase Project Settings -> Database -> Connection string.

`DIRECT_URL`
- Direct Supabase Postgres connection string.
- Used by Prisma for validation, migrations and direct schema operations.
- Source: Supabase Project Settings -> Database -> Connection string.

`NEXT_PUBLIC_APP_URL`
- Public production origin.
- Example format: `https://your-vercel-domain.vercel.app`.
- Source: Vercel deployment domain or custom domain.

`NEXT_PUBLIC_WEBAPP_URL`
- Telegram Mini App URL.
- Example format: `https://your-vercel-domain.vercel.app/app`.
- Source: `NEXT_PUBLIC_APP_URL + /app`.

`TELEGRAM_BOT_TOKEN`
- Telegram bot token.
- Source: BotFather.

`TELEGRAM_SUPER_ADMIN_IDS`
- Comma-separated Telegram user ids with Super Admin access.
- Source: Telegram user id lookup or internal admin list.

`TELEGRAM_WEBHOOK_URL`
- Webhook endpoint.
- Example format: `https://your-vercel-domain.vercel.app/api/telegram/webhook`.
- Source: `NEXT_PUBLIC_APP_URL + /api/telegram/webhook`.

`JWT_SECRET`
- Long random server-only secret for auth tokens.
- Source: password manager or generated random string.

`ENCRYPTION_SECRET`
- Long random server-only secret for encrypted data.
- Source: password manager or generated random string.

`NEXT_PUBLIC_SUPABASE_URL`
- Supabase project URL.
- Source: Supabase Project Settings -> API.

`NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Supabase anon key.
- Source: Supabase Project Settings -> API.

`SUPABASE_SERVICE_ROLE_KEY`
- Server-only service role key for storage/server operations.
- Source: Supabase Project Settings -> API.
- Never expose in client code.

## Recommended

`TELEGRAM_BOT_USERNAME`
- Bot username without `@`.
- Source: BotFather.

`NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
- Public bot username for client-side links.
- Source: BotFather.

`TELEGRAM_ADMIN_CHAT_ID`
- Fallback seller/admin chat id for notifications.
- Source: Telegram chat id after bot interaction.

`VALIDATE_TELEGRAM_DATA`
- Set to `true` in production when Telegram initData signature validation is required.

`AI_PROVIDER`
- `mock`, `openrouter` or `polza`.
- Use `mock` if no paid provider is configured.

`OPENROUTER_API_KEY`
- Required only when `AI_PROVIDER=openrouter`.
- Source: OpenRouter dashboard.

`OPENROUTER_BASE_URL`
- Optional override. Default should point to OpenRouter API.

`OPENROUTER_MODEL`
- Optional model name.

`OPENROUTER_SITE_URL`
- Optional referer URL for OpenRouter requests.

`OPENROUTER_SITE_NAME`
- Optional app name for OpenRouter requests.

`POLZA_AI_API_KEY`
- Required only when `AI_PROVIDER=polza`.
- Source: Polza AI dashboard.

`POLZA_BASE_URL`
- Optional Polza API base URL.

`POLZA_TEXT_MODEL`
- Optional Polza text model.

`POLZA_IMAGE_MODEL`
- Optional Polza image model.

## Optional

`AI_MAX_OUTPUT_TOKENS`
- Maximum tokens requested from AI providers.

`AI_TEMPERATURE`
- AI generation temperature.

`AI_MAX_PROMPT_CHARS`
- Max prompt length accepted by AI helpers.

`AI_CACHE_ENABLED`
- Set to `true` to use AI response cache.

`SUPABASE_STORAGE_BUSINESS_MEDIA_BUCKET`
- Defaults to `business-media`.

`SUPABASE_STORAGE_PRODUCT_IMAGES_BUCKET`
- Defaults to `product-images`.

`SUPABASE_STORAGE_BUSINESS_COVERS_BUCKET`
- Defaults to `business-covers`.

## Upload storage

Current upload routes use Supabase Storage server-side:

- `/api/upload`
- `/api/uploads`
- `/api/admin/media/upload`

Required variables for uploads are `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and server-only `SUPABASE_SERVICE_ROLE_KEY`.
Optional bucket overrides are `SUPABASE_STORAGE_BUSINESS_MEDIA_BUCKET`, `SUPABASE_STORAGE_PRODUCT_IMAGES_BUCKET` and `SUPABASE_STORAGE_BUSINESS_COVERS_BUCKET`.

`BLOB_READ_WRITE_TOKEN` is not required for the current upload implementation.

`ALLOW_UNVERIFIED_PHONE_IN_DEV`
- Development bypass for phone verification. Do not enable in production.

`SMS_PROVIDER`
- Optional SMS provider switch. Current production phone confirmation is Telegram contact based.

`ADMIN_EMAIL`
- Optional seed/default admin email.

`ADMIN_PASSWORD`
- Optional seed/default admin password. Do not use weak values in production.

`REDIS_URL`
- Optional future queue/cache integration.

`BLOB_READ_WRITE_TOKEN`
- Optional Vercel Blob token if a future upload path uses Vercel Blob.

`NEXT_PUBLIC_IS_DEVELOPMENT`
- Optional public development flag.

`NODE_ENV`
- Managed by Vercel or local runtime.

## Production URL rules

- Production Telegram Mini App URL must be HTTPS.
- Do not use ngrok, localhost or 127.0.0.1 in production.
- Keep `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WEBAPP_URL` and `TELEGRAM_WEBHOOK_URL` consistent.
