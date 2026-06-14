# Start Here

Vitrina AI is a multi-business Telegram Mini App marketplace. Customers choose
an independent seller, open that seller's catalog, place an order or book a
service, and receive updates in Telegram. Owners, managers, couriers and Super
Admins use role-specific workspaces.

## First reading

1. [Specification index](docs/specs/README.md)
2. [Global product specification](docs/specs/00-global/GLOBAL_PRODUCT_SPEC.md)
3. [Current product status](docs/specs/00-global/PRODUCT_SCOPE_AND_STATUS.md)
4. [Project rules](docs/PROJECT_RULES.md)
5. [Architecture](docs/specs/06-technical/ARCHITECTURE.md)
6. [Environment reference](docs/ENV.md)

## Protected behavior

- `/app` is the global marketplace.
- `/app/[businessSlug]` is a single business storefront.
- Checkout and seller order visibility must not regress.
- Telegram production URLs never use localhost, 127.0.0.1 or ngrok.
- Business data is tenant-isolated.
- Production data is not reset or physically deleted during hotfixes.

## Local setup

See [QUICKSTART.md](QUICKSTART.md). Do not run `db:push`, seed or SQL against a
database until both connection URLs have been checked.

## Before changing code

Follow `SPEC -> PLAN -> CODE -> VERIFY`. Find the canonical spec, confirm whether
the capability is implemented, partial or planned, and keep the task scoped.
