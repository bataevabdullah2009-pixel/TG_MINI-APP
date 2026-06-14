# Technical Specification

## 1. Stack

- Next.js 15 App Router.
- React 19 and TypeScript.
- Tailwind CSS and lucide-react.
- Next.js route handlers.
- Prisma 6 with PostgreSQL.
- Supabase Postgres and Supabase Storage.
- Telegram WebApp SDK and Bot API.
- Vercel production deployment.
- AI provider abstraction for Polza, OpenRouter and mock.

## 2. Runtime surfaces

Primary surfaces:

- public landing and legacy pages;
- global Mini App shell;
- business storefront;
- seller/manager/Super Admin workspaces;
- courier workspace;
- browser admin pages;
- public, customer, admin, courier, seller, super and Telegram APIs;
- cron expiration endpoint.

Canonical product routes are listed in `ARCHITECTURE.md`. Existing routes are
protected and are not renamed by documentation cleanup.

## 3. Environment contracts

Required production categories:

- database pooled and direct URLs;
- Supabase public and service credentials;
- Telegram bot token, username, webhook URL and optional secret;
- production app and Mini App URLs;
- JWT/encryption/cron secrets;
- AI provider and keys;
- storage bucket configuration.

Rules:

- no real secrets in repository or logs;
- production Telegram URLs use deployed HTTPS;
- no localhost, 127.0.0.1, ngrok or preview origin;
- new required env updates `.env.example` and `docs/ENV.md`;
- env names are not renamed without migration documentation.

## 4. Authentication

- Customer identity: verified Telegram initData.
- Admin identity: Telegram admin session or existing cookie/token flow.
- Courier identity: Telegram session plus Courier relation.
- Every privileged API verifies role and business scope.
- Request business id narrows scope but does not grant it.
- Development mock auth is disabled in production.

## 5. Multi-tenancy

- `Business` is the tenant root.
- Business-owned queries include `businessId`.
- Super Admin mutations use explicit tenant context.
- Customer operations verify Telegram ownership.
- Courier operations verify courier profile, business and assignment.
- Cross-tenant fallback is prohibited.

## 6. API response rules

- Success responses use JSON-safe values; BigInt is converted.
- User errors use stable status and Russian message.
- Internal Prisma errors are logged server-side.
- Missing-column/table drift may use a safe compatibility read, but must not
  weaken checkout or access control.
- Public cache headers are used only for public data.
- Privileged data is not publicly cached.

## 7. Data mutations

- Checkout uses transaction and idempotency.
- Stock and promo usage update atomically with order creation.
- Cancellation restores stock at most once.
- Payment review is compare-and-set/idempotent.
- Courier claim is concurrency-safe.
- Archive is preferred over physical delete.
- Critical history is retained.

## 8. Storage

- Business media, product images, covers and payment proofs use separate
  configured buckets.
- Service role credentials stay server-side.
- MIME/type/size are validated.
- URL ownership is checked before use.
- Deleting a display asset does not delete order history.

## 9. AI

- Provider selected by configuration and business settings.
- Deterministic data is loaded before generative response.
- Limits and logs are business-scoped.
- Cache keys include business and feature.
- AI failure falls back safely and does not block core commerce.

## 10. Performance

- Marketplace does not preload all business catalogs.
- Catalog, orders, history, customers and logs are paginated/limited.
- Prisma `select` avoids large relations.
- Independent reads use parallel execution where safe.
- UI uses local loading states.
- Public catalog caching must not cache personalized data.

## 11. Schema changes

- Prisma schema is source of truth.
- Every production field has safe manual SQL.
- Patches are additive and idempotent where possible.
- No production reset or destructive hotfix.
- Generated Prisma Client is refreshed.

## 12. Required verification

```bash
npm run lint
npm run typecheck
npm run build
npx prisma validate
npx prisma generate
```

Operationally also verify env diagnostics, database health, Telegram webhook and
protected smoke flows when relevant.
