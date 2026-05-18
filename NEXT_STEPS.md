# 📋 NEXT STEPS - Дорожная карта развития

## Прямо сейчас (не требует кода)

### 1. Получение Telegram Bot Token
```
1. Откройте @BotFather в Telegram
2. Команда: /newbot
3. Следуйте инструкциям
4. Сохраните token в .env: TELEGRAM_BOT_TOKEN=xxx
5. Получите username бота и добавьте в .env
```

### 2. Локальное тестирование
```bash
# Установите и запустите
npm install
npm run db:push
npm run db:seed
npm run dev

# Откройте http://localhost:3000
# Вход в админку: admin@example.com / admin123
```

### 3. Проверьте demo бизнесы
- http://localhost:3000/demo-cafe
- http://localhost:3000/demo-barbershop
- http://localhost:3000/demo-carwash
- http://localhost:3000/demo-shop

---

## Неделя 1: Mini App UI (~30-40 часов)

### Pages to Complete

**Priority 1 (Critical):**
```
⭐ /:slug/item/[id] - Product detail page
   ├── Полная информация товара
   ├── Фото галерея (если есть)
   ├── Отзывы (опционально)
   ├── Выбор количества
   ├── "Добавить в корзину"
   └── Кнопка "Купить сейчас"

⭐ /:slug/checkout - Оформление заказа
   ├── Форма с именем, телефоном
   ├── Адрес (с картой опционально)
   ├── Выбор доставки/самовывоза
   ├── Комментарий к заказу
   ├── Выбор способа оплаты
   ├── Итоговая сумма
   └── Кнопка "Оформить"

⭐ /:slug/booking - Онлайн-запись (для услуг)
   ├── Выбор услуги
   ├── Выбор мастера
   ├── Calendar picker
   ├── Time slots (на основе расписания)
   ├── Форма контактов
   └── Подтверждение
```

**Priority 2 (Important):**
```
⭐ /:slug/orders/[id] - Статус заказа
   ├── Информация заказа
   ├── Статус с иконкой
   ├── Время доставки
   ├── Контакт с бизнесом
   └── История статусов

⭐ /:slug/profile - Профиль клиента
   ├── Данные пользователя
   ├── Список заказов
   ├── Список записей
   ├── Сумма потрачено
   └── Бонусы (опционально)

⭐ /:slug/contacts - Контакты
   ├── Адрес
   ├── Карта (Google Maps)
   ├── Телефон
   ├── Telegram/WhatsApp ссылки
   ├── Режим работы
   └── Instagram
```

### Implementation Guide

**Для каждой страницы:**
1. Создайте page.tsx в правильной папке
2. Используйте готовые компоненты
3. Добавьте API запросы через apiClient
4. Добавьте Zod валидацию для форм
5. Обработайте loading и error states
6. Используйте business colors для стилей
7. Адаптируйте под mobile

**Пример для item/[id]/page.tsx:**
```typescript
"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Item, Business } from "@/types";
import { apiClient } from "@/lib/api-client";
import { useCartStore } from "@/store/cartStore";
import { Button } from "@/components/ui/button";

export default function ItemDetailPage() {
  const params = useParams();
  const itemId = params.id as string;
  const slug = params.slug as string;
  
  const [item, setItem] = useState<Item | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const addToCart = useCartStore((state) => state.addItem);
  
  useEffect(() => {
    // Fetch item and business
    // Display item with add to cart button
  }, [itemId, slug]);
  
  const handleAddToCart = () => {
    addToCart({
      itemId: item!.id,
      name: item!.name,
      price: item!.price,
      quantity: 1,
    });
    // Show toast: "Added to cart"
  };
}
```

---

## Неделя 2: Admin Panel (~40-50 часов)

### Pages to Complete

**Priority 1:**
```
⭐ /admin/businesses (Super Admin only)
   ├── Таблица всех бизнесов
   ├── Статус подписки
   ├── Кнопка создать новый
   ├── Редактирование
   ├── Блокировка/активация
   └── Удаление

⭐ /admin/orders
   ├── Таблица заказов
   ├── Фильтр по статусу
   ├── Поиск по номеру
   ├── Открыть детали
   ├── Изменить статус
   ├── Комментарии
   └── Контакт с клиентом

⭐ /admin/bookings
   ├── Календарь записей
   ├── Список записей
   ├── Фильтр по статусу
   ├── Подтверждение
   ├── Отмена
   └── Напоминание
```

