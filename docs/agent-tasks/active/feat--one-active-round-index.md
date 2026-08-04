# One active round per school, enforced by the database

## Metadata

- Branch: `feat/one-active-round-index`
- Base branch: `main`
- Base commit: `3adb18a` (= `origin/main`)
- Current HEAD: `51ed695` (code) + the documentation commit that carries this
  file; worktree otherwise clean apart from the user's pre-existing
  `.idea/shalomut-map-demo.iml` and generated `next-env.d.ts`
- Git state: both commits are local and unpushed; visible only in this worktree
  until the owner pushes the branch
- Status: implementation complete, verified, unpushed
- Last updated: 2026-08-04
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close `docs/product-behaviour-backlog.md` §10's last open engineering item: make
the single-active-round rule (ADR-014) durable in the database instead of
resting on `RoundService` alone.

## User-visible outcome

None on the surface. A school still runs one round at a time and the builder
still names the round that stopped running. What changes is what happens when
something goes wrong: a crashed activation, a direct SQL edit or a future second
writer can no longer leave a school with two live share links.

## Scope

- Partial unique index `survey_rounds_one_active_per_organization` on
  `(organization_id) where status = 'active'`.
- The write ordering in `RoundService` that keeps the ordinary path off the
  constraint.
- Database-level tests for the index.

## Non-goals

- Transactions in the repository interface. The rule needs one write to win, not
  two writes to be atomic, and a deployment has one manager.
- Mapping a `P2002` on this index to a typed domain error. With the reordering
  the ordinary path never hits it, and inventing a user-facing state for a race
  that cannot happen in a one-manager deployment would be speculative.

## Decisions made

- **Close-before-activate, not activate-then-close.** With the index in place
  the old order is refused on the very write that makes the round live. The new
  order also fails in the safer direction: a lost activation write leaves the
  school with no running round rather than two.
- **Only `active` is constrained.** Drafts, closed and archived rounds are the
  history a second round extends, so a school may hold any number of them.
- **The index has no counterpart in `schema.prisma`.** Prisma cannot express a
  partial index; it is owned by the migration, and `prisma migrate diff`
  confirms Prisma does not see it as drift, so a later `migrate dev` will not
  try to drop it. `schema.prisma` carries a comment saying so.
- **The migration closes pre-existing duplicates first**, keeping the most
  recently created active round per school, so it cannot fail halfway on an
  environment that collected some.

## Completed

- `prisma/migrations/20260804120000_one_active_round_per_organization/migration.sql`
- `RoundService.activateRound` loads the round, closes the school's other active
  rounds, then flips it to `active`.
- `RoundService.createAndSaveRound` closes the school's active round before
  inserting a round that is born active.
- New PostgreSQL suite `postgres-one-active-round.test.ts`, wired into
  `scripts/verify-db.mjs`.
- Backlog §10 records the item as done; the operational handoff records the
  deployment finding below.

## Remaining

Nothing on this branch. The commit needs the owner's push (the agent cannot push
in this environment).

## Changed files

- `prisma/migrations/20260804120000_one_active_round_per_organization/migration.sql` (new)
- `prisma/schema.prisma` (comment only)
- `src/lib/services/round.service.ts`
- `src/lib/repositories/__dbtests__/postgres-one-active-round.test.ts` (new)
- `scripts/verify-db.mjs`
- `docs/product-behaviour-backlog.md`, `docs/shalomut-tracker-handoff.md`

## Verification evidence

### Passed

- `npm run verify` — exit code 0 on 2026-08-04, the whole gate for the first
  time since 2026-08-03:
  - `verify:core`: both fitness checks (5 + 5 tests), typecheck, **481**
    TypeScript tests, ESLint, production build compiled.
  - `verify:db`: **12** PostgreSQL tests, 7 pre-existing plus the 5 new ones —
    the index refuses a second active round with `P2002`, a school may hold five
    non-active rounds, two schools each keep their own active round, and both
    service paths (activate a draft, create a live round) satisfy the index.
  - `verify:ai`: **375** Python tests.
- `prisma migrate deploy` applied all 8 migrations to the disposable test
  database; `prisma migrate status` reports the schema up to date.
- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma`
  reports "No difference detected" with the partial index present — Prisma
  ignores it rather than treating it as drift.

### Blocked or not run

- The migration has **not** been applied to the deployed Supabase database. That
  is the owner's `npm run db:migrate:deploy` against the deployed target, after
  the push.
- No browser evidence. This branch changes no screen.

### Environment

Local only: `shalomut-local-db` container on port 5433, database
`shalomut_test`. `verify:db` refuses a managed host by design.

### Residual risk

Low. The one behaviour change outside the constraint is the activation ordering,
covered by both the in-memory service tests and the new PostgreSQL ones.

## Known risks

The deployed database will hold the index only after the migration runs there.
Until then deployed Core keeps the pre-existing service-only guarantee — the
same one it has today, so this is not a regression.

## Approval gates

None. Migrations against the disposable design-stage database need no approval.

## Next concrete step

Owner: push and then apply the migration to the deployed target.

```bash
git push origin feat/one-active-round-index:main
```

Then, with the deployed `DATABASE_URL`/`DIRECT_URL` in the environment:

```bash
npm run db:migrate:deploy
```
