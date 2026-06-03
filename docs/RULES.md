# Vitrina AI Engineering Rules

- Do not hardcode production URLs.
- Do not use ngrok in production.
- Do not use localhost or 127.0.0.1 in production Telegram buttons or webhooks.
- All production URLs must come from environment variables.
- Prisma schema is the source of truth for database shape.
- Run `npm run build`, `npm run lint`, and `npm run typecheck` before deploy.
- `/app` is always the global catalog.
- `/app/[slug]` is always a single business page.
