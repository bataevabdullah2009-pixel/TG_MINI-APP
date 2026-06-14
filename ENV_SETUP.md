# Environment Setup

The canonical environment reference is [docs/ENV.md](docs/ENV.md).

Use `.env.example` as the variable template. Never copy real secrets into
documentation, logs or commits. When adding a required variable, update both
files in the same task.

Production Telegram URLs must be deployed HTTPS URLs and must not use localhost,
127.0.0.1, ngrok or a Vercel preview deployment.
