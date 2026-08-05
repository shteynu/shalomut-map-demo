# Shalomut Tracker — operational handoff

Updated: 2026-08-05 (the ADR-002 amendment rule settled and first used, for
metric-narrative provenance; `origin/main` is `67048b5` and both services are
deployed from it). This
document owns only cross-task operational/deployed
state, external blockers and approval gates. Product milestones belong in
`PROGRESS.md`; branch work and exact verification belong in
`docs/agent-tasks/{active,archive}/`; older snapshots remain available in Git.

## Repository snapshot

- `origin/main` is `67048b5`. Two branches reached it on 2026-08-05, pushed by
  the owner: `docs/adr-002-additive-fields` (the ADR-002 amendment clause) and
  `feat/metric-narrative-provenance` on top of it (the clause's first use). Both
  are fully contained in `main` and can be deleted; their task files are in
  `docs/agent-tasks/archive/`.
- Verification at that tip on 2026-08-05: `npm run verify:core` exit 0 with 565
  TypeScript tests, and `npm run verify:ai` exit 0 with 446 Python tests.
  `verify:db` was **not** run — neither branch touched a schema, a migration or
  a repository.
- Observable wire change, additive: `generationProvenance.metricInsightsOutcome`
  on contract `6.0`. Documented in `docs/openapi.yaml` along with
  `unavailableReason` and the `unavailable` outcome, which the partial-map work
  had put on the wire without documenting; `public/openapi.json` was
  regenerated.
- No branch is waiting to reach `main`.
- Earlier the same day `origin/main` was `55d1eea` — `260e84e` plus its docs
  close-out. Five AI-harness slices reached it
  on 2026-08-04, each as a fast-forward the owner pushed themselves:
  `feat/offline-eval-corpus`, `fix/label-deterministic-fallback`,
  `feat/v6-partial-maps`, `feat/partial-map-banner` and `feat/gap-reason`. All
  five branches are fully contained in `main` and can be deleted; their task
  files are in `docs/agent-tasks/archive/`.
- Verification at that tip on 2026-08-04: `npm run verify:core` exit 0 with 561
  TypeScript tests, and `npm run verify:ai` exit 0 with 439 Python tests.
  `verify:db` was **not** run across these five slices — none touched a schema,
  a migration or a repository.
- Earlier snapshot, superseded: `origin/main` was `26f4c37` and published. Seven slices reached it on
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
- Deployment was confirmed at this tip on 2026-08-05; the evidence is under
  `Next operational check` below. Everything above it that reads as undeployed
  is an older snapshot kept for history.

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
  cascading foreign key to `survey_rounds`. The table holds no rows.
- The tenth migration, `20260804190000_add_round_updated_at`, was applied to the
  deployed database on 2026-08-04: `prisma migrate status` reports ten
  migrations and a schema that is up to date. It adds the nullable
  `survey_rounds.updated_at` that carries the manager screens' save time across
  a reload. The deployed round has `updated_at NULL`, so its setup screen shows
  no save time until someone saves once — the documented behaviour for a round
  written before the column existed. No migration is pending.
- **`npm run db:migrate:deploy` targets the local database, not the deployed
  one.** It reads `.env`, which points at local PostgreSQL on purpose. The
  deployed database is reached by passing `DIRECT_URL` from
  `.env.deployed.local` as `DATABASE_URL`. This cost a broken deployment on
  2026-08-04: the push went out, the migration was run against local, reported
  success, and every round read on the deployed app returned 500 until the
  migration reached Supabase.
- Sequencing rule this leaves behind: the build command runs `prisma generate`,
  not `prisma migrate deploy`, so a schema change must reach the deployed
  database **before or immediately after** the push. Prisma selects the model's
  columns by name, so in between, every read of the changed table fails rather
  than falling back. The discriminating check when it happens: the previous
  deployment's own URL still answers correctly while the Production alias
  returns 500 — same database, so the difference is the schema the new build
  expects.
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
- A durable run still refetches the round's aggregates instead of owning an
  immutable snapshot, so a response landing mid-analysis fails the callback with
  `round_validation_failed`. Since 2026-08-04 the automatic path retries that
  one failure up to three runs per round (`PROJECT_CONTEXT.md` ADR-016); before
  that a single late response left the round with no analysis and no signal.
  The new `ai_jobs_rearmed` operational metric counts the retries. **Its rate is
  the evidence for whether to build the immutable input snapshot**, which is
  Phase 1 of the AI harness improvement plan the owner is holding outside the
  repository.

- On contract `6.0` a silent provider does not fail a dimension: the structured
  summary and the metric narratives fall back to aggregate-derived copy and the
  round is reported `success`. Since 2026-08-04 that is disclosed rather than
  implicit — ADR-007 now describes it, the dimension screen tells the manager
  no model wrote those paragraphs, and every accepted map emits
  `ai_deterministic_summary_ratio_sample`. **Read that share before reading any
  round as evidence about the prompts**; on a rate-limited key it is close to 1
  while `ai_jobs_succeeded` looks healthy.
- Since 2026-08-04 `6.0` also declares `supportsPartialMaps`, and what produces
  a gap is repair exhaustion rather than a silent provider: when the budget is
  spent and every refusal left is one dimension's own copy, that dimension is
  reported as a stated gap instead of the round failing whole. Gated on the
  capability, so `5.0` behaves the same way.
- Since 2026-08-04 the map sidebar carries a notice naming the dimensions a
  round has no interpretation for, so a partial map is visible without opening
  the dimension that is missing. It also says which cause left each dimension
  without words: the gap carries `generationProvenance.unavailableReason`, and
  the notice and the dimension screen give different advice for the two — retry
  in a few minutes for a silent provider, retry for a different wording when
  this service refused its own copy. Rounds analysed before 2026-08-04 carry no
  reason and get a sentence that claims neither.
- Since 2026-08-05 the metric narratives are covered too:
  `generationProvenance.metricInsightsOutcome` says whether the model or this
  service wrote them, separately from the overview, and the metrics screen says
  so in Hebrew when they are derived. One value per dimension, because one call
  writes all of its narratives. The operational half is
  `ai_deterministic_metric_narrative_ratio_sample`, and a round that recorded
  nothing emits no sample rather than counting as model-written — **read it
  beside the summary ratio, not instead of it**: a key that answers the short
  prompt and times out on the longer one shows a healthy summary ratio and
  derived narratives underneath.
- The same slice documented `unavailableReason` and the `unavailable` outcome in
  `docs/openapi.yaml`, which the partial-map work put on the wire and never
  wrote down. `public/openapi.json` was regenerated.

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
- **The offline eval corpus has never scored real provider output.** The
  configured Gemini key is free tier —
  `GenerateRequestsPerDayPerProjectPerModel-FreeTier`, 20 requests per day per
  model — and a full corpus run needs roughly 140. The owner's decision on
  2026-08-04 is to wait for a key with paid quota rather than spread the run
  across days. Until then `ai-analytics-service/evals/` is a tool with no
  baseline; run it with
  `.venv/bin/python -m evals.run_corpus --out DIR` and check provenance before
  reading any report, per `evals/README.md`.
- **Settled 2026-08-05, no longer a gate.** The two amendments published
  contract `6.0` took on 2026-08-04 — `supportsPartialMaps` and
  `generationProvenance.unavailableReason` — stood against ADR-002's rule that
  released semantics do not change. Owner decision: ADR-002 gains the explicit
  clause rather than `7.0` being opened. A published contract may gain an
  optional additive field and nothing else, on five conditions ADR-002 now
  states, of which the load-bearing two are that absence keeps the version's
  previous meaning and that the consumer accepts before the producer emits.
  Both amendments meet them. The rule rests on validation that checks known
  fields without enumerating keys, so a validator that ever starts rejecting
  unknown keys revokes it. `docs/ai-contract-version-matrix.md` carries the
  operational form under "Amending a published version".

## Next operational check

Before the next deployment-sensitive task, compare `origin/main` with deployed
Core and Python source/health, then record only fresh read-only evidence in the
new branch task file.

**Both services were read on 2026-08-05 and both are on the tip**, which closes
the check that had stood open since `233f905`. Read-only, nothing changed:

- **Python (Render):** `GET https://shalomut-ai-analytics.onrender.com/health`
  answers `commit: 67048b5` — the current `origin/main` — with
  `supportedContractVersions` `1.0`–`6.0`, `env: production`,
  `privacyThreshold: 10` and `jobPollingEnabled: true`. The service auto-builds
  from `main`; no manual redeploy was needed or is pending.
- **Core (Vercel):** the Production alias `shalomut-map-demo.vercel.app` holds
  `dpl_3Zbn5Zj4Gkn57o8GaKFe3ha3yLqT`, `READY`/`PROMOTED`, built from `main` at
  `67048b5`. Read from the projects API in the owner's own signed-in Chrome; no
  secret value was displayed or needed, and nothing was clicked.

So the contract amendment of 2026-08-05 is live on both sides. What that is
**not** evidence of: no round has produced `metricInsightsOutcome` against a
real provider yet. Deployed code, not deployed behaviour.

`GET /api/health` on Core is behind the login redirect, so the deployed
producer/supported versions cannot be read anonymously. Reading them means
signing in, which is the owner's action — see the functional check below.

The last actual reading before this, now superseded, was: **deployed Core is not behind
`main`**, checked read-only on 2026-08-04 after the tracked-goals push: the GitHub integration builds every push to `main`, and
the deployment holding `shalomut-map-demo.vercel.app` is
`dpl_HFYRvMxBp6uq5LvrvkRkCxEhRfgT`, ready, built from `main` at `233f905` — the
current tip. Everything merged today is live, and no manual redeploy is ever
pending. Earlier snapshots of this document claimed a ten-slice lag; that was
written before those deployments finished and is superseded. Later the same day
the alias moved on with the persisted save time and its close-out docs; the
Production deployment was built from `f883035`.

What the deployed endpoint therefore already does: activating a round closes
whichever round that school was running (`PROJECT_CONTEXT.md` ADR-014), and the
deployed database now refuses a second active round rather than trusting the
service to close the first.

**The functional half of this check is done, 2026-08-04.** It had stood open
because every manager route redirects to `/login`. The owner signed in
themselves in their own Chrome and handed the session over; the agent never saw
or typed the credentials, and that remains the rule.

What was exercised on `shalomut-map-demo.vercel.app`, signed in:

- Setup, builder, round tracking and the dashboard all render real persisted
  data. The stone map is unlocked at ten responses against a threshold of ten,
  with all eight dimensions, statuses carried by words as well as colour, and no
  respondent-level detail anywhere.
- The persisted save time end to end: saving on the setup screen showed
  "נשמר בשעה 14:43", a full reload kept it — server-rendered from the column,
  not tab state — and the builder showed the same time, because both screens
  read one `updated_at`.
- The round's `updated_at` was then set back to `NULL` so the deployed data is
  as it was, and both screens correctly went back to showing no save time. The
  round itself was rewritten only with the values it already held.

This is behaviour, not deployment metadata. What still needs the owner is the
sign-in itself, so plan a deployed functional check as something done together.

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
