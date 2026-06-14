# Restore Demo Businesses

Demo data is restored through the Prisma seed script. The seed is scoped to
known demo slugs and must never be used as a production database reset.

## Command

```bash
npm run db:seed
```

Expected demo slugs are defined by the current seed implementation. Verify the
script before production use; historical names in old documentation are not a
source of truth.

## Before running

1. Confirm `DATABASE_URL` and `DIRECT_URL` target the intended environment.
2. Review the seed for destructive operations.
3. Apply required safe `docs/manual-*.sql` patches.
4. Run `npx prisma validate`.
5. Run `npx prisma generate`.
6. Run the seed only when demo data is intentionally required.

Never run `prisma migrate reset`, `prisma db push --force-reset`, `DROP TABLE`
or a broad delete against production.
