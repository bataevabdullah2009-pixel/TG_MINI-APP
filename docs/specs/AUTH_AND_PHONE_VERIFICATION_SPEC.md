# AUTH AND PHONE VERIFICATION SPEC

MVP авторизации клиента:
- Telegram `initDataUnsafe.user.id`;
- `username`;
- `firstName`;
- `lastName`.

Телефон:
- ручной ввод в checkout/booking;
- `phoneVerified=false` для ручного ввода;
- будущий Telegram contact request через bot keyboard;
- будущий SMS слой: `SmsProviderInterface` и `MockSmsProvider`.
