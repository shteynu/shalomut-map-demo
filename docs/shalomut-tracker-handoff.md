# Shalomut Tracker — operational handoff

Updated: 2026-08-04 (four slices merged, deployed and migrated). This
document owns only cross-task operational/deployed
state, external blockers and approval gates. Product milestones belong in
`PROGRESS.md`; branch work and exact verification belong in
`docs/agent-tasks/{active,archive}/`; older snapshots remain available in Git.

## Repository snapshot

- `origin/main` is `26f4c37` and published. Seven slices reached it on
  2026-08-03/04, each as a fast-forward the owner pushed themselves — the agent
  cannot push in this environment, so every branch was handed over as a command:
  shared scoring bands, round selection on the dashboard, round creation with
  the one-active-round rule, the round comparison on the map, map keyboard and
  reduced-motion support, honest clipboard failure states, and the builder's
  search/bulk/reorder work. Their branches (`feat/shared-scoring-bands`,
  `feat/round-history-selection`, `feat/round-creation`,
  `feat/round-comparison`, `feat/map-accessibility`,
  `feat/copy-failure-states`, `feat/builder-efficiency`) are fully contained in
  `main` and can be deleted.
- Checkpoint evidence at `6d574b7`: `npm run verify:core` passed with 481
  TypeScript tests. `verify:db` and `verify:ai` were **not** run across these
  seven slices — none of them touched a schema, a migration, a contract version
  or the Python service.
- That gap is closed. On 2026-08-04 the full `npm run verify` passed with exit
  code 0 on `feat/one-active-round-index`: 481 TypeScript tests, both fitness
  checks, typecheck, ESLint, production build; 12 PostgreSQL tests; 375 Python
  tests.
- Three slices reached `main` on 2026-08-04 as `26f4c37`, pushed by the owner:
  the partial unique index behind the single-active-round rule
  (`feat/one-active-round-index`), the "last saved" line on setup and builder
  (`feat/last-saved-timestamp`), and the builder's keyboard accelerators
  (`feat/builder-keyboard-accelerators`). All three branches are fully contained
  in `main` and can be deleted; their task files are in
  `docs/agent-tasks/archive/`.
- `npm run verify` passed at the tip of each of those three branches on
  2026-08-04 — 481, 488 and 498 TypeScript tests as the slices added theirs,
  each run with 12 PostgreSQL tests, 375 Python tests, both fitness checks,
  typecheck, ESLint and the production build. The count at `main` is 498.
- Observable API change, additive: `PUT /api/manager/setup` and
  `PUT /api/rounds/{roundId}/survey-definition` now return `savedAt`. Both are
  documented in `docs/openapi.yaml`; the survey-definition `200` body had no
  documented schema before.
- Earlier snapshot, superseded: `origin/main` was `87027a5` after
  `feat/respondent-draft-and-consent`, which the owner pushed on 2026-08-03.
- **The local `main` is behind `origin/main` and cannot be updated from this
  checkout.** It is checked out in the worktree
  `shalomut-map-demo-contract-v6-core-consumer`. Fetch and fast-forward it
  there before branching from local `main`.
- The 2026-08-02 refactoring stack is merged and published: AI-insights
  repository, thin callback route, canonical Core input, canonical Python
  output, analytics-runner ports and `TextGenerator`.
- Two slices reached `main` on 2026-08-03 by fast-forward, not by merge commit:
  the OpenAPI single source (`7d60b59`, `ae19d0f`) and the single-manager
  identity decision (`3939555`, `d588b97`). Their branches
  `refactor/openapi-single-source` and `docs/single-manager-identity-decision`
  are published and now fully contained in `main`; they can be deleted.
- Checkpoint evidence at `63f668e`, the last code commit before the docs tail
  (2026-08-03): `npm run verify` passed with a real exit code 0 —
  `verify:core` with 429 TypeScript tests,
  both fitness checks, typecheck, ESLint and production build; `verify:db` with
  7 PostgreSQL integration tests; `verify:ai` with 368 Python tests. The
  respondent flow was additionally smoke-tested in a browser; the evidence is
  in `docs/agent-tasks/archive/feat--respondent-draft-and-consent.md`.
- The submit endpoint now answers a duplicate attempt with `409` and a typed
  `code`, not `400` with prose. This is an observable API change; the only
  known consumer is the questionnaire itself.
- Earlier checkpoint at `main` = `d588b97` (2026-08-03): the full
  `npm run verify` gate passed — `verify:core` with 359 TypeScript tests, both
  fitness checks, typecheck, ESLint and production build; `verify:db` with 7
  PostgreSQL integration tests; `verify:ai` with 368 Python tests. These are
  the same three commands the CI `validate` job runs on a push to `main`.
- `test/classify-surviving-mutants` reached `main` as `8f9c29d` and can be
  deleted.
- `feat/respondent-draft-and-consent` reached `main` as `87027a5`, carrying
  respondent consent, draft recovery, the submit `409` contract and this
  snapshot. It is fully contained in `main` and can be deleted.
- `origin/main` moved to `233f905` on 2026-08-04 with the tracked-goals slice
  (backlog §5, `PROJECT_CONTEXT.md` ADR-015), pushed by the owner.
  `feat/round-goals` is fully contained in `main` and can be deleted; its task
  file is in `docs/agent-tasks/archive/`.
- `npm run verify` passed at that tip on 2026-08-04 with exit code 0: 529
  TypeScript tests, 18 PostgreSQL tests, 375 Python tests, both fitness checks,
  typecheck, ESLint and the production build.
