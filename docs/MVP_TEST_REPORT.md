# MVP TEST REPORT

## Changes

- Media uploads now use Supabase Storage instead of local disk writes.
- Phone verification syncs `User.phone` and refreshes Mini App profile status automatically.
- Demo businesses have an `isDemo` flag and can be hidden in production from non-admin catalog views.
- Logo assets were added in SVG and PNG sizes for app, favicon, and Telegram-style icons.

## Why Photo Upload Failed

The previous upload endpoints wrote files into `public/uploads`. On Vercel, runtime filesystem writes are not durable and can fail or disappear after deployment. Uploads now go to Supabase Storage and the public URL is stored in the database.

## Seller Connection

1. Create a business in Super Admin.
2. Enter the owner's Telegram ID or give the generated `/link CODE` to the seller.
3. Seller opens the bot and sends `/link CODE`.
4. The system links the seller to the business and opens seller mode for that `businessId`.

## Remaining After MVP

- Full Super Admin edit screens for tariff and owner reassignment.
- End-to-end tests inside Telegram WebView.
- Media cleanup for deleted/replaced assets.
