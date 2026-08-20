# Phase 3 — the audit log survives a restart

## Metadata

- Branch: `feat/the-audit-log-survives-a-restart`
- Base branch: `feat/identity-becomes-a-row` (phase 1), which is itself unpushed
- Base commit: `a22efe9`
- Current HEAD: `15b7016` plus the documentation commit on top
- Status: complete and verified, unpushed
- Last updated: 2026-08-20
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Phase 3 of [`docs/multi-tenancy-plan-2026-08-20.md`](../../multi-tenancy-plan-2026-08-20.md):
make the audit log outlive the container, and make an administrator opening a
school they are not a member of a thing that is written down.

## User-visible outcome

Nothing on any screen. What changed is what can be reconstructed afterwards: who
opened which school, and what was done in it. Two things are visible only when
something is wrong — an administrator gets a 503 or an error page if their visit
cannot be recorded, and a school user does not.

## Context

Phase 1 gave the platform about four administrators who may open every school.
The plan moved this phase ahead of everything optional for that reason: a role
whose use cannot be reconstructed is a role nobody can defend having granted.
Until today `getAuditLogRepository()` returned an in-memory store.

## Scope

Delivered:

- `audit_events`, migration `20260820160000_the_audit_log_survives_a_restart`,
  and `PrismaAuditLogRepository` behind the `IAuditLogRepository` that already
  existed.
- The repository resolved through the composition root, which removed the one
  exception `check-composition-root.mjs` was carrying.
- `ADMINISTRATOR_SCHOOL_VISIT`, recorded at `authorizeManagerRound` and
  `loadManagerContext`, failing closed.
- The five declared write actions actually recorded.

## Non-goals

- Any screen or endpoint that reads the log. Who may read it is the plan's own
  open question and stays open.
- `MEMBER_INVITED` and `MEMBER_ROLE_CHANGED`, which have no routes until phase 2.
- Retention. Nothing expires, here or anywhere else in this product.

## Acceptance criteria

All met; see the evidence.

## Decisions made

- **The administrator's read fails closed, and it is the only thing that does.**
  A visit that cannot be written refuses the read — 503 to an API caller, a
  thrown error to a screen. A read nobody can reconstruct is worse than a read
  that did not happen. A manager's *write* in their own school keeps the
  opposite rule: a failed audit write is logged and the action proceeds, because
  refusing it would take access away rather than record it. Both rules are one
  comment apart in `manager-audit.ts` so neither can be read as the other's
  oversight.
- **Two chokepoints, not twelve call sites.** `authorizeManagerRound` covers
  every round route and `loadManagerContext` covers every screen, so a new route
  cannot forget to record. The alternative — a call per handler — is a hole
  waiting for the next handler.
- **Not the middleware**, which is where the school is actually chosen and would
  have been the obvious single place. It runs on the Edge runtime and cannot
  reach Postgres through the pg driver.
- **One visit is one row for fifteen minutes**, keyed by administrator and
  school. One screen is a dozen requests. The window is process-local, so two
  instances can each record the same visit — an audit log would rather hold it
  twice than miss it, and the deduplication exists to keep the log readable
  rather than to make it exact. A failed write releases the window rather than
  claiming it, or one failure would silence the next fifteen minutes.
- **The table has no foreign keys.** An audit row has to outlive what it
  describes; a cascade would delete the record of the deletion.
- **`action` is text, not an enum.** A new action must not need a migration, and
  an old row must keep the name it was written with.
- **The five declared writes were wired, though the plan does not list them.**
  They were named when the audit service was written in slice 3 and exactly one
  — `ROUND_RESET` — was ever recorded. A durable table that only knows about
  resets is a durable empty table, and an administrator can write in any school,
  not only read.
- **`getOrganizationAuditLogs` now lets an administrator read any school's log.**
  It compared the session's active organization, which an administrator does not
  have, so the role could read nothing. Nothing calls it outside tests; making it
  correct does not decide the open question of who gets a screen.

## Assumptions

- A duplicate audit row is harmless and a missing one is not. Everything above
  chooses that way.
- Nobody is reading the log through the product yet, so the absence of a screen
  is not a gap in this phase.

## Completed

- `15b7016` — the table, the repository, the composition-root wiring, the
  administrator's visit, the five write actions, and the removal of the
  composition-root exception.
- The documentation commit on top: ADR-026, the plan's phase 3 marked
  implemented with what it did not ask for, `PROGRESS.md`, backlog §8, the
  audit table recorded in the data-flow document, and the operational handoff.

## Remaining

Nothing on this branch.

## Changed files

Schema and data: `prisma/schema.prisma`,
`prisma/migrations/20260820160000_the_audit_log_survives_a_restart/`,
`src/lib/repositories/prisma/prisma-audit-log.repository.ts`,
`src/lib/repositories/prisma/prisma-client.ts`, `src/lib/repositories/index.ts`,
`src/lib/composition-root.ts`, `scripts/check-composition-root.mjs`.

