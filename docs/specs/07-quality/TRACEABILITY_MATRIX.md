# Specification Traceability Matrix

| Product area | Canonical spec | Primary implementation |
| --- | --- | --- |
| Global product | `00-global/GLOBAL_PRODUCT_SPEC.md` | Whole product |
| Feature status | `00-global/PRODUCT_SCOPE_AND_STATUS.md` | Current repository audit |
| Roles and permissions | `01-roles/*` | `prisma/schema.prisma`, auth helpers, role UI |
| Marketplace | `02-domains/MARKETPLACE_AND_STOREFRONT_SPEC.md` | `src/app/app/page.tsx`, marketplace API |
| Storefront | Same as above | `src/app/app/[businessSlug]/page.tsx`, catalog API |
| Catalog | `02-domains/CATALOG_AND_PRODUCT_SPEC.md` | admin items APIs, seller catalog UI |
| Stock | `02-domains/INVENTORY_AND_STOCK_SPEC.md` | order route, order-stock helper |
| Business lifecycle | `02-domains/BUSINESS_LIFECYCLE_SPEC.md` | super business access API |
| Order | `03-flows/ORDER_FLOW_SPEC.md` | orders API, checkout UI |
| Payment | `03-flows/PAYMENT_FLOW_SPEC.md` | proof upload, confirm/reject routes |
| Delivery | `03-flows/DELIVERY_FLOW_SPEC.md` | delivery service, courier/admin APIs |
| Booking | `03-flows/BOOKING_FLOW_SPEC.md` | bookings and slots APIs |
| Profile/history | `03-flows/FAVORITES_PROFILE_HISTORY_SPEC.md` | customer/favorites APIs and components |
| Notifications | `03-flows/NOTIFICATION_SPEC.md` | notification service |
| Customer AI | `04-ai/CUSTOMER_AI_ASSISTANT_SPEC.md` | Telegram marketplace agent |
| Seller AI | `04-ai/SELLER_AI_TOOLS_SPEC.md` | admin AI routes and components |
| Telegram | `06-technical/TELEGRAM_INTEGRATION_SPEC.md` | webhook, bot service, production URL |
| Database | `06-technical/DATABASE_SCHEMA.md` | `prisma/schema.prisma` |

## Change checklist

When an implementation file in the table changes, review its canonical spec.
When a spec changes expected behavior, update acceptance criteria and the status
matrix. A future feature is not marked implemented only because a schema enum or
placeholder UI exists.
