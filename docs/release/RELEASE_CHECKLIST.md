# RELEASE CHECKLIST

Перед релизом:
- `npm.cmd run db:push`;
- `npm.cmd run db:seed`;
- `npm.cmd run type-check`;
- `npm.cmd run build`;
- проверить `/app`;
- проверить `/app/demo-cafe`;
- проверить `/app/demo-barber`;
- проверить `/app/demo-carwash`;
- проверить `/app/demo-hozmag`;
- проверить `/admin/orders`;
- проверить `/admin/bookings`;
- проверить `/admin/ai`;
- проверить Telegram `/start`;
- проверить `TELEGRAM_SUPER_ADMIN_IDS`;
- убедиться, что в коде нет `your_bot_here` и hardcoded demo-cafe fallback.
