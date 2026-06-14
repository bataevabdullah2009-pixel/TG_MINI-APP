# Telegram Integration Specification

## 1. Responsibilities

Telegram provides:

- user identity through Mini App initData;
- bot entry and deep links;
- webhook messages and contacts;
- notifications;
- web_app buttons to customer, seller and courier surfaces.

## 2. Production URL rules

- Base URL comes from configured production env.
- Mini App entry points to the deployed `/app`.
- Webhook points to the deployed webhook handler.
- HTTPS is mandatory in production.
- localhost, 127.0.0.1, `::1`, ngrok and Vercel preview origin are rejected.
- Request origin is not a trusted production routing source.

## 3. Mini App initialization

- Client calls Telegram `ready` and `expand`.
- initData is attached to same-origin API requests.
- Server verifies signature in production.
- start parameter may open a business.
- Unknown start parameter falls back safely to marketplace, not another tenant.

## 4. Bot entry

The bot can:

- open marketplace;
- open a business from a start parameter;
- open seller workspace for an authorized owner;
- open courier workspace from notification;
- process supported text intents.

Bot username comes from configuration. Business-specific username/token is used
only when explicitly configured.

## 5. Webhook

- Optional secret token is validated.
- Update parsing tolerates unsupported update types.
- Commands and seller linking are handled before AI fallback.
- Errors are logged safely.
- Telegram receives a successful acknowledgement when retrying would cause
  duplicate side effects.

## 6. Contact verification

- Contact belongs to the Telegram sender.
- Number is normalized.
- User/Customer verification is updated.
- Contact data is not published or logged unnecessarily.

## 7. Notifications

- Seller links include business context.
- Client status links open history.
- Courier links open courier workspace.
- URLs are created by central production URL helpers.
- Failure to send is non-transactional for the underlying business operation.

## 8. Webhook operations

Use repository scripts:

```bash
npm run telegram:webhook:info
npm run telegram:webhook:set
npm run telegram:webhook:delete
```

Before setting:

- verify bot token;
- verify production app URL;
- verify webhook URL;
- verify optional secret;
- confirm the intended bot.

## 9. Logging

Allowed:

- update type;
- chat/user id;
- command/intent;
- business id;
- send result;
- safe error message.

Forbidden:

- bot token;
- full initData;
- webhook secret;
- service role key;
- full payment credentials.
