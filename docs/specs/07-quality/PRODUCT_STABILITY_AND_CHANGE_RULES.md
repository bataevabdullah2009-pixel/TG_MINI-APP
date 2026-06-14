# Product Stability and Change Rules

## 1. Work order

Every material task follows:

`SPEC -> PLAN -> CODE -> VERIFY -> HANDOFF`.

## 2. Protected production behavior

The following require explicit scope and regression verification:

- marketplace entry;
- business storefront;
- checkout and idempotency;
- seller order visibility;
- payment review;
- courier transitions;
- Telegram webhook and production links;
- tenant isolation;
- production schema compatibility.

## 3. Scope discipline

- Use existing architecture and helpers.
- Do not combine unrelated refactoring.
- Do not redesign UI during docs/backend/hotfix tasks.
- Do not rename routes without a migration task.
- Do not delete working features to simplify a fix.
- Prefer compatibility over broad cleanup in stabilization work.

## 4. Data safety

- No production reset.
- No `DROP TABLE` hotfix.
- No broad destructive backfill.
- New Prisma field requires safe SQL.
- Archive instead of physical delete.
- Preserve order and booking snapshots.

## 5. Error safety

- Raw database errors stay server-side.
- User gets normal Russian text.
- Optional module failure should degrade locally.
- Public marketplace should remain usable when profile fails.
- Notification failure must not roll back a successful business transaction.

## 6. Documentation safety

- One canonical spec per subject.
- Status is explicit.
- Technical details stay out of global product spec.
- Roadmap is not current behavior.
- Historical report is not a requirement.
- All links are checked before handoff.

## 7. Verification scale

Documentation-only:

- link check;
- duplicate/stale reference scan;
- Git diff review.

Scoped code:

- lint/typecheck;
- focused tests;
- Prisma checks if schema-related.

Protected flow:

- build;
- focused API or smoke checks;
- end-to-end browser/Telegram verification when available.

## 8. Git

- Stage only task files.
- Exclude generated artifacts unless required.
- Use conventional commit.
- Do not include unrelated worktree changes.
- Direct main push is performed only on explicit user instruction.