**Priority 2:**
```
⭐ /admin/items
   ├── Таблица товаров/услуг
   ├── CRUD операции
   ├── Категория
   ├── Цена
   ├── Популярность
   ├── Доступность
   └── Сортировка

⭐ /admin/categories
   ├── Управление категориями
   ├── Создание
   ├── Редактирование
   ├── Удаление
   └── Сортировка

⭐ /admin/customers
   ├── Таблица клиентов
   ├── История заказов
   ├── Сумма потрачено
   ├── Последняя активность
   └── Контактные данные

⭐ /admin/staff
   ├── Управление сотрудниками
   ├── Расписание
   ├── Статус активности
   └── Услуги

⭐ /admin/settings
   ├── Основная информация
   ├── Контакты
   ├── Адрес с картой
   ├── Социальные сети
   ├── Режим работы
   └── Модули (включение/отключение)

⭐ /admin/design
   ├── Логотип
   ├── Обложка
   ├── Основной цвет
   ├── Дополнительный цвет
   ├── Фон
   ├── Акцент
   └── Preview
```

### Admin Components to Create

```
AdminLayout (Sidebar + TopBar)
├── Sidebar (Navigation, Logo, Logout)
├── TopBar (User, Settings, Notifications)
├── DashboardCard (Stats)
├── DataTable (Orders, Bookings, Items)
├── FilterBar (Search, Filters)
├── Modal (Create/Edit forms)
├── Forms (Settings, Items, Categories, etc.)
├── Calendar (Bookings)
├── StatusBadge (Colored status indicators)
└── ConfirmDialog (Delete confirmations)
```

---

## Неделя 3: Telegram Bot & Notifications (~20-30 часов)

### Bot Commands to Implement

**User Commands:**
```
/start
  └─ Welcome message + Open Mini App button

/help
  └─ List of available commands

/menu
  └─ Main menu with quick links
```

**Owner Commands:**
```
/admin
  └─ Link to admin panel

/orders
  └─ Last 5 orders with status

/bookings
  └─ Next 5 bookings

/stats
  └─ Today's stats (orders, revenue)
```

### Notifications to Implement

**To Business Owner:**
```
📦 New Order
- Order ID
- Total price
- Buttons: Accept, View Details, Decline

📅 New Booking
- Customer name
- Service
- Time
- Buttons: Confirm, Reject

💬 Order Status Changed
- New status
- Order ID
- Link to order

⏰ Reminder Check Bookings
- Daily at 9 AM
```

**To Customer:**
```
✅ Order Confirmed
- Order details
- Estimated delivery
- Track button

📦 Order Ready
- Pickup time
- Location

🚚 Order Delivered
- Thank you
- Review button

✂️ Booking Confirmed
- Service details
- Time
- Reminder button

⏰ Booking Reminder
- 24 hours before
- 2 hours before
```

### Bot Service Setup

```typescript
// services/telegram-bot/index.ts
import TelegramBotService from "@/lib/telegram-bot-service";

const bot = new TelegramBotService({
  token: process.env.TELEGRAM_BOT_TOKEN!,
  polling: true,
});

// 1. Register command handlers
bot.onStart();
bot.onAdmin();
bot.onOrders();
// ...

// 2. Register callback handlers
bot.onOrderAccept();
bot.onOrderReject();
// ...

// 3. Setup scheduled jobs
setupReminders(); // Every 2 hours check reminders
setupDailyStats(); // Every morning
```

---

## Неделя 4: Testing & Polish (~20-30 часов)

### Testing

**Manual Testing:**
```
Mini App:
- [ ] Выбор бизнеса на главной
- [ ] Просмотр каталога
- [ ] Добавление в корзину
- [ ] Оформление заказа
- [ ] Получение подтверждения
- [ ] История заказов

Admin Panel:
- [ ] Вход администратора
- [ ] Просмотр заказов
- [ ] Изменение статуса
- [ ] Просмотр клиентов
- [ ] Управление товарами

Telegram:
- [ ] /start команда
- [ ] Уведомления о заказе
- [ ] Уведомления о записи
- [ ] Inline кнопки
```

**Features to Add:**
```
- [ ] Loading spinners
- [ ] Empty states (пустая корзина, нет заказов)
- [ ] Error messages
- [ ] Success toasts
- [ ] Confirmation dialogs
- [ ] Date pickers
- [ ] Multi-language support (ru/en)
- [ ] Dark mode toggle
```

### Performance Optimization

```
- [ ] Image optimization (next/image)
- [ ] Code splitting per route
- [ ] Lazy loading components
- [ ] Caching strategies
- [ ] Database query optimization
- [ ] API response caching
```

---

## Месяц 2: Advanced Features

### Payment Integration

```
Priority 1:
- [ ] Telegram Stars payments
- [ ] Yookassa integration
- [ ] Manual payment tracking

Priority 2:
- [ ] Refund system
- [ ] Subscription billing
- [ ] Invoice generation
```

### Advanced Analytics

```
- [ ] Revenue dashboard
- [ ] Customer analytics
- [ ] Popular items
- [ ] Busiest hours
- [ ] Conversion rates
- [ ] Export reports
```

### Marketing Features

```
- [ ] Email notifications
- [ ] SMS reminders
- [ ] Loyalty program
- [ ] Promo codes
- [ ] Reviews & ratings
- [ ] Referral system
```

---

## Deployment Checklist

### Before Going Live

