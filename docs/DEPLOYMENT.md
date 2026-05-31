# DEPLOYMENT

## Required Environment

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_SUPER_ADMIN_IDS`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `ENCRYPTION_SECRET`

## Supabase Storage

Create public buckets or let the API create them with the service role key:
- `business-media`
- `product-images`
- `business-covers`

Vercel production must not rely on files written to `public/uploads`; the filesystem is ephemeral there.

## Release Checks

Run:
- `npx prisma validate`
- `npx prisma generate`
- `npm run type-check`
- `npm run build`
