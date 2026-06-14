# Deployment

The canonical deployment runbook is
[docs/release/DEPLOYMENT.md](docs/release/DEPLOYMENT.md).

Before production deployment run the checks in
[docs/release/RELEASE_CHECKLIST.md](docs/release/RELEASE_CHECKLIST.md), verify
database connection targets, apply required safe `docs/manual-*.sql` patches,
and confirm Telegram webhook/Mini App URLs use the production HTTPS domain.
