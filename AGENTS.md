# AI Agent Rules

Work in the order SPEC -> PLAN -> CODE.

## Operating rules

- Start with analysis and an audit of relevant files.
- Make a short implementation plan before broad changes.
- Prefer existing architecture and local helpers.
- Do not change architecture without a clear reason.
- Do not delete working features while fixing one issue.
- Do not change visual design unless the task explicitly asks for design work.
- Do not change Mini App routes unless the task explicitly requires it.
- Stabilization comes before new features.

## Protected production behavior

- The working Telegram Mini App must not be broken.
- Checkout/order flow is protected.
- Seller order visibility is protected.
- Telegram bot production routing is protected.
- Never return ngrok, localhost or 127.0.0.1 to production Telegram URLs.
- Never hardcode production URLs in code.

## Environment rules

- Always check environment variables and routes when touching Telegram, webhook or deployment code.
- Do not rename env variables without updating documentation.
- Do not add new required env variables without updating `.env.example` and `docs/ENV.md`.
- Do not expose real secrets in docs, logs or commits.

## Database rules

- Do not delete production data.
- Do not reset production database.
- Do not use `DROP TABLE` for production hotfixes.
- All production DB changes must be represented in `prisma/schema.prisma`.
- Every new Prisma field must have a manual SQL patch in `docs/manual-*.sql`.
- Prefer safe SQL: `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, targeted backfills.
- Prisma missing-column errors such as `P2022` must not be shown to users as raw text.

## Verification rules

Before deploy or handoff, run when possible:

```bash
npm run lint
npm run typecheck
npm run build
npx prisma validate
npx prisma generate
```

If a check cannot run because env or local services are unavailable, document the reason.

## Git rules

- Keep commits scoped to the task.
- Do not include unrelated worktree or submodule changes.
- Do not commit generated build artifacts unless intentionally required.
- Use conventional commit messages.
