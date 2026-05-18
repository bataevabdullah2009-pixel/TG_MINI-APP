# 🚀 QUICK START GUIDE

## За 5 минут на запуск

### Шаг 1: Требования
- Node.js 18+
- PostgreSQL 13+ (или Docker)

### Шаг 2: Setup (автоматический)

**Linux/Mac:**
```bash
bash scripts/setup.sh
```

**Windows:**
```powershell
npm install
npm run db:push
npm run db:seed
```

### Шаг 3: Переменные окружения

`.env` уже скопирован из `.env.example`. Если нужно:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/telegram_miniapp_db"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
TELEGRAM_BOT_TOKEN="your_token" # Опционально
JWT_SECRET="your_secret_key"
```

### Шаг 4: Запуск

```bash
npm run dev
```

Откройте в браузере: **http://localhost:3000**

---

## 🔐 Demo Accounts

### Admin Panel
- **URL:** http://localhost:3000/admin/login
- **Email:** admin@example.com
- **Password:** admin123

### Demo Businesses
После seeding доступны 4 тестовых бизнеса:

1. **Demo Cafe ☕** - /demo-cafe
2. **Demo Barbershop ✂️** - /demo-barbershop
3. **Demo Carwash 🚗** - /demo-carwash
4. **Demo Shop 🛍️** - /demo-shop

---

## 📝 Полезные команды

```bash
# Development
npm run dev                  # Запуск dev сервера
npm run build               # Build для production
npm run start               # Запуск production

# Database
npm run db:push            # Sync schema с БД
npm run db:migrate         # Run migrations
npm run db:generate        # Generate Prisma client
npm run db:seed            # Заполнить тестовыми данными
npm run db:studio          # Web UI для БД

# Prisma
npx prisma introspect      # Introspect existing DB
npx prisma format          # Format schema
```

---

## 🐳 Docker (PostgreSQL)

Если у вас есть Docker:

```bash
docker run --name postgres-telebi \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=telegram_miniapp_db \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  -d postgres:15
```

---

## 🎯 Структура

```
/src
  /app           # Next.js routes
    /(miniapp)   # Telegram Mini App pages
    /(admin)     # Admin Panel
    /api         # API endpoints
  /components    # React components
  /lib          # Utilities & services
  /store        # Zustand stores
  /types        # TypeScript types
  /hooks        # Custom hooks

/prisma
  /schema.prisma # Database schema
  /seed.ts      # Seed script
  /migrations   # Database migrations
```

---

## 🚀 После первого запуска

1. ✅ Откройте http://localhost:3000
2. ✅ Откройте /admin/login
3. ✅ Введите demo данные
4. ✅ Найдите demo бизнесы на главной странице

---

## ⚠️ Troubleshooting

### Error: "Can't reach database server"
```bash
# Проверьте DATABASE_URL в .env
# Проверьте, запущен ли PostgreSQL
docker ps | grep postgres
```

### Error: "Prisma client not found"
```bash
npm run db:generate
```

### "Port 3000 already in use"
```bash
npm run dev -- -p 3001
```

---

## 📚 Документация

- 📖 [Полный README](./README.md)
- 🏗️ [Архитектура](./docs/architecture.md)
- 🤖 [Telegram Bot setup](./docs/telegram-bot.md)
- 🚀 [Deployment guide](./docs/deployment.md)

---

**Готово! Начните разработку 🎉**
