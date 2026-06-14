# QA Checklist

Подробный сценарий:
[MANUAL_QA_CHECKLIST.md](MANUAL_QA_CHECKLIST.md).

## Client

- Marketplace -> storefront -> cart -> checkout.
- Pickup и delivery zone.
- Promo code и transfer proof.
- Double click не создаёт дубль.
- История, уведомления и отзыв после завершения.

## Seller

- CRUD без physical delete, цена, availability и stock.
- Ручная проверка чека.
- Статусы заказа, курьер и аналитика.
- Read-only отзывы.

## Courier

- Доступные и назначенные доставки.
- Принять -> забрал -> в пути -> доставлено.
- Адрес, телефон, сумма, оплата и зона.

## Super Admin

- Бизнесы, доступ, seller context и системные статусы.
- Скрытие и публикация отзывов.

## Release

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npx prisma validate`
- `npx prisma generate`
