# Restore demo businesses

Demo data is restored through the Prisma seed script. The seed is scoped to demo slugs only and must not be used as a production database reset.

## Command

```bash
npm run db:seed
```

The script restores these demo Mini Apps:

- `demo-cafe`
- `demo-barber`
- `demo-shop`
- `demo-grocery`
- `demo-carwash`
- `demo-hozmag`

Each demo business gets active categories and template items/services. Real user businesses are not deleted by this command.

## Before running in Supabase production

1. Confirm `DATABASE_URL` and `DIRECT_URL` point to the intended Supabase database.
2. Apply required manual schema patches from `docs/manual-supabase-patch.sql` and `docs/manual-supabase-hotfix-business-is-demo.sql` if they have not been applied.
3. Run `npx prisma validate`.
4. Run `npm run db:seed`.

Do not run `prisma migrate reset`, `prisma db push --force-reset`, or any `DROP TABLE` command for MVP stabilization.
