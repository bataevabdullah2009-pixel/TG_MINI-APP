# Vitrina AI Global Spec

Vitrina AI is a multi-business Telegram Mini App platform for catalog browsing, orders, bookings, seller operations, and SaaS administration.

## Roles

- buyer: opens `/app`, searches the catalog, opens `/app/[slug]`, places orders, books services, manages profile and favorites.
- seller: manages one business, catalog, orders, bookings, content, media, and AI marketing tools.
- manager: handles assigned operational work for a business, mainly orders and bookings.
- super_admin: manages the SaaS platform, businesses, templates, onboarding, and global settings.

## Core Scenarios

- Telegram `/start` opens the global Vitrina AI catalog at `/app`.
- Buyers choose a business from the catalog and then navigate to `/app/[slug]`.
- Sellers and managers use authenticated admin and Mini App workspaces.
- Super admins manage businesses and templates through `/admin/super`.

## Telegram Mini App Architecture

- Public Mini App entry: `/app`.
- Business Mini App page: `/app/[slug]`.
- Bot webhook: `/api/telegram/webhook`.
- Webhook and Mini App URLs are derived from environment variables, never from ngrok, localhost, or request origin in production.
