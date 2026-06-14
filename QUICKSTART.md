# Quick Start

## Requirements

- Node.js compatible with the current Next.js version.
- npm.
- PostgreSQL/Supabase connection for database-backed flows.

## Setup

```powershell
npm install
Copy-Item .env.example .env
npx prisma generate
npx prisma validate
npm run dev
```

Open:

- `http://localhost:3000/app` - marketplace.
- `http://localhost:3000/app/<business-slug>` - business storefront.
- `http://localhost:3000/admin/login` - browser admin login.

## Important

- Check `DATABASE_URL` and `DIRECT_URL` before any database command.
- Do not run production reset or destructive SQL.
- Mock role login is development-only.
- Local URLs are allowed for local development, never for production Telegram
  buttons or webhook configuration.
- Demo seed is optional; review [seed runbook](docs/runbooks/seed-demo-data.md).

## Verification

```powershell
npm run lint
npm run typecheck
npm run build
npx prisma validate
npx prisma generate
```

See [docs/ENV.md](docs/ENV.md) and
[docs/release/DEPLOYMENT.md](docs/release/DEPLOYMENT.md) for production.