- Observable API change, additive: `GET`/`POST /api/rounds/{roundId}/goals` and
  `PATCH`/`DELETE /api/rounds/{roundId}/goals/{goalId}`, documented in
  `docs/openapi.yaml`. `POST /api/rounds/{roundId}/reset` now also deletes the
  round's goals and records `deletedGoalCount` in its audit entry.
- No branch is waiting to reach `main`. The docs close-out for the tracked-goals
  slice reached it as `6edb2df` on 2026-08-04.
- The repository record does not claim that this final refactoring stack has
  been deployed. Verify deployment source/health before relying on it at the
  deployed endpoint.

## Deployed state

- Supported product environments remain local and deployed only.
- Core endpoint: `https://shalomut-map-demo.vercel.app/`. Vercel names the
  target Production; for the product it is the design-stage operational staging
  endpoint.
- AI service: Render container from the root `Dockerfile`, with durable polling
  enabled. The service needs an always-available process or explicit wake
  mechanism; scale-to-zero alone is not a reliable worker.
- Database: the confirmed deployed Supabase PostgreSQL target contained all
  seven repository migrations after `prisma migrate deploy` and a successful
  follow-up `prisma migrate status` on 2026-08-02. The eighth,
  `20260804120000_one_active_round_per_organization`, was applied there on
  2026-08-04: `prisma migrate status` reports the schema up to date, and a
  read-back confirms `survey_rounds_one_active_per_organization` exists as a
  partial unique index on `(organization_id) WHERE status = 'active'`. No school
  held two active rounds when it was created, so the migration's cleanup step
  changed no row. The deployed database holds one round, and it is active.
- The ninth migration, `20260804170000_add_round_goals`, was applied there on
  2026-08-04: `prisma migrate status` reports nine migrations and a schema that
  is up to date, and a read-back confirms `round_goals` with its unique key on
  `(round_id, dimension_id, title)`, its `(round_id, created_at)` index and a
  cascading foreign key to `survey_rounds`. The table holds no rows. No
  migration is pending.
- No real respondents or production data exist. Database contents are
  disposable at this stage.

## Contract and AI runtime

- Contract `6.0` completed its consumer-first rollout. Deployed Python and Core
  support it, and deployed Core explicitly produces `6.0`.
- Unset Core configuration remains `5.0`, which is the rollback value. Core can
  produce `3.0`–`6.0`; callback/parser support spans `1.0`–`6.0`.
- The recorded deployed V6 round completed through durable claim, provider,
  callback, persistence and authenticated Dashboard rendering with eight
  stones, three summary paragraphs and five recommendations per stone.
- Runtime contract details and the rollout rule are canonical in
  `docs/ai-contract-version-matrix.md`; do not reconstruct them from old rollout
  plans.

## Operational invariants

- Confirm the database/environment before any write so work does not land on
  the wrong target. Clear, reseed, reset and migrations need no data-preservation
  ritual during the design stage.
- Keep respondent identity and sub-threshold details out of every manager and
  AI boundary.
- Deployed manager auth requires `SESSION_SECRET`,
  `MANAGER_ADMIN_PASSWORD` and `MANAGER_ORGANIZATION_ID`; machine boundaries use
  their own shared secrets.
- The deployed producer switch is configuration, not a silent fallback.
  Unknown contract versions fail closed.
- Parallel agents use separate branches, worktrees and active task files.

## External blockers and approval gates

- Before the first real respondents, rotate the four credentials previously
  exposed in a private design-stage transcript. This is an accepted deferred
  gate, not a blocker for local/docs work.
- Explicit bounded approval is required before changing secrets, credentials,
  authentication configuration or deployment aliases.
- No open migration decision remains in the repository record.

## Next operational check

Before the next deployment-sensitive task, compare `origin/main` with deployed
Core and Python source/health, then record only fresh read-only evidence in the
new branch task file.

**Deployed Core is not behind `main`.** Checked read-only on 2026-08-04 after
the tracked-goals push: the GitHub integration builds every push to `main`, and
the deployment holding `shalomut-map-demo.vercel.app` is
`dpl_HFYRvMxBp6uq5LvrvkRkCxEhRfgT`, ready, built from `main` at `233f905` — the
current tip. Everything merged today is live, and no manual redeploy is ever
pending. Earlier snapshots of this document claimed a ten-slice lag; that was
written before those deployments finished and is superseded.

What the deployed endpoint therefore already does: activating a round closes
whichever round that school was running (`PROJECT_CONTEXT.md` ADR-014), and the
deployed database now refuses a second active round rather than trusting the
service to close the first.

The functional half of this check is unfinished: every route the agent could
reach redirects to `/login`, so the read-only evidence above is deployment
metadata, not deployed behaviour. Exercising a manager screen needs the owner's
credentials.

The Core composition root and the Dashboard presentation DTO, which closed
stage 4 of the refactoring plan and the presentation half of stage 5, are merged
and deployed with everything else on `main`.

The long-term identity model is no longer the next architecture slice. Owner
decision 2026-08-03: one manager per deployment is the requested product shape,
so identity is requirement-gated future work — `PROJECT_CONTEXT.md` ADR-013 and
`docs/product-behaviour-backlog.md` §8. The SHA-256 password hash stays as it
is; it is derived from `MANAGER_ADMIN_PASSWORD` per login and never stored, so
replacing the algorithm alone would close nothing.

What this leaves standing as an operational item: the deployment secret is the
credential, so rotating it means a redeploy, and the open rotation of the
exposed design-stage credentials before the first real respondents is
unaffected by this decision.
