# Authentication and Phone Verification Specification

## 1. Цель

Vitrina AI использует Telegram identity для персональных функций и role
resolution. Телефон подтверждается отдельно, потому что Telegram user id не
доказывает владение введённым номером.

## 2. Telegram identity

Основные данные:

- Telegram user id;
- first name;
- last name;
- username;
- language code, если доступен.

Production backend проверяет подпись initData. `initDataUnsafe` может помогать
интерфейсу, но не является достаточным серверным доказательством.

## 3. Создание пользователя

- Первый подтверждённый вход создаёт или обновляет глобального User.
- Роль по умолчанию - `CUSTOMER`.
- Имя и username синхронизируются безопасно.
- Business context может создать или связать Customer конкретного бизнеса.
- Повторный вход не создаёт дубликат Telegram-пользователя.

## 4. Определение роли

Приоритет:

1. подтверждённый Super Admin id или роль;
2. сохранённая роль User;
3. `CUSTOMER`.

Неактивный administrative user не получает admin access. Courier использует
отдельный courier access flow.

## 5. Подтверждение телефона

Основной production-путь:

1. клиент запускает подтверждение;
2. Telegram отправляет contact;
3. contact принадлежит тому же Telegram user;
4. номер нормализуется;
5. User и Customer получают подтверждённый номер;
6. checkout/booking повторно читает подтверждение с сервера.

## 6. Ручной ввод

Ручной ввод номера не делает его подтверждённым. Он может использоваться как
предварительное значение, но операция, требующая verification, не должна
считать его достаточным.

## 7. SMS

`PARTIAL`: интерфейс provider подготовлен, mock provider используется для
разработки. Реальный SMS flow считается production-функцией только после
подключения провайдера, rate limit, срока жизни кода и защиты от перебора.

## 8. Checkout и booking

- Номер из формы нормализуется.
- Он должен совпадать с подтверждённым номером.
- Несовпадение возвращает понятную ошибку.
- Блокировка клиента проверяется после установления identity.
- Нельзя доверять telegramUserId из request body вместо сессии.

## 9. Browser development mode

Mock login разрешён только вне production или при явном development flag.
Он не должен создавать путь обхода production initData validation.

## 10. Ошибки

- Ошибка профиля не обязана блокировать публичный marketplace.
- Персональные действия показывают причину недоступности.
- Raw signature, initData, token и секрет не логируются целиком.
- Schema drift не показывается пользователю.
