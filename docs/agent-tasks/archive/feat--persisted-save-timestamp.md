# The save time survives a reload

## Metadata

- Branch: `feat/persisted-save-timestamp`
- Base branch: `main`
- Base commit: `e7a2ea6`
- Current HEAD: `f883035`, merged into `origin/main` and deployed
- Status: complete, deployed and migrated
- Last updated: 2026-08-04
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the remaining half of `docs/product-behaviour-backlog.md` §1: the setup
screen and the survey builder show when the round last reached the database, and
that time survives a page reload.

## User-visible outcome

Reopening the setup screen or the builder shows the last save the database
recorded — "נשמר בשעה 13:59" for today's work, "נשמר ב־1 באוגוסט 2026 בשעה
13:59" when it is older — instead of nothing until the manager saves again in
that tab.

## Scope

- `survey_rounds.updated_at`, its migration and the Prisma model.
- `SurveyRound.updatedAt` through both repository implementations.
- The two save endpoints reporting the persisted value.
- The setup page and the survey page seeding the components with it.

## Non-goals

- Draft/version history or recovery beyond the latest persisted definition —
  the other, undecided half of §1, still open in the backlog.
- A per-organization save time; the round is what these two screens edit.

## Decisions made

- The column is nullable and not backfilled. A round written before it existed
  has no honest save time, and `created_at` answers a different question — when
  the row appeared, not when its questionnaire was last edited. Those rounds
  show no time, which is the same rule the screens already applied to a response
  without a usable time.
- `savedAt` in both responses is now the round's stored `updatedAt` rather than
  a `new Date()` next to the write, so the value the manager sees after saving
  and the value they see after reloading are the same one.
- In the builder, the activation write wins when completing the questionnaire
  put the round on the air — that write is the moment the round last reached the
  database.
- The line dates itself when the save is not from today. A stored time arrives
  with the page and can be days old; an hour alone would read as this morning's.
- Times are formatted in `Asia/Jerusalem` rather than the runtime's zone. The
  line is now server-rendered before hydration, so server and browser have to
  produce the same words, and the school day is the right frame for "at what
  time".
- The in-memory repository stamps `updatedAt` on create, update and status
  change, because the Prisma column is `@updatedAt` and a repository that let
  the caller decide would report a save time the deployed one had moved on.

## Assumptions

- The manager screens are the only readers of this column, so no consumer
  depends on it being non-null.

## Completed

- `9ea91aa` — the column, the migration, the domain field, both repositories and
  both endpoints.
- `c33957e` — both screens open with the stored time; the dated form and the
  pinned time zone; unit tests.
- `1443a20` — OpenAPI descriptions and the `SurveyRound.updatedAt` field, the
  regenerated `public/openapi.json`, and a PostgreSQL test for the stamping.
- `f883035` — `PROGRESS.md`, the handoff, backlog §1 and this file. The owner
  pushed the four commits to `main`; Vercel built `f883035` and it holds the
  Production alias.
- The migration reached the deployed Supabase database on 2026-08-04, on the
  second attempt. See the deployment incident below.

## Remaining

Nothing.

## Changed files

`prisma/schema.prisma`, `prisma/migrations/20260804190000_add_round_updated_at/`,
`src/lib/types/backend.ts`, both round repositories,
`src/app/api/manager/setup/route.ts`,
`src/app/api/rounds/[roundId]/survey-definition/route.ts`,
`src/app/setup/page.tsx`, `src/app/survey/page.tsx`,
`src/components/round/setup-form.tsx`, `src/components/survey/survey-builder.tsx`,
`src/components/ui/save-status.tsx` and its test,
`src/lib/services/__tests__/manager-setup.service.test.ts`,
`src/lib/repositories/__dbtests__/postgres-one-active-round.test.ts`,
`docs/openapi.yaml`, `public/openapi.json`, `PROGRESS.md`,
`docs/shalomut-tracker-handoff.md`, `docs/product-behaviour-backlog.md`.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0: both fitness checks, typecheck, 531 TypeScript
  tests, ESLint and the production build.
- `npm run verify:db` — exit 0, 19 PostgreSQL tests, including the new
  `every write stamps when the round reached the database`.
- Local browser evidence against `npm run local` with the seeded round:
  - `PUT /api/manager/setup` returned `savedAt` equal to the round's stored
    `updatedAt`, and `select updated_at from survey_rounds` held the same value.
  - A subsequent load of `/setup/` server-rendered
    `<time datetime="2026-08-04T10:59:52.939Z">13:59</time>` inside
    `p.save-status.save-status-saved`, and `/survey/` rendered the same time —
    the reload-survival this task is about.
  - With the row's `updated_at` moved back three days, the same screen rendered
    "נשמר ב־1 באוגוסט 2026 בשעה 13:59", so the dated form is real and not only
    unit-tested. The local row was saved again afterwards, so nothing is left
    artificially backdated.

### Failed

None.

### Blocked or not run

- `npm run verify:ai` — not run. The diff touches no contract, manifest, prompt
  or Python code.
- A pixel screenshot of the line. The Browser pane repeatedly returned a stale
  or blank viewport for this route; the evidence above is DOM and server-rendered
  HTML instead.
- Manager screens on the deployed app. Unchanged from the standing gate: those
  routes need the owner's credentials. The deployed round has
  `updated_at NULL`, so its setup screen would show no save time until someone
  saves once — the documented behaviour, not a fault.

### Deployed evidence after the migration

- `prisma migrate status` against the deployed `DIRECT_URL`: ten migrations,
  schema up to date.
- `GET /api/survey/NOPE-0000/` returns the domain `404` again on both the
  Production alias and the deployment's own URL; before the migration the same
  request returned `500`.
- `GET /api/survey/SHALOM-N74F/` returns the real active round, so a full round
  read — repository, `mapToDomain`, the new column — works on the deployed app.

### Environment

Local worktree at `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`,
local Postgres on `127.0.0.1:5433`, `shalomut_test` for `verify:db`.

### Residual risk

None outstanding. The risk this task recorded in advance did materialise; what
it cost and what prevents a repeat is in the incident below and in the handoff.

## Deployment incident, 2026-08-04

The deployed app returned `500` on every round read for roughly twenty minutes
after the push.

- Cause: `npm run db:migrate:deploy` reads `.env`, which points at local
  PostgreSQL on purpose. Run that way it reported success while applying
  nothing to Supabase, and the new build selects `survey_rounds.updated_at` by
  name.
- What identified it: the previous deployment's own URL still answered `404`
  while the Production alias answered `500`. Same database, so the difference
  was the schema the new build expects — not connectivity, credentials or the
  build.
- Fix: `DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy` with `DIRECT_URL`
  taken from `.env.deployed.local`. No alias change and no rollback were needed.
- Recorded in `docs/shalomut-tracker-handoff.md` so the next schema change
  sequences the migration against the deployed database itself.

## Failed approaches

- Driving the save button through the Browser pane. The pane clicked before
  hydration, which submitted the form natively, and later returned blank
  screenshots. Verification went through in-page `fetch` on the real endpoint
  plus server-rendered HTML instead.

## Known risks

Recorded above under residual risk.

## Approval gates

None outstanding. The push was the owner's; the deployed migration was applied
from this worktree with the owner's explicit instruction and the target
confirmed before the write.

## Questions requiring an owner decision

None.

## Next concrete step

None for this slice. The one commit this branch still holds beyond `main` is the
close-out documentation; hand its push to the owner
(`git push origin feat/persisted-save-timestamp:main`) and archive this file.
