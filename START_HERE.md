# 🎯 START HERE - Начните отсюда

## 📱 Что это?

**TelebiznezHub** - готовая платформа для создания Telegram Mini App для локального бизнеса (кафе, салоны, магазины, автомойки и т.д.).

- ✅ **Один код** - много бизнесов
- ✅ **White-label** - кастомизируется под любого клиента
- ✅ **Готовая база данных** - 20+ моделей
- ✅ **Demo данные** - 4 полных бизнеса
- ✅ **MVP функции** - заказы, записи, товары, клиенты

---

## ⚡ За 5 минут на запуск

### Требования
- **Node.js 18+** ([скачать](https://nodejs.org/))
- **PostgreSQL 13+** ([скачать](https://www.postgresql.org/)) ИЛИ Docker

### Шаг 1: Установка зависимостей
```bash
npm install
```

### Шаг 2: Настройка базы данных

Если у вас **PostgreSQL уже запущен**:

Отредактируйте `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/telegram_miniapp_db"
```

Если у вас **Docker**:
```bash
docker run --name postgres \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=telegram_miniapp_db \
  -p 5432:5432 \
  -d postgres:15
```

### Шаг 3: Создание таблиц и данных
```bash
npm run db:push
npm run db:seed
```

### Шаг 4: Запуск
```bash
npm run dev
```

**Откройте:** http://localhost:3000

---

## 🎮 Что вы видите?

### Главная страница
- http://localhost:3000
- 4 demo бизнеса с демо-данными
- Выбор для открытия Mini App

### Mini App (Telegram пользователь)
- http://localhost:3000/demo-cafe
- http://localhost:3000/demo-barbershop
- http://localhost:3000/demo-carwash
- http://localhost:3000/demo-shop

### Admin Panel (Администратор)
- http://localhost:3000/admin/login
- **Email:** admin@example.com
- **Password:** admin123

---

## 📚 Где найти информацию?

| Что ищете? | Где найти? |
|-----------|-----------|
| Быстрый старт | [QUICKSTART.md](./QUICKSTART.md) |
| Что было создано | [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) |
| Следующие шаги | [NEXT_STEPS.md](./NEXT_STEPS.md) |
| Архитектура | [docs/architecture.md](./docs/architecture.md) |
| Telegram Mini App | [docs/telegram-mini-app.md](./docs/telegram-mini-app.md) |
| Полная документация | [README.md](./README.md) |

---

## 🏗️ Структура проекта

```
src/
├── app/              # Next.js 15 страницы
│   ├── (miniapp)/   # Telegram Mini App
│   ├── (admin)/     # Admin Panel
│   ├── api/         # API endpoints
│   └── page.tsx     # Home page
│
├── components/       # React компоненты
│   ├── mini-app/    # Mini App UI
│   ├── admin/       # Admin UI
│   ├── ui/          # Base компоненты
│   └── shared/      # Общие компоненты
│
├── lib/             # Утилиты и сервисы
├── hooks/           # React хуки
├── store/           # Zustand стохранилища
└── types/           # TypeScript типы

prisma/
├── schema.prisma    # Database schema
├── seed.ts          # Demo данные
└── migrations/      # Database миграции
```

---

## 🗄️ Database Schema

### Основные таблицы

```
Business          - Бизнес (cafe, shop, barbershop, etc)
├─ Customer       - Клиент (Telegram user)
├─ Order          - Заказ
│  └─ OrderItem   - Позиция в заказе
├─ Item           - Товар или услуга
│  └─ Category    - Категория
├─ Booking        - Запись на услугу
├─ Staff          - Сотрудник
├─ WorkingHours   - Расписание бизнеса
├─ Payment        - Платеж
└─ Settings       - Настройки бизнеса

User              - Администратор
```

---

## 🔐 Demo Accounts

### Admin Panel
```
Email: admin@example.com
Password: admin123
URL: http://localhost:3000/admin/login
```

### Demo Businesses
1. **☕ Demo Cafe** - Кафе с напитками и десертами
2. **✂️ Demo Barbershop** - Барбершоп с услугами и мастерами
3. **🚗 Demo Carwash** - Автомойка с услугами
4. **🛍️ Demo Shop** - Магазин с товарами и категориями

Все бизнесы заполнены тестовыми данными.

---

## 📖 Рекомендуемые действия

### 1️⃣ Исследуйте существующий код
- Откройте `/src/app/page.tsx` - главная страница
- Откройте `/prisma/schema.prisma` - структура БД
- Откройте `/src/components/mini-app/ItemCard.tsx` - компонент товара
- Откройте `/src/app/api/orders/route.ts` - API для заказов

### 2️⃣ Разберитесь с Prisma
```bash
npm run db:studio  # Web UI для просмотра данных
```

### 3️⃣ Читайте документацию
- Если вопросы о структуре → `docs/architecture.md`
- Если вопросы о Telegram → `docs/telegram-mini-app.md`
- Если вопросы о развертывании → `README.md`

### 4️⃣ Тестируйте API
```bash
# Получить все товары кафе
curl http://localhost:3000/api/items/demo-cafe

# Получить информацию бизнеса
curl http://localhost:3000/api/businesses/demo-cafe
```

### 5️⃣ Начните разработку
Посмотрите [NEXT_STEPS.md](./NEXT_STEPS.md) для дорожной карты.

---

## 🐛 Troubleshooting

### "Error: Can't reach database server"
```bash
# Проверьте DATABASE_URL в .env
# Убедитесь, что PostgreSQL запущен
docker ps | grep postgres
```

### "Error: Cannot find module '@prisma/client'"
```bash
npm run db:generate
```

### "Port 3000 already in use"
```bash
npm run dev -- -p 3001
```

### "No seed data after npm run db:seed"
```bash
npm run db:push
npm run db:seed
```

---

## 🚀 Следующие шаги

### Для разработки
1. Разберитесь с структурой проекта
2. Посмотрите [NEXT_STEPS.md](./NEXT_STEPS.md)
3. Начните с Mini App страниц
4. Затем перейдите на Admin Panel

### Для демонстрации клиентам
1. Откройте http://localhost:3000 в браузере
2. Покажите 4 готовых бизнеса
3. Откройте Admin Panel
4. Демонстрируйте управление

### Для production
1. Изучите [docs/deployment.md](./docs/deployment.md)
2. Выберите хостинг (Vercel, Railway, VPS)
3. Настройте Telegram Bot token
4. Deploy!

---

## 💡 Полезные команды

```bash
# Development
npm run dev              # Запуск dev сервера
npm run build           # Build для production
npm run start           # Запуск production

# Database
npm run db:push         # Sync schema с БД
npm run db:migrate      # Run migrations
npm run db:generate     # Generate Prisma client
npm run db:seed         # Заполнить тестовыми данными
npm run db:studio       # Web UI для БД

# Linting
npm run lint            # Run ESLint
npm run type-check      # TypeScript check
```

---

## 📞 Где получить помощь?

1. **Документация** - [README.md](./README.md)
2. **Гайды** - [docs/](./docs/)
3. **Примеры кода** - [src/](./src/)
4. **Prisma Studio** - `npm run db:studio`
5. **Комментарии в коде** - Внимательно читайте!

---

## ✨ Ключевые особенности

- ✅ **Multi-tenant** - один код для многих бизнесов
- ✅ **Type-safe** - полностью на TypeScript
- ✅ **Production-ready** - готово к использованию
- ✅ **Well-documented** - есть комментарии и гайды
- ✅ **Demo data** - 4 полных бизнеса для тестирования
- ✅ **Scalable** - архитектура готова к масштабированию
- ✅ **White-label** - легко кастомизируется

---

## 🎯 TL;DR (Очень коротко)

```bash
# 1. Установите
npm install

# 2. Настройте БД
npm run db:push
npm run db:seed

# 3. Запустите
npm run dev

# 4. Откройте
http://localhost:3000

# 5. Логин
admin@example.com / admin123
```

---

## 🎉 Готово!

Вы установили полнофункциональную платформу для создания Telegram Mini App.

**Что дальше?**
- Читайте документацию
- Изучайте код
- Тестируйте функции
- Начните разработку

**Вопросы?** Смотрите [docs/](./docs/) или [README.md](./README.md)

---

**Happy coding! 🚀**

*Created: May 2026*  
*Version: 0.1.0 MVP*
