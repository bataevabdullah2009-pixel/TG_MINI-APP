# Vitrina AI Documentation

## Start here

- [Specifications](specs/README.md) - product and implementation source of truth.
- [Project rules](PROJECT_RULES.md) - production and engineering constraints.
- [Environment](ENV.md) - environment variable reference.
- [Deployment](release/DEPLOYMENT.md) - production deployment runbook.
- [Release checklist](release/RELEASE_CHECKLIST.md) - pre-release checks.
- [Manual QA](MANUAL_QA_CHECKLIST.md) - human verification.

## Directory map

- `specs/` - canonical requirements grouped by type.
- `release/` - deployment and release procedures.
- `roadmap/` - future priorities, not current behavior.
- `runbooks/` - operational procedures.
- `work-plans/` - historical or task-specific plans and reports.
- `skills/` - local agent skill material.
- `manual-*.sql` - safe production schema patches required by project rules.

## Important distinction

Specifications define expected behavior and explicit status. Roadmaps and
reports provide context but do not override specs. The Prisma schema remains the
database source of truth, and each production field requires a matching safe SQL
patch.
