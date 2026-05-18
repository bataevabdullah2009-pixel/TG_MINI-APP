# 📱 Telegram Mini App Setup

## Создание Mini App в Telegram

### Шаг 1: Создайте бота через @BotFather

1. Откройте @BotFather в Telegram
2. Команда: `/newbot`
3. Введите имя и username бота

Получите token вроде: `123456789:ABCdefGHIjklmNOpqrsTUVwxyz`

### Шаг 2: Зарегистрируйте Mini App

1. В @BotFather команда: `/newapp`
2. Выберите ваш бот
3. Введите URL вашего приложения: `https://yourdomain.com`
4. Получите APP_ID (короткий числовой ID)

### Шаг 3: Обновите .env

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_BOT_USERNAME=your_bot_username
NEXT_PUBLIC_TELEGRAM_APP_ID=your_app_id
TELEGRAM_WEBAPP_URL=https://yourdomain.com
```

### Шаг 4: Откройте Mini App

**Локально:**
```
https://web.telegram.org/k/#@your_bot_username?startapp
```

**В браузере:**
```
tg://web_app_debug?bot_id=YOUR_BOT_ID&url=http://localhost:3000
```

**На мобильном:**
Откройте бота в Telegram и нажмите кнопку с Mini App

---

## API для работы с Mini App

### Telegram WebApp SDK

```javascript
// src/hooks/useTelegram.ts

import { useEffect, useState } from 'react';

export function useTelegram() {
  const [tg, setTg] = useState(null);

  useEffect(() => {
    const app = window.Telegram?.WebApp;
    if (app) {
      app.ready();
      setTg(app);
    }
  }, []);

  return tg;
}
```

### Получение данных пользователя

```typescript
const tg = useTelegram();
const user = tg?.initDataUnsafe?.user;

// Returns:
{
  id: 123456789,
  is_bot: false,
  first_name: "Иван",
  last_name: "Петров",
  username: "ivanov",
  language_code: "ru"
}
```

### Безопасная передача данных

```typescript
import { verifyTelegramWebAppData } from "@/lib/crypto";

// На бэкенде
const initData = request.headers.get("X-Init-Data");
const isValid = verifyTelegramWebAppData(
  initData,
  process.env.TELEGRAM_BOT_TOKEN
);
```

---

## Уведомления в Telegram

### Отправка уведомления заказчику

```typescript
// src/lib/telegram-bot-service.ts

bot.sendMessage(
  chatId,
  "📦 Ваш заказ #123 готов!",
  {
    reply_markup: {
      inline_keyboard: [
        [{
          text: "👀 Посмотреть",
          web_app: { url: "https://yourdomain.com/orders/123" }
        }]
      ]
    }
  }
);
```

### Отправка уведомления владельцу

```typescript
// При создании заказа
await bot.sendMessage(
  business.telegramAdminChatId,
  `📦 Новый заказ!\n\nОсумма: ${order.totalPrice} RUB`,
  {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Принять", callback_data: `accept_${order.id}` },
          { text: "❌ Отклонить", callback_data: `reject_${order.id}` }
        ]
      ]
    }
  }
);
```

---

## Дизайн для Telegram

### Safe Area для Mobile

```css
/* Учитывает notch и bottom bar */
@supports (padding: max(0px)) {
  body {
    padding-left: max(1rem, env(safe-area-inset-left));
    padding-right: max(1rem, env(safe-area-inset-right));
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
  }
}
```

### Телеграм-специфичные CSS

```css
/* Соответствие темы Telegram */
.telegram-webapp {
  background-color: var(--tg-theme-bg-color);
  color: var(--tg-theme-text-color);
}

/* Кнопка в стиле Telegram */
.tg-button {
  background-color: var(--tg-theme-button-color);
  color: var(--tg-theme-button-text-color);
  border-radius: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  cursor: pointer;
}
```

---

## Bottom Keyboard

```typescript
// Используйте встроенную Bottom Keyboard компоненту
<BottomNavigation businessSlug="demo-cafe" primaryColor="#8B4513" />
```

---

## Иконки и Emoji

```typescript
// Используйте emoji в кнопках
const links = [
  { icon: "🏠", label: "Главная" },
  { icon: "📦", label: "Каталог" },
  { icon: "🛒", label: "Корзина" },
  { icon: "👤", label: "Профиль" },
];
```

---

## Примеры Mini App Pages

### Home Page
- Логотип бизнеса
- Описание
- Популярные товары
- Быстрые ссылки

### Catalog
- Категории
- Фильтр и поиск
- Сетка товаров
- Сортировка

### Item Detail
- Фото
- Описание
- Цена и старая цена
- Выбор количества
- Кнопка "Добавить в корзину"

### Cart
- Список товаров
- Изменение количества
- Удаление товаров
- Итоговая сумма
- Кнопка оформления

### Checkout
- Форма с именем и телефоном
- Адрес доставки
- Выбор способа доставки
- Комментарий к заказу
- Подтверждение и оплата

### Booking (для услуг)
- Выбор услуги
- Выбор мастера (опционально)
- Календарь
- Выбор времени
- Подтверждение

### Order Status
- Номер заказа
- Статус с иконкой
- Время доставки
- Кнопка связаться

### Profile
- Данные клиента
- История заказов
- История записей
- Бонусы

---

## Тестирование

### Desktop
```
http://localhost:3000?tgWebAppVersion=7.0&...
```

### Mobile
Откройте в Telegram на телефоне через бота

### Debug Mode
```javascript
// Откройте DevTools в браузере
// Telegram WebApp автоматически включит debug mode
```

---

## Deployment на Vercel/Netlify

### 1. Push в GitHub
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Подключите к Vercel

- Откройте vercel.com
- "New Project" → выберите репозиторий
- Установите env variables:
  ```
  DATABASE_URL=...
  NEXT_PUBLIC_APP_URL=https://yourdomain.vercel.app
  TELEGRAM_BOT_TOKEN=...
  ```

### 3. Обновите webhook в @BotFather

```
/setwebhook
https://yourdomain.vercel.app/api/telegram/webhook
```

---

## FAQ

**Q: Как тестировать локально?**
A: Используйте `http://localhost:3000` в .env

**Q: Как передать данные в Mini App?**
A: Через `query string` в ссылке бота `/start?data=value`

**Q: Какие permissions нужны?**
A: Telegram WebApp автоматически запрашивает нужные permissions

**Q: Как сделать кнопку платежа?**
A: Используйте Telegram Payment API или встроенную систему платежей

---

✅ Mini App готов к использованию!
