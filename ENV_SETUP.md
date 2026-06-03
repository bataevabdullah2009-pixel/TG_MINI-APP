# Environment Variables Setup & Deployment Guide

This guide explains how to set up environment variables for **TG_MINI-APP** locally and configure it for hosting on **Vercel + Supabase + Telegram Mini App**.

---

## 🏗️ 1. Quick Database Setup Commands

If you are setting up the database for the first time, run the following commands in order:

```bash
# 1. Generate Prisma Client
npx prisma generate

# 2. Push schema to PostgreSQL database (creates tables)
npx prisma db push

# 3. Seed initial platform plans and super-admin data
npm run db:seed
```

---

## 💻 2. Local Development Setup

To configure the application on your local machine:

1. Copy the local configuration template:
   ```bash
   cp env/.env.local.example .env.local
   ```
2. Open `.env.local` and customize the values:
   * **Database**: If you have PostgreSQL running locally, keep the default localhost connection.
   * **Telegram Bot**: Put your test bot token from [@BotFather](https://t.me/BotFather).
   * **AI Provider**: By default, `AI_PROVIDER="mock"` is used, which returns mock SMM content, product descriptions, and reviews instantly and for free. No AI API keys are required for local testing!
3. Run the development server:
   ```bash
   npm run dev
   ```

---

## 🚀 3. Production Deployment (Vercel + Supabase)

When deploying to Vercel, copy values from the template `env/.env.production.example` into the **Vercel Project Dashboard** -> **Settings** -> **Environment Variables**.

### 🔹 Database Configuration (Supabase Pooling)
Prisma requires two separate connection URLs in serverless production settings (such as Vercel) to avoid running out of database connections:

1. **DATABASE_URL (Pooled Connection)**:
   * **Where to get**: Supabase Project Dashboard -> **Settings** -> **Database** -> **Connection string** -> Select **Transaction Mode** (port `6543`).
   * **Format**: `postgresql://postgres.yourproj:password@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`
   * **Use**: Handles dynamic application queries via PgBouncer pooling.

2. **DIRECT_URL (Direct Connection)**:
   * **Where to get**: Select **Session Mode** or use the direct database address (port `5432`).
   * **Format**: `postgresql://postgres.yourproj:password@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`
   * **Use**: Handles schema alterations, migrations, and database seeding (`npx prisma db push`).

### 🔹 Telegram Bot Live Setup
* **TELEGRAM_BOT_TOKEN**: Your production bot token from [@BotFather](https://t.me/BotFather).
* **TELEGRAM_BOT_USERNAME**: The username of your live bot (e.g., `VitrinaAI_bot`).
* **TELEGRAM_WEBHOOK_URL**: `https://your-vercel-domain.vercel.app/api/telegram/webhook`
* After deployment, register the webhook with Telegram by visiting:
  `https://your-vercel-domain.vercel.app/api/telegram/set-webhook`

### 🔹 AI Layer Production Integration
* **AI_PROVIDER**: Set to `"openrouter"` or `"polza"` to enable live AI capabilities.
* **OPENROUTER_API_KEY**: Your API key from [OpenRouter](https://openrouter.ai/).
* **POLZA_AI_API_KEY**: (Optional) Your API key from Polza AI.

> [!TIP]
> Make sure to generate secure, cryptographically random strings for `JWT_SECRET` and `ENCRYPTION_SECRET` to secure customer session cookies and white-label tokens!
