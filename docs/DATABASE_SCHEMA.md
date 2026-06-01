# Database Schema

Source of truth: `prisma/schema.prisma`.

Database: Supabase Postgres.

## Core tables

`User`
- Platform user for admins, sellers, managers and Telegram-linked users.
- Important fields: `id`, `email`, `password`, `telegramId`, `username`, `role`, `businessId`, `isActive`.
- Relations: can belong to one business through `businessId`, can own many businesses through `ownedBusinesses`.

`Business`
- Tenant/business storefront.
- Important fields: `id`, `slug`, `name`, `type`, `templateKey`, `description`, `logoUrl`, `coverImageUrl`, colors, contacts, Telegram bot settings, subscription fields, AI settings, `isActive`, `isDemo`, `ownerId`.
- Relations: categories, items, customers, orders, bookings, staff, settings, favorites, media assets.
- `isDemo` is used to hide demo tenants from regular production catalog views.

`BusinessTemplate`
- Template metadata for business types.
- Important fields: `key`, `name`, `businessType`, `orderMode`, default categories/items/theme.

`SubscriptionPlan`
- Commercial plan configuration.
- Important fields: `name`, `price`, `features`, AI limits, business limits.

`BusinessSettings`
- Operational settings for a business.
- Important fields: delivery settings, order settings, booking settings, payment options.

`Category`
- Product/service category inside a business.
- Important fields: `businessId`, `name`, `sortOrder`, `isActive`.

`Item`
- Product or service.
- Important fields: `businessId`, `categoryId`, `type`, `name`, `description`, `price`, `imageUrl`, `durationMinutes`, `stock`, `isAvailable`, `isPopular`.
- `type=PRODUCT` is used for shopping/catalog.
- `type=SERVICE` is used for booking/service flows.

`Order`
- Customer order.
- Important fields: `businessId`, `customerId`, `customerName`, `customerPhone`, `customerAddress`, `totalPrice`, `status`, `deliveryType`, `comment`.
- Relations: business, customer, order items, payments.

`OrderItem`
- Snapshot of item in an order.
- Important fields: `orderId`, `itemId`, `name`, `price`, `quantity`.
- Keeps order readable even if item later changes.

`Booking`
- Service booking.
- Important fields: `businessId`, `customerId`, `serviceId`, `staffId`, `customerName`, `customerPhone`, `startTime`, `endTime`, `status`, `comment`.

`Customer`
- Customer profile scoped to a business or global profile.
- Important fields: `businessId`, `userId`, `telegramUserId`, `name`, `phone`, `phoneVerified`, `verificationMethod`, `totalOrders`, `totalSpent`.

`FavoriteBusiness`
- Favorite business relation for Telegram users/customers.
- Important fields: `businessId`, `telegramUserId`, `customerId`.
- Unique pair: `businessId + telegramUserId`.

`FavoriteItem`
- Favorite product/service relation.
- Important fields: `businessId`, `itemId`, `telegramUserId`, `customerId`.

`Staff`
- Staff member for service businesses.
- Important fields: `businessId`, `name`, `role`, `isActive`.

`WorkingHours`
- Business opening hours.
- Important fields: `businessId`, `dayOfWeek`, `openTime`, `closeTime`, `isClosed`.

`StaffSchedule`
- Staff availability override/schedule.
- Important fields: `staffId`, `dayOfWeek`, `startTime`, `endTime`, `isAvailable`.

`Payment`
- Payment records for orders or bookings.
- Important fields: `provider`, `status`, `amount`, `currency`, `orderId`, `customerId`.

`Notification`
- Notification delivery records.
- Important fields: `businessId`, `type`, `channel`, `recipient`, `sent`, `sentAt`.

`AIUsageLog`
- AI usage and cost tracking.
- Important fields: `businessId`, `feature`, `provider`, `model`, `inputTokens`, `outputTokens`, `estimatedCost`, `status`.

`AICache`
- AI response cache.
- Important fields: `businessId`, `feature`, `promptHash`, `response`, `provider`, `model`.

`MarketingPost`
- Draft/scheduled marketing content.
- Important fields: `businessId`, `title`, `content`, `status`, `scheduledAt`.

`MediaAsset`
- Uploaded media metadata.
- Important fields: `businessId`, `type`, `url`, `filename`, `mimeType`, `size`.

`PhoneVerification`
- Phone verification attempts.
- Important fields: `customerId`, `phone`, `code`, `expiresAt`, `verifiedAt`.

`SellerInvite`
- Seller onboarding/linking token.
- Important fields: `businessId`, `email`, `token`, `expiresAt`, `usedAt`.

`AiRequestLog`
- AI request audit log.
- Important fields: `businessId`, `provider`, `model`, `prompt`, `response`, `status`, `createdAt`.

## Key relationships

User to Business:
- `User.businessId` links a manager/seller to one active business.
- `Business.ownerId` links a business to an owner user.
- Super Admin is controlled through `User.role` and Telegram super admin ids.

Business to Product:
- `Business` has many `Category`.
- `Business` has many `Item`.
- `Item.categoryId` is optional to support uncategorized/default category flows.

Business to Order:
- `Business` has many `Order`.
- `Order` has many `OrderItem`.
- `Order.customerId` optionally links to `Customer`.

Business to Booking:
- `Business` has many `Booking`.
- `Booking.serviceId` links to an `Item` with service type.
- `Booking.staffId` optionally links to `Staff`.

Customer/Favorites:
- `Customer` can be scoped to a business or global.
- `FavoriteBusiness` stores Telegram user favorites for businesses.
- `FavoriteItem` stores Telegram user favorites for items.

## Schema change rule

Every new Prisma field that is needed in production must include:
- A change in `prisma/schema.prisma`.
- A safe manual SQL patch in `docs/manual-*.sql`.
- No data deletion.
- No production reset.
