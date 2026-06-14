# Project Codex (кодекс разработчика)

This document contains the primary development rules, safety standards, and coding practices of the project.

## 1. Operating Rules
- **No full rewrites**: Build incrementally upon the existing codebase.
- **Read specs first**: Use `docs/specs/README.md` and the canonical spec for the task.
- **Maintain Telegram mini-app features**: The `/start` bot flow, marketplace, business storefronts, super admin, seller and courier panels must not be broken.
- **Russian language**: Use Russian for user-facing texts.
- **Routing rules**: Store customer routes under `/app` and `/app/[businessSlug]`. Select themes based on `Business.templateKey`.

## 2. Database Rules
- **Prisma schema**: `prisma/schema.prisma` is the database source of truth.
- **Manual SQL Patches**: Any production schema changes require a manual SQL patch in `docs/manual-*.sql`. These scripts must be safe and idempotent.
- **Production Data Protection**: Never delete production data or reset the database.
- **Prisma P2022 handling**: Hide raw Prisma errors from users and degrade gracefully when optional fields are missing.

## 3. Environment Security
- Do not expose real secrets in documentation, logs, or repository commits.
- Keep `.env.example` and `docs/ENV.md` synchronized if new environment variables are added.
- Never hardcode production URLs (e.g. ngrok, localhost) in production configs.

## 4. Verification Codex
Before submitting code or deploying, run the following validation pipeline:
```bash
npm run lint
npm run typecheck
npm run build
npx prisma validate
npx prisma generate
```
