# Tracked goals from recommendations (backlog §5, minimal version)

## Metadata

- Branch: `feat/round-goals`
- Base branch: `main`
- Base commit: `2a1f284` (the docs close-out for the previous three slices)
- Current HEAD: `5f3693c`
- Status: implementation complete and verified; not pushed
- Last updated: 2026-08-04
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Answer the last open product decision in the backlog — whether recommendations
stay read-only guidance or become tracked goals — in the smallest form that
makes "tracked" true.

## User-visible outcome

Under the recommendations stage of a dimension, a panel lists that dimension's
current recommendations. Each row has one action: track it as a goal. A tracked
row gains three states — `נבחר → בתהליך → הושלם` — and a way to stop tracking.
A goal the current analysis no longer recommends stays in the list, marked as
chosen from an earlier analysis.

## Context

The owner asked for the minimal version explicitly: "давай минимальную версию",
after being told the alternative was a change-management system with owners,
due dates and reminders.

## Scope

`round_goals` table and migration, repository port with a Prisma and an
in-memory adapter, `RoundGoalService`, four endpoints, the OpenAPI source, the
goals panel and its client/hook, and tests at every level.

## Non-goals

- An owner, a due date or a plan of steps on a goal.
- Reading goals across rounds, or beside a dimension's round-over-round delta.
- Any AI involvement: goals are copied text and manager decisions only.

## Acceptance criteria

- A recommendation can be tracked, moved through the three states, and dropped.
- A tracked goal survives a reload and a re-run analysis.
- The same recommendation cannot become two goals.
- No respondent data reaches a goal.

## Relevant repository instructions

`AGENTS.md` branch-scoped task state, the three `.agents/skills/shalomut-*`
skills, and the documentation lifecycle in `docs/README.md`.

## Relevant architecture and contracts

`PROJECT_CONTEXT.md` ADR-008 (repository boundary and composition root), ADR-011
(the Dashboard renders a DTO), ADR-012 (`docs/openapi.yaml` is the only editable
source) and the new ADR-015.

## Decisions made

- A goal copies the recommendation's title and body rather than referencing the
  analysis, because the next run rewrites recommendations wholesale.
- Identity is `(round_id, dimension_id, title)`, unique in the database. The AI
  payload gives a recommendation no id, so the title is all there is.
- Dropping a goal deletes the row instead of adding a fourth state, which also
  frees the recommendation to be chosen again.
- Round reset deletes goals. It does not re-run the analysis; it declares that
  the round measured nothing.
- The service does not check a goal's text against the current analysis: the
  analysis can be re-run between the screen rendering and the button being
  pressed, and refusing then would punish the manager for the provider's timing.

## Assumptions

- One manager per deployment (ADR-013), so no per-user attribution is needed on
  a goal.

## Completed

Everything in Scope. Two commits:

- `c15e893` — schema, migration, repository port and both adapters, service,
  four endpoints, OpenAPI, reset behaviour, service/route/PostgreSQL tests.
- `5f3693c` — the goals panel, its client module and hook, `goal-rows`, styles,
  and the client/row tests.

## In progress

Nothing.

## Remaining

The owner pushes the branch, then applies the migration to the deployed
database.

## Changed files

See `git diff main...feat/round-goals --stat`. New modules of note:
`prisma/migrations/20260804170000_add_round_goals/`,
`src/lib/types/round-goal.ts`, `src/lib/services/round-goal.service.ts`,
`src/lib/repositories/{prisma,in-memory}/*round-goal*`,
`src/app/api/rounds/[roundId]/goals/`, `src/lib/round-goals-client.ts`,
`src/lib/hooks/use-round-goals.ts`, `src/lib/dashboard/goal-rows.ts`,
`src/components/dashboard/dashboard-goals-panel.tsx`.

## Verification evidence

### Passed

- `npm run verify` at `5f3693c`, exit code 0: both fitness checks, typecheck,
  529 TypeScript tests, ESLint, production build; 18 PostgreSQL tests; 375
  Python tests.
- `prisma migrate diff --from-config-datasource --to-schema` against the
  migrated local test database: "No difference detected", so the migration and
  the model agree and a later `migrate dev` will not try to change the table.
- Browser, local dev server against the local PostgreSQL, round
  `round_local_1785676013225`, dimension `balance`: tracking a recommendation
  turned the row into a tracked goal with the three-state control; moving it to
  `בתהליך` was read back from the database as `status = 'in_progress'`; it
  survived a reload with that state; a goal inserted directly with a title the
  analysis does not recommend rendered last with the provenance note and its own
  state; removing both through the UI emptied the table and returned the rows to
  untracked. Checked at 1280x1000 and at 375x812.

### Failed

None.

### Blocked or not run

- The deployed endpoint was not exercised: the branch is not pushed and the
  migration is not applied there.
- Screen-reader output was not heard; only the markup and `aria-pressed` /
  group labelling were checked.

### Environment

Local Next.js dev server on port 3000 against the local PostgreSQL container;
`verify:db` against the disposable `shalomut_test` database on port 5433.

### Residual risk

Low. The one behaviour that only PostgreSQL can prove — two simultaneous
attempts at the same recommendation — is covered by
`postgres-round-goals.test.ts`, which runs in `verify:db`.

## Failed approaches

None worth recording.

## Known risks

The goals endpoints return 500 on the deployed environment until the migration
is applied there. The table is new and referenced by nothing else, so the order
of push and migration does not matter beyond that.

## Approval gates

None. The migration creates a new table on a design-stage database with no real
respondents.

## Questions requiring an owner decision

Whether a goal ever gains an owner, a due date or a plan of steps. Deliberately
left open; the backlog §5 entry records it.

## Next concrete step

Hand the owner the push command
`git push origin feat/round-goals:main`, then apply
`20260804170000_add_round_goals` to the deployed database with
`npm run db:migrate:deploy` and read the table back.
