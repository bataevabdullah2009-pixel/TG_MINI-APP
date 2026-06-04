# ACCEPTANCE CRITERIA

Готово для MVP, если:
- `/app` открывает каталог активных бизнесов;
- `/start` открывает `/app`;
- `/start demo-cafe` открывает `/app/demo-cafe`;
- `/app/[businessSlug]` не fallback-ит на cafe при неизвестном slug;
- неизвестный slug показывает `Бизнес не найден`;
- `templateKey` выбирает правильный cart или booking UI;
- кнопка `Добавить` кладёт товар в корзину;
- заказ сохраняется через `/api/businesses/[slug]/orders`;
- запись сохраняется через `/api/businesses/[slug]/bookings`;
- продавец получает Telegram-уведомления;
- клиент получает Telegram-уведомления при смене статуса, если есть Telegram id;
- `/admin/ai` генерирует, модерирует и сохраняет черновики;
- UI-тексты на русском.