```
Security:
- [ ] HTTPS everywhere
- [ ] Rate limiting on API
- [ ] CORS configured correctly
- [ ] Secrets in .env
- [ ] SQL injection protection (Prisma)
- [ ] XSS protection (React)

Performance:
- [ ] Images optimized
- [ ] Database indexes
- [ ] API response times < 200ms
- [ ] CDN setup for static files

Infrastructure:
- [ ] Database backups
- [ ] Error monitoring (Sentry)
- [ ] Logging setup
- [ ] Health checks

Documentation:
- [ ] README updated
- [ ] API documentation
- [ ] Deployment guide
- [ ] Troubleshooting guide
```

### Deployment Options

**Option 1: Vercel + PostgreSQL**
```
Pros: Easy, fast, Telegram Mini App ready
Cons: Costs for database
Steps:
1. Connect GitHub repo to Vercel
2. Setup env variables
3. Deploy
4. Setup Telegram webhook
```

**Option 2: Railway + Railway PostgreSQL**
```
Pros: All-in-one, Docker support
Cons: Less optimized for Next.js
Steps:
1. Connect GitHub
2. Add PostgreSQL service
3. Deploy
```

**Option 3: VPS (DigitalOcean, Linode)**
```
Pros: Full control, cheap
Cons: Need to manage server
Steps:
1. Setup Node.js on VPS
2. Setup PostgreSQL
3. Configure Nginx reverse proxy
4. Setup SSL with Let's Encrypt
5. Use PM2 for process management
```

---

## Documentation to Update

```
When Adding Features:
- [ ] Update README with new commands
- [ ] Update QUICKSTART if setup changes
- [ ] Add examples in docs/
- [ ] Update API documentation
- [ ] Add inline code comments
- [ ] Create troubleshooting guide
```

---

## File Structure for Reference

```
After completing all phases:

src/app/
├── (miniapp)/
│   ├── [slug]/
│   │   ├── page.tsx ✓
│   │   ├── catalog/ ✓
│   │   ├── item/[id]/ [TODO]
│   │   ├── cart/ ✓
│   │   ├── checkout/ [TODO]
│   │   ├── booking/ [TODO]
│   │   ├── orders/[id]/ [TODO]
│   │   ├── profile/ [TODO]
│   │   └── contacts/ [TODO]
│
├── (admin)/
│   ├── admin/
│   │   ├── login/ ✓
│   │   ├── page.tsx ✓
│   │   ├── businesses/ [TODO]
│   │   ├── orders/ [TODO]
│   │   ├── bookings/ [TODO]
│   │   ├── items/ [TODO]
│   │   ├── categories/ [TODO]
│   │   ├── customers/ [TODO]
│   │   ├── staff/ [TODO]
│   │   ├── settings/ [TODO]
│   │   └── design/ [TODO]

services/
└── telegram-bot/
    ├── index.ts [TODO]
    ├── handlers/ [TODO]
    └── services/ [TODO]
```

---

## Estimated Timeline

```
Current Phase: ✅ Foundation (35%)
  - ✅ Architecture
  - ✅ Database schema
  - ✅ API endpoints
  - ✅ Base components

Week 1-2: Mini App UI (30%)
  - Remaining 8 pages
  - Forms and validation
  - Animations

Week 3-4: Admin Panel (30%)
  - Dashboard
  - CRUD pages
  - Data tables

Week 5: Bot & Notifications (15%)
  - Telegram bot
  - Notification system

Week 6: Testing & Optimization (10%)
  - Bug fixes
  - Performance
  - Security

Week 7: Deployment (5%)
  - Production setup
  - Monitoring

Total: 7 weeks for MVP ready to sell
```

---

## Key Metrics to Track

```
Performance:
- Page load time < 2s
- API response time < 200ms
- Mobile Lighthouse score > 90

Business:
- User retention rate
- Order completion rate
- Average order value
- Customer satisfaction

Technical:
- Error rate < 0.1%
- Uptime > 99.5%
- Database query efficiency
```

---

## Resources

```
Documentation:
- Next.js: https://nextjs.org/docs
- Prisma: https://www.prisma.io/docs
- Telegram Bot API: https://core.telegram.org/bots/api
- Telegram Mini App: https://core.telegram.org/bots/webapps

Communities:
- React: https://react.dev
- Next.js Discord: https://discord.gg/nextjs
- Telegram Developers: https://t.me/tdlibchat

Tools:
- Postman: For API testing
- Prisma Studio: For database visualization
- DevTools: For frontend debugging
```

---

## Questions & Support

```
For development questions:
1. Check docs/ folder
2. Read comments in code
3. Check Prisma schema
4. Test with demo data

Common Issues:
- "Port already in use": npm run dev -- -p 3001
- "DB connection error": Check DATABASE_URL
- "Prisma not found": npm run db:generate
```

---

**Вы готовы начать разработку! 🚀**

Рекомендую начать с Mini App страниц - они дадут быстрый результат.

Good luck! 🎉
