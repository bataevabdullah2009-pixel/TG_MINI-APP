# Architecture

## 1. Repository layers

- `src/app` - pages, layouts and route handlers.
- `src/components` - customer, storefront, seller and courier UI.
- `src/lib` - auth, AI, Telegram, delivery, customer, notification and shared
  services.
- `src/store` - client state such as cart.
- `prisma` - schema and seed.
- `scripts` - diagnostics, webhook and smoke tools.
- `docs` - specifications, runbooks, SQL patches, release and QA material.

## 2. Canonical product routes

- `/app` - marketplace and role-aware Mini App shell.
- `/app/[businessSlug]` - primary business storefront.
- `/courier` and `/courier/orders` - courier workspace.
- `/admin` - browser admin area.
- `/admin/super` - browser SaaS area.
- `/api/telegram/webhook` - Telegram updates.
- `/api/health` and `/api/health/db` - health probes.

Legacy `(miniapp)/[slug]` routes remain in the repository. They are not removed
or renamed without a dedicated migration.

## 3. UI composition

`/app`:

- resolves Telegram session;
- loads marketplace independently;
- routes Courier to courier workspace;
- allows authorized role workspace switching;
- keeps customer catalog available when profile loading fails.

`/app/[businessSlug]`:

- loads one business catalog;
- chooses cart or booking experience from template;
- manages favorites, cart, verification, checkout and booking;
- paginates catalog results.

Seller:

- receives explicit business id;
- loads business, catalog and operational queues;
- lazy-loads secondary data;
- delegates delivery/courier/promo/media modules.

## 4. Service boundaries

- `auth-telegram` - Telegram identity and role resolution.
- `admin-auth` - privileged session and tenant scope.
- `courier-auth` - courier access.
- `customer-service` - global/business customer records.
- `delivery-service` - claims and expired assignments.
- `notification-service` - Telegram event delivery.
- `orders/order-stock` - stock restore.
- `ai/telegram-marketplace-agent` - deterministic customer assistant.
- `production-url` - safe app, business, seller, courier and webhook URLs.

## 5. Data flow

Public read:

`Client -> public route -> Prisma select -> safe response -> UI cache`.

Privileged mutation:

`Client -> session verification -> role/scope -> validation -> transaction -> notification`.

Telegram message:

`Telegram -> webhook secret/update -> command/context -> deterministic tools ->
response -> Bot API`.

## 6. Protected boundaries

- Checkout transaction.
- Seller order visibility.
- Telegram production routing.
- Payment proof privacy.
- Cross-tenant isolation.
- Stock restoration.
- Courier concurrency.

Changes near these boundaries require broader tests and must not be bundled with
unrelated refactoring.

## 7. Deployment

Vercel runs Next.js and route handlers. Supabase hosts Postgres and Storage.
Production routing is derived from environment variables and validated against
unsafe hosts.
