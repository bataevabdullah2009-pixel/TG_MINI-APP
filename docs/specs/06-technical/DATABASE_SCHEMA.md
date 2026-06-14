# Database Schema Specification

## 1. Source of truth

`prisma/schema.prisma` is authoritative. This document explains intent and must
be updated when domain meaning changes.

## 2. Identity and access

### User

Global platform identity. Stores optional credentials, Telegram identity,
role, active state, linked business and last business context.

### SellerInvite

Short-lived code for linking a seller to a business and role.

### PhoneVerification

Verification attempt with hashed code/status/provider/expiry. Telegram contact
may update User/Customer without using SMS records.

## 3. Tenant core

### Business

Tenant root: slug, type, template, branding, contacts, Telegram settings,
commercial access, AI settings, payment settings and active/open/demo state.

### BusinessSettings

Operational capabilities: delivery, pickup, booking, reviews, loyalty,
minimums, fees, timeouts and reminders.

### BusinessTemplate and SubscriptionPlan

Template metadata and commercial plan configuration.

## 4. Catalog

### Category

Business-scoped category with active flag and sort order.

### Item

Business-scoped product/service with price, image, duration, stock mode,
availability, popular flag and archive timestamp.

## 5. People

### Customer

Relationship between Telegram/User identity and a business. Stores contact,
verification, block state and aggregate counters.

### Staff, WorkingHours, StaffSchedule

Service staff and schedules. Current slot generation does not yet consume the
full scheduling model consistently.

### Courier

Business-scoped courier linked optionally to User and Telegram id.

## 6. Commerce

### Order

Business/customer, contacts, idempotency, monetary snapshots, status, delivery,
payment proof/review, comments, expiration and stock restoration.

### OrderItem

Immutable snapshot of item name, price and quantity with optional Item link.

### OrderAttempt

Checkout attempt audit/rate-limit support without becoming user-facing error
storage.

### PromoCode

Business-scoped percentage discount with schedule, usage count/limit and archive.

### Payment

Separate payment record for provider, amount and status. Order also retains
current payment fields for production compatibility.

## 7. Delivery

### DeliveryZone

Business zone, fee, minimum, estimate, activity and archive.

### DeliveryAssignment

One assignment per order, courier, delivery status and timing fields.

## 8. Booking

### Booking

Business/customer, optional service/staff, contacts, time interval, status,
comments, expiration and reminder state.

## 9. Personalization

### FavoriteBusiness and FavoriteItem

Telegram/customer-scoped favorite records with uniqueness constraints.

## 10. Notifications and AI

### Notification

Queued/sent business notification record.

### AIUsageLog and AiRequestLog

Usage/cost and request/result audit scoped to business.

### AICache

Business/feature/prompt cache.

### MarketingPost and MediaAsset

AI/content drafts and uploaded media metadata.

### TelegramChatContext

Selected business and last product query for Telegram assistant.

## 11. Required invariants

- Unique business slug.
- Unique Telegram User.
- Customer unique by business + Telegram user.
- Item/category/order queries scoped by business.
- One delivery assignment per order.
- Promo code unique within business.
- Idempotency unique in its defined checkout scope.
- Archived records retained.
- BigInt serialized safely.

## 12. Change procedure

1. Update Prisma.
2. Add `docs/manual-*.sql` with safe DDL/backfill.
3. Update this document and affected specs.
4. Validate and generate Prisma.
5. Apply patch to intended environment only.
6. Verify code paths before enabling the field.
