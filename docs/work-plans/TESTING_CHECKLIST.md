# Testing Checklist

Use this before handoff and before production deploy.

## Client checklist

- Open Telegram Mini App through bot button.
- Open `/app` directly on Vercel.
- Catalog loads without raw errors.
- Search works.
- Category filter works.
- Business card opens `/app/[businessSlug]`.
- Business page shows name, description, contacts, products/services.
- Product/service detail opens.
- Add item to cart.
- Change cart quantity.
- Checkout page opens.
- Telegram contact phone confirmation works.
- Order is created.
- User sees a normal success/error state.
- Favorites tab opens.
- Add/remove favorite business.
- Add/remove favorite item.
- Orders/history tab opens.
- Empty states are readable when no data exists.

## Seller checklist

- Seller can open Mini App in seller mode.
- Seller dashboard loads.
- Orders list loads.
- New test order appears.
- Seller can change order status.
- Bookings list loads.
- Seller can change booking status.
- Items list loads.
- Seller can create product/service.
- Seller can delete or hide product/service where supported.
- Media upload works with Supabase Storage.
- Business settings load.
- Business settings save.
- AI panel loads.
- AI generation works with mock provider or configured provider.

## Super Admin checklist

- Super Admin can open platform panel.
- Businesses list loads.
- Business creation/onboarding works.
- Business owner/telegram linking works.
- Demo businesses can be distinguished with `isDemo`.
- Production catalog does not expose demo businesses to regular users.
- Stats load or fail gracefully.
- No raw Prisma errors are shown in UI.

## Telegram bot checklist

- BotFather Mini App URL points to `https://production-domain/app`.
- `/start` opens Mini App button.
- `/start seller` opens seller mode when supported.
- Webhook URL is production Vercel URL.
- `npm run telegram:webhook:info` returns expected URL.
- No ngrok/localhost/127.0.0.1 in production webhook.
- New order notification reaches seller/admin chat when chat id is configured.
- Bot can handle unknown payload gracefully.

## Vercel/Supabase checklist

- Vercel env contains `DATABASE_URL` and `DIRECT_URL`.
- Vercel env contains Telegram vars.
- Vercel env contains Supabase vars.
- Supabase buckets exist.
- Manual SQL patches were applied.
- `npx prisma validate` passes.
- `npx prisma generate` passes.
- `npm run lint` passes or only known warnings remain.
- `npm run typecheck` passes.
- `npm run build` passes.
- `/api/health` responds.
- `/api/health/db` responds or returns a useful configured error.
- Vercel logs do not show repeated `P2022` missing-column errors.
