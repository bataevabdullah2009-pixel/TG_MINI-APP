---
name: telegram-miniapp-platform
description: Development, maintenance, and rules of the Vitrina AI Telegram Mini App Platform.
---

# Telegram Mini App Platform Skill

This skill contains the development, deployment, and operation guidelines for the Vitrina AI platform.

Read `docs/specs/README.md`, the global product spec and the current product
status before implementation work.

## Key Rules

1. **Keep Telegram Mini App Stable**: Do not break the core client application flow (catalog, favorites, ordering).
2. **Checkout / Order Flow Protection**: These routes and functions are critical and must not be touched during unrelated changes.
3. **Seller Panel Visibility**: The seller order status and visibility are protected.
4. **Environment Controls**: Always verify webhook setup and do not expose secrets.
5. **No Production Database Resets**: Schema migrations must be represented in `prisma/schema.prisma` and applied via safe, manual SQL patches in `docs/manual-*.sql`.
