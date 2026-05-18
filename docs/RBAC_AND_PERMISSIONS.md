# RBAC AND PERMISSIONS

Роли Prisma:
- `SUPER_ADMIN` - видит SaaS-уровень;
- `BUSINESS_OWNER` - видит только свой бизнес;
- `MANAGER` - операционные разделы своего бизнеса;
- `CUSTOMER` - публичный Mini App.

MVP авторизация админки хранит `adminUser` и `accessToken` в cookie/localStorage. API-фильтры должны принимать `businessId` для seller scope. Super Admin может запрашивать глобальные данные.