Recording: `src/lib/auth/manager-audit-service.ts`,
`src/lib/server/manager-audit.ts`, `src/lib/server/manager-scope.ts`,
`src/lib/server/manager-context.ts`.

Routes (the audit repository threaded through, and five write actions recorded):
the twelve manager route files under `src/app/api/`.

Tests: `src/lib/repositories/__tests__/prisma-audit-log.repository.test.ts`,
`src/lib/server/__tests__/administrator-visit-audit.test.ts`, and additions to
`src/app/api/__tests__/api.test.ts` and
`src/lib/auth/__tests__/slice-3-roles-audit-membership.test.ts`. Six test files
lost the `setAuditLogRepositoryForTests` seam, which the composition root
replaces.

## Verification evidence

### Passed

Local:

- `npm test` — 1295 passed, 0 failed (1278 before this branch): 6 repository
  tests, 9 visit tests, 1 route-level write test, 1 log-read test.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run lint:composition`
  (now with no exceptions), `npm run lint:doc-numbers`, `npm run lint:skills`,
  `npm run openapi:check`, `npm run docs:endpoints:check` — all clean.
- `npm run db:migrate:deploy` applied the migration to the local database.
- **Real-runtime walk**, `next start` on port 3212 against the local database,
  with the same stand-in OpenID Connect provider phase 1 used, driven with curl
  cookie jars:
  - The administrator opened school `34d05e66-…` three times as a page and once
    as an API read: **one** row, naming them and the school.
  - They opened `local-dev-organization`: a **second** row. Two schools, two
    rows, one administrator.
  - A school user signed in, opened their own school and was refused a foreign
    `?school=`: **no** rows at all. Their own school is the product working.
  - They created a round: a `ROUND_CREATED` row with the round id and title.
  - The audit table was then renamed out from under the running server and the
    server restarted, which also cleared the visit window. The administrator's
    read of the foreign school answered **503** with
    `This school cannot be opened right now: the visit could not be recorded.`
    The school user's read of their own school answered **200** at the same
    moment.
  - The table was renamed back; the administrator's read answered 200 and left a
    fourth row, this one carrying the round id. The three earlier rows were still
    there, which is the phase's name.

### Failed

None.

### Blocked or not run

- **The deployed runtime.** Nothing was deployed and the migration was not
  applied there.
- **A real Google sign-in**, for the same reason as phase 1: no OAuth client
  exists.
- **`SETUP_SAVED`, `SURVEY_DEFINITION_UPDATED` and `AI_TRIGGERED` in the walk.**
  Covered by the suite and by inspection, not by the browser: the first needs a
  full setup payload, and the other two can close a round or dispatch an
  analysis, which would reach the paid provider for no evidence worth the money.
  `ROUND_CREATED` and `ROUND_STATUS_UPDATED` were exercised end to end.
- `npm run verify:core` end to end; the checks in it this diff can affect were
  each run and are listed above.

### Environment

Local. `next start` on port 3212 with throwaway secrets from
`.claude/launch.json`, against the local Docker database. The stand-in provider
is a scratchpad script and is not in the repository.

### Residual risk

- **The visit window is process-local.** Under several instances the same visit
  can be recorded once per instance. Over-recording, by choice.
- **A visit is recorded, not a page.** The row says an administrator opened a
  school, not which screens they read inside it, and after the first row the
  next fifteen minutes are silent. Reconstructing "what did they look at"
  needs the request log, not this table.
- **The name in the row is an identifier.** `manager_id`, plus the address in the
  details of a visit. A reader of the table needs `managers` to turn it into a
  person, and that row can be deleted.
- **Nothing reads the log through the product.** Until a screen exists, this is
  evidence somebody has to open a database to see.
- **The two membership actions are still unrecorded**, which matters the moment
  phase 2 lands: an invitation is exactly the kind of act this table is for.

## Known risks

An administrator can still read any school; what changed is that it is now
written down. Whether a school may see the visits made to it is undecided, and
until it is, the log protects the platform rather than the school.

## Approval gates

- Applying the migration to the deployed database goes with the push, and both
  are the owner's here.
- No new secret, credential or alias — the standing authentication gate is
  untouched by this branch.

## Questions requiring an owner decision

Who may read the audit log, and whether a school sees the visits made to it. The
plan says to decide it with the administrators; nothing on this branch waits on
it.

## Next concrete step

Push `feat/the-audit-log-survives-a-restart` — it carries phase 1 under it, so
one push lands both — and apply both migrations to the deployed database. Then
phase 2: the administrator area, school creation and invitations, which is what
anybody but the operator needs before they can be given a school.
