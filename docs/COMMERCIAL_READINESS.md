# Commercial Readiness

Дата аудита: 14 июня 2026 года.

## Решение

`CONDITIONAL / NOT READY FOR UNSUPERVISED LAUNCH`.

Кодовая база близка к пилоту первого продавца, но коммерческий запуск нельзя
считать завершённым до применения SQL-патча отзывов и ручного production QA
внутри Telegram.

## Подтверждено кодом

- checkout защищён idempotency key;
- заказы продавца имеют pagination;
- каталог имеет limit и pagination;
- query cache отменяет устаревшие клиентские запросы;
- AI Agent читает БД и не выполняет финансовые решения;
- проверка перевода выполняется продавцом;
- отзывы защищены ownership, завершённым статусом, рейтингом 1-5 и unique source;
- скрытые отзывы исключаются из публичного рейтинга;
- production URL helper блокирует localhost, ngrok и preview origin.

## Performance

- Marketplace rating загружается одним group query, без N+1.
- Storefront и история используют query keys, TTL cache и AbortController.
- Super Admin не загружает stats/businesses на независимых вкладках.
- Seller dashboard пока загружает business, categories, items, orders и bookings
  при старте; дальнейшая ленивая загрузка вынесена в roadmap из-за риска
  регрессии dashboard-метрик.

## Обязательные блокеры

- применить `docs/manual-add-business-reviews.sql`;
- проверить production Telegram webhook и Mini App links;
- пройти клиентский, seller, courier и Super Admin сценарии;
- проверить реальные уведомления и загрузку чека;
- подтвердить backup/monitoring перед коммерческим трафиком.

## Проверки репозитория

- `npm run typecheck`: пройдено.
- `npx prisma generate`: пройдено.
- `npm run build`: пройдено.
- `npx prisma validate`: пройдено.
- `npm run lint`: пройдено с существующими warning по hook dependencies и
  `<img>`; lint errors отсутствуют.
- Runtime versions: `next@15.5.18`, `react@19.2.6`, `react-dom@19.2.6`.

## Остаточный риск

- Автоматизированного end-to-end теста внутри Telegram WebView нет.
- SQL-патч Review не применялся этой задачей, чтобы не изменять production БД
  без отдельного deployment шага.
- Legacy lint warnings и Tailwind warnings не блокируют build, но должны
  разбираться отдельными scoped-задачами.
