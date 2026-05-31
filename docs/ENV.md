# ENV

```env
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"
SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_role_key"
SUPABASE_STORAGE_BUSINESS_MEDIA_BUCKET="business-media"
SUPABASE_STORAGE_PRODUCT_IMAGES_BUCKET="product-images"
SUPABASE_STORAGE_BUSINESS_COVERS_BUCKET="business-covers"
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be exposed in client code.

For Telegram auth:

```env
TELEGRAM_BOT_TOKEN="your_bot_token"
TELEGRAM_SUPER_ADMIN_IDS="8229830002"
VALIDATE_TELEGRAM_DATA="true"
```
