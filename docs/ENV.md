# Environment Variables

Do not commit real secrets. Use `.env.example` as a template and store production values in Vercel Project Settings.

Run `npm run env:diagnose` before deploy. It reports missing variables and unsafe URL hosts without printing secrets.

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

`CRON_SECRET`
- Long random server-only secret for scheduled endpoints.
- Required for `/api/cron/expire` and protected `/api/health/db?diagnose=1`.
- Send only as `Authorization: Bearer CRON_SECRET`.

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

`NEXT_PUBLIC_TELEGRAM_MINI_APP_SHORT_NAME`
- Optional Mini App short name from BotFather.
- Used for direct links like `https://t.me/BOT/SHORT_NAME?startapp=store_demo-cafe`.
- If omitted, the app uses `https://t.me/BOT?startapp=store_demo-cafe`.

`NEXT_PUBLIC_AI_CARD_BOT_URL`
- Public URL of the separate AI bot for product cards and advertising materials.
- If omitted, the seller panel shows the disabled state `AI-бот не настроен`.

`TELEGRAM_ADMIN_CHAT_ID`
- Fallback seller/admin chat id for notifications.
- Source: Telegram chat id after bot interaction.

`VALIDATE_TELEGRAM_DATA`
- Set to `true` in production when Telegram initData signature validation is required.

`AI_PROVIDER`
- `mock`, `openrouter` or `polza`.
- Use `polza` for real Polza AI generation. Use `mock` only for explicit local/mock mode.

`NEXT_PUBLIC_ENABLE_ADVANCED_AI`
- Public feature flag for extra AI tabs.
- Set to `false` for MVP production so only `Карточка товара`, `TG Пост` and `Улучшить текст` are shown.

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
- Optional Polza API base URL. Default: `https://polza.ai/api/v1`.

`POLZA_CHAT_BASE_URL`
- Optional exact Polza chat completions endpoint.
- Recommended value: `https://polza.ai/api/v1/chat/completions`.

`POLZA_MEDIA_BASE_URL`
- Optional Polza media endpoint for vision/payment-proof analysis.
- Recommended value: `https://polza.ai/api/v1/media`.

`POLZA_TEXT_MODEL`
- Optional Polza text model. Default: `z-ai/glm-4.7-flash`.

`POLZA_VISION_MODEL`
- Optional Polza vision model for payment-proof analysis.
- Recommended value: `google/gemini-3.1-flash-image-preview`.

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
- Legacy optional variable. Current upload routes use `SUPABASE_STORAGE_BUSINESS_MEDIA_BUCKET` for product images too.

`SUPABASE_STORAGE_BUSINESS_COVERS_BUCKET`
- Legacy optional variable. Current upload routes use `SUPABASE_STORAGE_BUSINESS_MEDIA_BUCKET` for covers too.

## Upload storage

Current upload routes use Supabase Storage server-side:

- `/api/upload`
- `/api/uploads`
- `/api/admin/media/upload`

Required variables for uploads are `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and server-only `SUPABASE_SERVICE_ROLE_KEY`.
The active bucket is `SUPABASE_STORAGE_BUSINESS_MEDIA_BUCKET`, defaulting to public bucket `business-media`.

`BLOB_READ_WRITE_TOKEN` is not required for the current upload implementation.

`ALLOW_UNVERIFIED_PHONE_IN_DEV`
- Development bypass for phone verification. Do not enable in production.

`SMS_PROVIDER`
- Optional SMS provider switch.
- Set to `mock` for the demo flow.

`PHONE_TEST_CODE_ENABLED`
- Set to `true` with `SMS_PROVIDER=mock` when demo users should confirm phone by code `1111`.
- Set to `false` with `SMS_PROVIDER=mock` to hide SMS request and require Telegram contact confirmation.

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

## Cron and Polza AI quick setup

```env
CRON_SECRET="change_me_long_random_string_for_cron"
AI_PROVIDER="polza"
POLZA_AI_API_KEY=""
POLZA_CHAT_BASE_URL="https://polza.ai/api/v1/chat/completions"
POLZA_MEDIA_BASE_URL="https://polza.ai/api/v1/media"
POLZA_BASE_URL="https://polza.ai/api/v1"
POLZA_TEXT_MODEL="z-ai/glm-4.7-flash"
POLZA_VISION_MODEL="google/gemini-3.1-flash-image-preview"
AI_MAX_OUTPUT_TOKENS="1200"
AI_TEMPERATURE="0.3"
SMS_PROVIDER="mock"
PHONE_TEST_CODE_ENABLED="true"
```

## Production URL rules

- Production Telegram Mini App URL must be HTTPS.
- Do not use ngrok, localhost or 127.0.0.1 in production.
- Keep `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WEBAPP_URL` and `TELEGRAM_WEBHOOK_URL` consistent.
