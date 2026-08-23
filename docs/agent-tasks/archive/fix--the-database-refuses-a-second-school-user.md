# The database refuses a second school user

## Metadata

- Branch: `fix/the-database-refuses-a-second-school-user`
- Base branch: `main`
- Base commit: `3eada84`
- Current HEAD: `9b9382b`, an ancestor of `main`. The branch is `90777ac`, `9b9382b`,
  oldest first.
- Status: complete, landed on `main`; archived 2026-08-23
- Last updated: 2026-08-23
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the 2026-08-21 audit's «"Одно стоящее членство на школу" — check-then-insert
без бэкстопа в БД», anchored at `manager-administration-service.ts:250`, and its
low-severity twin — the same finding recorded twice.

## What was wrong

"A school has one person" (ADR-027) lived entirely in the application. Both
writers read the school's memberships, looked for one that stands — `active` or
`invited` — and refused if they found one. Two requests that read before either
writes both pass, and the school ends up with two standing memberships and two
answers to "who is this school's person". The schema's own comment on
`@@unique([managerId, organizationId])` had already said only the database can
refuse this atomically.

**There are two writers, not one.** The audit anchored the invitation; the same
window exists on restoring a revoked membership, where the read says there is
room and an invitation issued in between takes it.

## Decisions made

1. **A partial unique index, owned by its migration.** Prisma cannot express one
   in `schema.prisma`, so `organization_memberships_one_standing_per_organization`
   lives in `20260823140000_one_standing_membership_per_organization` — exactly
   the arrangement `survey_rounds_one_active_per_organization` already uses. The
   model carries a comment saying where it lives and that changing it means
   another migration.
2. **`suspended` is outside the index.** A school changes hands by
   revoke-then-invite, so revoked rows accumulate — and they have to: the audit
   log's `manager_id` points at them. An index that counted them would make a
   school unusable after its first handover, which the db suite asserts directly.
3. **The migration resolves conflicts before creating the index**, so it cannot
   fail halfway on an environment that collected some. The most recently created
   standing membership wins and the older ones become `suspended`, which is what
   revoking them would have done and keeps them readable. Copied in shape from
   the one-active-round migration, deliberately.
4. **The adapter translates that one `P2002` into
   `SchoolAlreadyHasSomebodyError` and re-throws everything else.** Answering an
   unrecognised constraint with "this school already has somebody" would replace
   a real defect with a reassuring message. The column list alone cannot identify
   this index — a partial index on one column looks like the plain
   `(organization_id)` index beside it — so the index name is what is matched.
5. **The in-memory repository enforces the same rule.** Otherwise the unit suite
   and PostgreSQL would disagree about what the product does, and a caller could
   be written against a store that quietly allows two. It cannot reproduce the
   race and does not need to.
6. **Both services map the error back to `SCHOOL_ALREADY_HAS_SOMEBODY`**, the
   reason the read already gives. The routes already answer that with `409`, so
   nothing above the service changed: the screen shows one message whichever of
   the two decided it, which is right — by then the answer is no either way.
7. **The read stays.** Not redundant: it refuses without a write on the ordinary
   path, and it is the only one of the two that can say no before a person row
   is created.

## Deliberately not done

`prisma-round.repository.ts`, `prisma-survey.repository.ts` and now
`prisma-manager.repository.ts` each carry a near-identical `P2002` detector.
Three copies is where a shared helper starts to earn its place — but the two
existing ones differ in a way a shared helper would have to paper over with a
mode flag (substring match versus exact match), and rewriting working, db-tested
code inside a bugfix widens the review surface for no behaviour. Worth its own
task.

## Changed files

- New `prisma/migrations/20260823140000_one_standing_membership_per_organization/migration.sql`.
- `prisma/schema.prisma` — the comment naming the index and its owner.
- `src/lib/auth/domain-contract.ts` — `SchoolAlreadyHasSomebodyError`, and the
  rule in `InMemoryManagerRepository.saveMembership`.
- `src/lib/repositories/prisma/prisma-manager.repository.ts` — the detector and
  the translation.
- `src/lib/auth/manager-administration-service.ts` — the
  `refusingASecondStandingMembership` helper and both call sites.
- New `src/lib/auth/__tests__/the-store-refuses-a-second-school-user.test.ts`.
- New `src/lib/repositories/__dbtests__/postgres-one-standing-membership.test.ts`.
- `PROJECT_CONTEXT.md` ADR-027 amendment, `docs/critical-audit-2026-08-21.md`
  (both rows), `PROGRESS.md`.

Nothing in `docs/openapi.yaml`: `/api/admin/*` is not in the published contract,
and the refusal the routes return is unchanged.

## Exact Git state

See the commits on this branch. The only unstaged file is `next-env.d.ts`, which
is generated and belongs to the owner — stage with
`git add -A ':!next-env.d.ts'`.

## Verification evidence

### Passed

- `npm run verify:db` — exit `0`, **75 tests, 75 pass**. Five of them are new and
  one is the point: two invitations dispatched at PostgreSQL before either
  completes, exactly one kept, and the loser receiving
  `SchoolAlreadyHasSomebodyError` rather than a raw `P2002`. The others cover the
  index's `WHERE` from both sides — suspended rows do not block, accepting an
  invitation is not a second row, the index is per school — and one walks the
  whole handover cycle.
- `npm run verify:core` — exit `0`, zero `not ok`.
- `npx prisma validate` — schema valid.
- `src/lib/auth/__tests__/the-store-refuses-a-second-school-user.test.ts` — 7
  tests, including an ordinary invitation as the negative control.
- **The deployed database was read before claiming the migration is safe there**:
  `organization_memberships` holds **0 rows**, and **0** schools have more than
  one standing membership. So the migration's `UPDATE` touches nothing and the
  index is created on an empty table. Read-only, over the same verified TLS the
  product uses (`resolvePoolConfig`, ADR-040), with a throwaway script that was
  deleted. An earlier attempt at the same count used
  `rejectUnauthorized: false`; it was re-run properly rather than left as the
  evidence.

### Blocked or not run

- `npm run test:e2e` — not run. No screen, route surface or status code changed;
  the refusal the routes already returned is unchanged.
- **The migration has not run anywhere but the disposable test database.** It
  applies to the deployed one on the next push, because `build` runs
  `scripts/deploy-migrate.mjs`. The count above is why that is expected to be
  uneventful, not proof that it was.
- The local development database was not migrated by this task; `verify:db` uses
  its own.

### Environment

Local. Disposable PostgreSQL on `127.0.0.1:5433` supplied by `verify:db`, plus
one read-only count against the deployed Supabase database.

### Residual risk

- **Rows written before this change are not re-checked at runtime.** The
  migration resolves them once; nothing rewrites history afterwards, which is the
  intent.
- The `409` a losing writer now receives is the same one it received from the
  read, so a caller cannot tell which decided. That is deliberate and is the
  reason the error is translated rather than surfaced — but it does mean the race
  losing is invisible in the response, and nothing counts it. Making it visible
  would be an observability counter, which was not asked for here.

## Next concrete step

Hand the owner the push, which is theirs to run:

```
git push origin fix/the-database-refuses-a-second-school-user:main
```

The next push to `main` applies the migration to the deployed database as part of
the build.
