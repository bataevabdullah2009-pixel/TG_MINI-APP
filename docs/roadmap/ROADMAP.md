# Roadmap

## MVP

- Каталог, storefront, checkout, заказы, запись, доставка и роли.
- Ручная проверка перевода без AI-анализа чека.
- Детерминированный Telegram AI Agent по данным БД.
- Отзывы по завершённым операциям и базовая модерация.
- Защита idempotency, stock и tenant scope.

## First Seller Pilot

- Применить все manual SQL patches в production.
- Пройти полный Telegram WebView QA для клиента, продавца и курьера.
- Проверить реальные реквизиты, зоны, уведомления и webhook.
- Выполнить пробный наличный заказ и пробный перевод с ручной проверкой.
- Настроить мониторинг ошибок Vercel/Supabase/Telegram.
- Отдельно оптимизировать стартовую загрузку seller dashboard после
  регрессионного теста метрик.

## Commercial Beta

- Автоматические smoke tests критических API и Telegram flows.
- Audit log действий продавца и Super Admin.
- Усиление permission policy для manager и booking transitions.
- Расширенная аналитика и экспорт.
- Billing/subscription lifecycle и тарифные ограничения.
- Self-service onboarding и импорт каталога.

## Public Launch

- SLA, резервное копирование, alerting и incident runbooks.
- Несколько филиалов и масштабирование tenant model.
- Реальные online payments и webhook reconciliation.
- Loyalty и публичные ответы продавца на отзывы.
- Политика модерации, support process и юридические документы.
