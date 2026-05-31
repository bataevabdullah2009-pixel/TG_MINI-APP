# SmartBiz AI Feature Spec

## Catalog

`/app` shows the global SmartBiz AI catalog with search, category filters, favorites, profile, and buyer history.

## Business Page

`/app/[slug]` shows a single active business by slug. Missing or inactive slugs return a friendly "business not found" screen and link back to `/app`.

## Cart

Product businesses support cart quantity changes and checkout.

## Orders

Orders are created from a business page and notify the business owner through Telegram when chat settings are present.

## Booking

Service businesses expose date, staff, slot, and booking flows.

## Profile

Telegram users can manage profile and contact state inside the Mini App.

## Seller Panel

Sellers manage catalog, orders, bookings, media, customers, and settings.

## SaaS Panel

Super admins manage businesses, templates, onboarding, and platform-level stats.

## AI Marketing

AI tools generate and moderate seller content through configured providers such as OpenRouter.
