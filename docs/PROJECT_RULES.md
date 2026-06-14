# Project Rules

## Specification rules

- Canonical specifications live under `docs/specs/`.
- Start with `docs/specs/README.md`.
- Global product intent and current implementation status must be checked before code changes.
- Roadmaps and historical reports do not define current behavior.
- Update affected specifications and acceptance criteria when behavior changes.

## Development rules

- Keep the working Telegram Mini App stable.
- Do not change existing routes unless a task explicitly requires it.
- Do not change visual design during backend/docs/hotfix tasks.
- Prefer existing architecture and local helpers.
- Avoid broad refactoring without a clear product or technical reason.
- Stabilization comes before new features.
- Do not hardcode production URLs.
- Do not return ngrok to production config.
- Do not expose secrets in code, docs, logs or screenshots.

## Database rules

- Source of truth is `prisma/schema.prisma`.
- Every new production Prisma field must have a manual SQL patch in `docs/manual-*.sql`.
- SQL patches must be safe and idempotent where possible.
- Never delete production data as part of a hotfix.
- Never run production database reset.
- Never use `DROP TABLE` for production hotfixes.
- Prefer additive changes: `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
- For schema drift, handle Prisma `P2022` and missing-column errors gracefully.

## Error handling rules

- Raw Prisma errors must not be shown to users.
- Server logs may contain technical error details.
- UI/API responses should use normal messages or safe empty states.
- Client catalog, favorites, orders and seller panel must degrade gracefully when optional data is unavailable.

## Commit rules

- Use concise conventional commit style:
  - `fix: ...`
  - `docs: ...`
  - `feat: ...`
  - `chore: ...`
- Keep commits scoped to the task.
- Do not include unrelated generated files.
- Do not include unrelated submodule/worktree changes.
- Mention manual SQL patches in PR/commit notes when relevant.

## Release rules

Before deploy, run when possible:

```bash
npm run lint
npm run typecheck
npm run build
npx prisma validate
npx prisma generate
```

Before Telegram production release:
- Check `NEXT_PUBLIC_APP_URL`.
- Check `NEXT_PUBLIC_WEBAPP_URL`.
- Check `TELEGRAM_WEBHOOK_URL`.
- Check BotFather Mini App URL.
- Check webhook info through Telegram API.

## Product rules

- MVP goal is a reliable customer order flow and seller order management.
- Checkout/order flow is protected: do not touch it during unrelated work.
- Seller panel is protected: do not break order visibility.
- Super Admin is allowed to be less polished than customer flow, but must not expose raw errors.
- Future brand options can be documented, but do not rename project in code until a dedicated rename task.
