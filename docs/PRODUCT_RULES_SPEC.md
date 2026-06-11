# Product Rules Specification

Этот файл является коротким индексом правил товара.

Нормативные документы:

- `PRODUCT_STOCK_SPEC.md` - `stock`, `isAvailable`, checkout и snapshot.
- `SELLER_PRODUCT_MANAGEMENT_SPEC.md` - seller UI, цена, архивирование.
- `ORDER_FLOW_SPEC.md` - создание заказа и неизменность старых заказов.

Ключевой инвариант: `stock = null` отключает количественный учёт, `stock = 0` показывает `Нет в наличии`, `isAvailable = false` скрывает позицию, а удаление из seller UI всегда архивирует.
