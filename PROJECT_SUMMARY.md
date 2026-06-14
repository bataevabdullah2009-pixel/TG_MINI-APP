# Vitrina AI Project Summary

## Product

Vitrina AI is a Telegram marketplace for independent local businesses. It
supports product ordering, service booking, seller operations, managers,
couriers, SaaS administration and AI assistance.

## Current capabilities

- global marketplace and business storefronts;
- products, services, categories, search and favorites;
- cart, checkout, stock, promo codes and order history;
- cash and manually reviewed bank transfer;
- delivery zones, courier assignment and courier workspace;
- basic service booking and status management;
- customer, owner, manager, courier and Super Admin roles;
- Telegram notifications and deterministic customer assistant;
- seller AI content tools;
- Supabase Postgres/Storage, Prisma and Vercel deployment.

## Known partial areas

- scheduling uses a basic slot model;
- full module enforcement is incomplete;
- reviews and calculated ratings are planned;
- automated payment/refund integrations are planned;
- legacy admin auth coexists with Telegram auth;
- platform settings are not a complete control plane.

The authoritative status is
[PRODUCT_SCOPE_AND_STATUS.md](docs/specs/00-global/PRODUCT_SCOPE_AND_STATUS.md).

## Repository

- `src/app` - pages and APIs.
- `src/components` - role and storefront UI.
- `src/lib` - services and integrations.
- `prisma/schema.prisma` - database source of truth.
- `docs/specs` - canonical specifications.
- `docs/manual-*.sql` - production schema patches.
- `scripts` - diagnostics, webhook and smoke tools.

## Rules

Read [AGENTS.md](AGENTS.md) and [docs/PROJECT_RULES.md](docs/PROJECT_RULES.md)
before implementation work.
