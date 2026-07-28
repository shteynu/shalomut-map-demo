# Shalomut Map — PROGRESS.md

Updated: 2026-07-28 (the depth branch is merged and deployed; privacy threshold 10 everywhere including the database; the database is empty again)

## Current State

- **Contract 5.0 is Live & Pushed**: Full Contract 5.0 implementation pushed to `main` (commits `84e5875` -> `01c3858`).
  - Score distribution (`green`, `yellow`, `red`) calculated and sent in `questionAggregates`.
  - 8-dimension context & per-question distribution included in LLM prompt.
  - Multi-sentence psychological interpretations (2–5 sentences) and generative `overallPsychologicalSummary` (2–4 Hebrew sentences) enabled.
  - KB expanded to 80 items with context-aware RAG ranking in Python AI service.
- **Automated tests** (branch `feature/ai-insights-depth-v5`, 2026-07-28): `npm test` 232/232 passed
  (231 before the threshold-default guard was added), `.venv/bin/python -m pytest` in `ai-analytics-service`
  169/169 passed, `npm run lint` 0 errors, `npm run build` compiled and generated 39/39 pages. Use the venv interpreter: the system `python3` has no
  pytest. On `main` the same suites stood at 202 and 107. The earlier "16/16" figure came from
  `run_tests.py`, which carried its own sixteen tests and never collected `tests/` — the full suite was in fact
  red (`test_rag_store.py`, broken by the catalog expansion) while that number was recorded. The sixteen now live
  in `tests/test_service_integration.py`, `run_tests.py` only forwards to pytest, and a root `conftest.py` makes
  a bare `pytest` work too.
- **Why the LLM never answered — settled, and fixed on a branch.** An owner-approved live provider call on
  2026-07-28 reproduced the `deterministic_fallback` on all eight stones of `SHALOM-F125` and named the cause:
  `gemini-*` are reasoning models, their thinking is charged against `max_tokens`, and the thinking is invisible
  in the response — it shows only as the gap between `completion_tokens` and `total_tokens`. Measured on
  `gemini-flash-latest`: at `max_tokens=420` the answer came back `finish_reason: "length"` with
  `completion_tokens: 16` against `prompt_tokens: 266` and `total_tokens: 682`, so 400 tokens went to thinking
  and the 16 returned were a fragment of it. At `2048`: `finish_reason: "stop"`, 1440 thinking tokens, 108
  visible, correct Hebrew. `MAX_TOKENS_PER_DIMENSION` now defaults to `2048`, and the live run returns
  `outcome=llm` on the first attempt for the interpretation (`4.0` and `5.0`), the round summary and the
  intervention adaptation. The model configured for the deployment (`gemini-3.5-flash`) was checked separately:
  ~1076 thinking tokens, so `2048` covers it too. Deployed since the merge below.
- **`feature/ai-insights-depth-v5` is merged and live (2026-07-28)**: PR
  [#11](https://github.com/shteynu/shalomut-map-demo/pull/11) squash-merged into `main` as `2be0708` at 12:51 UTC,
  carrying all 36 commits of the depth plan and the 2026-07-28 work. The merge deployed both halves at once:
  Vercel production `shalomut-map-demo-2lfgwm6he` is `● Ready` (35s) and holds the alias, and Render rebuilt the
  AI service by itself — `GET /health` reports `commit: 2be0708`, `env: production`, `privacyThreshold: 10`,
  `supportedContractVersions: ["1.0","2.0","3.0","4.0","5.0"]`. Read-only smoke: `/login/` `200`,
  `/api/rounds/` `401 JSON`.
  That is E2 steps 1 and 2 satisfied, though not in the ordered way the plan asked for — both halves went out
  from one merge. It is safe here only because Python accepts a superset of versions and Core emits `5.0` only
  when `AI_ANALYTICS_CONTRACT_VERSION` says so. The variable exists in both Production and Preview scopes; its
  value is encrypted and was not read this session, and the handoff records it as `4.0` since 2026-07-27.
- **Privacy threshold is 10 everywhere**, and since 2026-07-28 that includes the database. Code:
  minimum and default in Core, fallback and clamp in the Python service, declared threshold of contract `5.0`.
  Rounds configured below ten are raised rather than refused — a stored definition loads at ten, a payload below
  ten is read as locked, and the `round.privacyThreshold` column is only ever read through
  `effectivePrivacyThreshold`. **Owner decision taken 2026-07-28: migrate.** Migration
  `20260728120000_privacy_threshold_minimum_ten` puts the column default back to `10`, raises rounds below it and
  raises the `minimumResponses` their questionnaire snapshot quotes. Applied to the one database the same day —
  see the database bullet for the before/after values.
  While `SHALOM-F125` still existed the migration locked it immediately, because the then-deployed `main` read the
  column raw: until that point production served a full dashboard for a round answered by three people. The round
  has since been deleted with the rest of the data — see the database bullet.
- **Deployed runtime**: `https://shalomut-map-demo.vercel.app/` serves current `main`.
- **One database**: Supabase `tpfzhyalaftotljmlont` (`aws-1-ap-northeast-2`, Seoul) is the only database of the
  project. The deployed runtime, local `.env` and `prisma migrate` all resolve to it; all five migrations are
  applied and `privacy_threshold` defaults to `10`. The second project `fvnulyirrqjrnjbahmsn` was deleted by the
  owner on 2026-07-27; nothing referenced it. Never define a second `DATABASE_URL` in `.env.local`: Next.js
  prefers it over `.env` while migrations read `.env`, and the two drift apart silently.
  **The database is empty as of 2026-07-28**, cleared by the owner for manual testing: `0` organizations,
  `0` rounds, `0` responses, `0` question answers, no persisted insights. `prisma migrate status` still reports
  the schema up to date and the column default is `10`, so the next round a manager creates starts at ten in both
  the code and the row. `GET /api/survey/SHALOM-F125/` on the deployed app now answers `404` — the round is gone
  and empty persistence stays empty rather than inventing a demo round.
  The contents before the clear are dumped to `~/shalomut-db-backup-2026-07-28.json` (outside the repository,
  mode `600`): 1 organization, 1 round `SHALOM-F125` (`3173c065-aa01-470e-a54b-eb0e7669756b`), 3 responses,
  72 question answers and its `ai_insights` at contract `4.0` in full. With no PITR on the Free plan that file is
  the only way back.
  State read the same day, before the threshold migration: column default `1`; that round at threshold `1` with
  snapshot `minimumResponses` `1`; 3 answers on each question. After it: column default `10`, round threshold
  `10`, snapshot `minimumResponses` `10`; response and answer counts unchanged. Rollback of the migration itself,
  should it ever be wanted, is `ALTER TABLE "survey_rounds" ALTER COLUMN "privacy_threshold" SET DEFAULT 1;` and
  deleting the migration's row from `_prisma_migrations`; the row-level part no longer applies, since the rows are
  gone. The project is on the Supabase Free plan, so there is
  no PITR behind this: the recorded values are the whole safety net.
- **Two environments, local and deployed, since 2026-07-28** — see
  [local-environment.md](docs/local-environment.md). The local one is a Postgres container
  (`compose.yaml`, `127.0.0.1:5433`) plus `npm run local`, which is the whole environment in one command: it
  starts the Docker daemon when it is down and `colima` is installed, brings the container up, applies the
  migrations, and only then starts the core on `:3000` and the AI service on `:8000`, handing the service its
  configuration from the repository-root `.env`. Ctrl-C stops the two services and leaves the database running;
  `docker compose down` ends it. Verified from a removed volume: all five migrations applied, then both halves up.
  The wiring matches the deployment rather than relaxing it: the three shared secrets are required on both sides,
  the provider key and contract version come from the same file, and the service runs with the new `ENV=local`,
  which is `production` minus one rule — its Data Layer may be on loopback. Deliberate differences: `next dev`
  instead of a production build, and `admin123` when `MANAGER_ADMIN_PASSWORD` is empty.
  `.env` now points at the local container; the deployed database credentials moved to `.env.deployed.local`, and
  a deployed migration needs its URL passed on the command line. Proven end to end on 2026-07-28: manager login,
  seeded round of twelve responses, `trigger-ai` → `202` → MCP callback into the local core → `outcome=llm` on
  `gemini-flash-latest` before the free-tier quota answered `429`.
- **Single deployed environment**: `https://shalomut-map-demo.vercel.app/` is the only product URL.
- **Manager organization scope**: `MANAGER_ORGANIZATION_ID` is `34d05e66-fa4d-4a07-a2af-c9d5c41b6088` in both
  Vercel Production and Preview. The organization it names was deleted with the rest of the data, and that is
  survivable rather than broken: `PUT /api/manager/setup` writes the server-owned scoped id
  ([`setup/route.ts:182`](src/app/api/manager/setup/route.ts:182)) and the service creates the organization under
  exactly that id when none exists ([`manager-setup.service.ts:56`](src/lib/services/manager-setup.service.ts:56)),
  so the first setup after the clear recreates `34d05e66-…` and the variable keeps pointing at the right row.
  `organizationId` is embedded in the signed session at login, so a session issued earlier keeps its old
  organization for up to 24 hours.

---

## Next Up

1. [x] Deploy updated Python AI service container to Render to serve Contract 5.0 endpoints — live and current:
       `GET https://shalomut-ai-analytics.onrender.com/health` on 2026-07-28 returns `commit: 2be0708` and
       `supportedContractVersions: ["1.0","2.0","3.0","4.0","5.0"]`. Render rebuilt itself off the merge.
2. [ ] Finish the E2 deploy order for `5.0`
       ([ai-insights-depth-plan-2026-07-27.md](docs/ai-insights-depth-plan-2026-07-27.md), section
       "Продолжение"). Steps 1 and 2 landed with the merge of PR #11 — Python is deployed and `/health` was read.
       **Step 3 is open**: set `AI_ANALYTICS_CONTRACT_VERSION=5.0` in Vercel Production and Preview; until then
       Core keeps producing whatever that variable holds today (recorded as `4.0`), which Python accepts, so
       nothing is broken — `5.0` is simply never sent. **Step 4 is open**: a live round, then
       `inspect-ai-provenance` on it to show `outcome: "llm"` on at least some stones. Before either: confirm the
       Render dashboard does not set `MAX_TOKENS_PER_DIMENSION` explicitly (neither `render.yaml` nor
       `.env.render.local` does, so the deployed `2048` default applies), and settle the Gemini quota — `429`
       arrives after a few calls on the free tier, and one live round is roughly 33 calls. Deploy the background
       webhook (item 6) before the live round: with the synchronous webhook still deployed, a real `5.0` round at
       `2048` tokens per dimension is likely to outlast the 30-second trigger timeout and be cancelled mid-run.
3. [x] Decide what the ten-respondent threshold means for rounds created before it — the owner chose the migration
       (2026-07-28). `20260728120000_privacy_threshold_minimum_ten` is applied to the one database: default `10`,
       `SHALOM-F125` raised from `1` to `10` in both the column and its questionnaire snapshot, verified read-only
       afterwards on the deployed respondent endpoint. That round has since been deleted with the rest of the
       data; the column default survives it and governs every round created from now on.
4. [ ] Sign in as a manager on the deployed app (needs the admin password, so the owner has to do it) and run the
       first setup against the now-empty database. That both proves `MANAGER_ORGANIZATION_ID` resolves — the
       organization is recreated under exactly that id — and gives a round to test with. A round needs ten
       responses, and ten on every analysed question, before the dashboard unlocks.
5. [x] Delete or pause the retired Supabase project `fvnulyirrqjrnjbahmsn` (completed by owner 2026-07-27; no runtime referenced it).
6. [x] Make the Python webhook answer `202` and process in the background — done 2026-07-28 in
       [`main.py`](ai-analytics-service/src/main.py). Authentication, configuration and event-type rejections stay
       synchronous; everything after them runs in a FastAPI background task, and a failure there is logged instead
       of raised, since the caller has already been answered. Measured locally against mock MCP and a local
       callback sink: `202` in `0.003s`, callback delivered `15.6s` later, `Background analytics finished` in the
       service log. Core needed no change — its trigger already reads any 2xx as `accepted` and answers `202`
       itself. The dashboard's "generate analysis" button no longer reloads immediately, since the result cannot
       be there yet; it now says the map will update within a few minutes, matching the round screen.
       **Deployed and verified 2026-07-28**: the owner pushed, Render rebuilt itself, and a read-only smoke
       returns `commit: 813c718`, `env: production`, versions `1.0`–`5.0`; an unauthenticated
       `POST /api/v1/webhook/events` still answers `401`, so the rejections that stayed synchronous still are.
7. [x] Extend the callback's round cross-check beyond `3.0`
       ([`ai-insights/route.ts`](src/app/api/rounds/[roundId]/ai-insights/route.ts)) — done in `c284caa`:
       `4.0` and `5.0` now go through `validateDynamicResultAgainstRound()` like `3.0`. Comparing the score
       distribution itself is still open and is slice D1 of
       [ai-insights-depth-plan-2026-07-27.md](docs/ai-insights-depth-plan-2026-07-27.md).
8. [ ] AI-generated proposed question flow (slice 3.1, on explicit user request).
9. [x] Empty the database for manual testing — done by the owner on 2026-07-28 and verified read-only afterwards:
       `0` organizations, `0` rounds, `0` responses, `0` answers, schema still up to date. The dump taken
       beforehand is at `~/shalomut-db-backup-2026-07-28.json` and is the only way back.

---

## Completed Tasks

- [x] **2026-07-28**: **The depth branch is merged, deployed, and the database is empty again**
  (PR [#11](https://github.com/shteynu/shalomut-map-demo/pull/11) → `2be0708`):
  - Squash-merged into `main` at 12:51 UTC with all 36 commits. One merge deployed both halves: Vercel production
    `shalomut-map-demo-2lfgwm6he` `● Ready` in 35s and holding the alias; Render rebuilt the AI service on its
    own, `/health` → `commit: 2be0708`, `env: production`, `privacyThreshold: 10`, versions `1.0`–`5.0`.
  - Read-only smoke after the merge: `/login/` `200`, `/api/rounds/` `401 JSON`,
    `/api/survey/SHALOM-F125/` `404`. The `404` is the point — the owner cleared the database, and empty
    persistence stays empty instead of falling back to a demo round.
  - Database verified empty from a separate read: `0` organizations, `0` rounds, `0` responses, `0` answers,
    `privacy_threshold` default `10`, `prisma migrate status` up to date.
  - Not done, and now the whole of what is left of E2: flip `AI_ANALYTICS_CONTRACT_VERSION` to `5.0` and prove
    `outcome: "llm"` on a live round.
- [x] **2026-07-28**: **One command for the local stack** (commits `9678f4a`, `9d04781`):
  - `npm run local` ([`scripts/local-stack.mjs`](scripts/local-stack.mjs)) starts Next on `:3000` and the Python
    service on `:8000` wired to each other, prefixes their output, passes a provider key through if the
    environment has one, and stops both on Ctrl-C. `--in-memory` runs the core on empty in-process repositories
    and touches no database. Preflight names a busy port or a missing virtualenv instead of failing obscurely.
  - Verified: `/login/` `200` and `/health` `200` from one start; a second start refuses with both busy-port
    messages; `SIGINT` stops Next, uvicorn and the runner.
  - Two local traps found on the way and recorded in the handoff: the producer falls back to contract `3.0`
    when `AI_ANALYTICS_CONTRACT_VERSION` is unset (now set to `5.0` in the gitignored `.env.local`), and
    `SHALOM-F125` is locked at 3 responses so no local run reaches the provider — hence
    [`scripts/local-unlocked-pipeline.ts`](scripts/local-unlocked-pipeline.ts), which builds a 12-response round
    in memory and drives the real Core MCP and the real Python pipeline over it: contract `5.0`, 24 aggregates,
    `status: success`, eight stones, Hebrew summary.
- [x] **2026-07-28**: **The database says ten as well** (commit `2ab601e`, migration
  `20260728120000_privacy_threshold_minimum_ten`):
  - The owner decided the open question in favour of migrating. `prisma/schema.prisma` puts the column default
    back to `10`; the migration raises rounds below ten and the `minimumResponses` their questionnaire snapshot
    quotes. Rounds are only ever raised, so a stricter threshold a manager chose survives.
  - Stale prose that still said "product default 1" corrected in `ROADMAP.md`, `PROJECT_CONTEXT.md`,
    `docs/source-of-truth.md`, `docs/openapi.yaml` and `public/openapi.json`. The OpenAPI schema fields already
    said `10`; only the descriptions disagreed.
  - New guard test: the default declared in `schema.prisma` must equal `MINIMUM_PRIVACY_THRESHOLD`. This drift
    happened once already, quietly, and reads clamp so nothing fails loudly. Fail-first confirmed — the test goes
    red against `@default(1)`.
  - Local gates: `npm test` 232/232, `npm run lint` 0 errors, `npm run build` 39/39 pages, `openapi.test.ts` 5/5,
    `npx prisma validate` and `npx prisma generate` passed, `git diff --check` clean. Python untouched, so pytest
    was not re-run.
  - Applied to the one database after confirming the target in Prisma's own output
    (`aws-1-ap-northeast-2.pooler.supabase.com:5432`, database `postgres`, schema `public`) and recording the
    prior values. `prisma migrate status` then reports up to date. Read-only verification after: default `10`,
    `SHALOM-F125` at `10` in column and snapshot, 3 responses and 3 answers per question unchanged.
    `GET https://shalomut-map-demo.vercel.app/api/survey/SHALOM-F125/` → `200` quoting `minimumResponses: 10`,
    which is the deployed app reading the migrated row.
  - Not done: the branch push (declined at the permission prompt) and the E2 deploy order, which needs the Render
    dashboard and a manager login.
- [x] **2026-07-28**: **Session on branch `feature/ai-insights-depth-v5` — the LLM answers for the first time,
  and the privacy threshold becomes one number** (commits `5f6ad5e`, `e971d33`, `fb85f11`, `3a7d7e7`, `9924c64`,
  `1f2be09`, plus the depth-plan slices `7c50129`…`70276f9`):
  - **Root cause of the eight fallbacks found by live call** — see Current State. `MAX_TOKENS_PER_DIMENSION`
    default raised to `2048`; live run returns `outcome=llm` on the interpretation, the summary and the adaptation.
  - **Validators no longer refuse well-formed Hebrew for its shape**: a period inside a decimal no longer splits a
    sentence, markdown and closing quotes are stripped before validation and the stripped text is what is stored.
    The Latin ban stays — it is what catches an English preamble — but every prompt is Hebrew now, scores print as
    integers and the status reaches the model as a colour-free label. Regression suite
    `ai-analytics-service/tests/test_llm_output_validation.py`.
  - **Privacy threshold 10 everywhere**, including the database column read path, with old rounds raised rather
    than refused.
  - **Distribution shown in the metric blob** (option B of the E3 proposal, owner-approved): counts in the helper
    line, an `aria-hidden` proportional bar repeating them, shown only at ten respondents or more.
  - **Verification**: `npm test` 231/231, `python3 -m pytest` 169/169, `npm run lint` 0 errors,
    `npm run build` 39/39 pages. Live provider call: local, one round's worth of synthetic aggregates, no
    database and no respondent data. Nothing pushed, nothing deployed.

- [x] **2026-07-27**: **Contract 5.0 Rollout (AI Analytics Informativeness)**:
  - Created specification [contracts/ai-analytics-v5.json](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/contracts/ai-analytics-v5.json) and TS/Python mirrors.
  - Updated Core producer to calculate and send `scoreDistribution` per question aggregate.
  - Updated Python AI service to enrich prompts, generate overall summary via LLM, and relax sentence checks to 2–5 sentences for Contract 5.0.
  - Expanded `interventions_kb.json` to 80 entries and added adaptive ranking in `store.py`.
  - Added dedicated smoke test suite `ai-contract-v5-smoke.test.ts`. All 202 TS tests and 16 Python tests passed. Commits pushed to `origin/main`.

- [x] **2026-07-27**: **Two bugs reported from the deployed app, and the database consolidation**
  (commits `744e7b4`, `af41b38`, `42778ab`, `c6bddae`, `610d951`, `210c213`):
  - **A respondent could answer a round only once per browser, ever.**
    [`survey-flow.tsx`](src/components/survey/survey-flow.tsx) kept the anonymous token in `localStorage` under
    the share code and never cleared it, so the submit endpoint's double-submission guard became a permanent
    device lock: every later attempt got "You have already submitted a response for this survey round."
    The token now belongs to one filling session — [`survey-attempt-token.ts`](src/lib/survey-attempt-token.ts),
    created lazily on submit, held in memory while the flow is mounted. A retry after a failed request is still
    de-duplicated; a new visit is a new response. The public thank-you screen offers an explicit
    "another response" action for a shared computer. Five unit tests plus an API test that persists two attempt
    tokens and rejects a replay of one.
  - **No AI analysis on any stone.** The stone pages already render the interpretation when it exists; the round
    simply had none. Read-only check of the served database: round `3173c065-…` (`SHALOM-F125`) had
    `ai_insights` and `ai_insights_updated_at` both `NULL`, and its single response was submitted
    2026-07-26T17:03:56 — a day before auto-dispatch-on-submit reached production. Nothing re-triggered it since,
    because the only trigger lived on the round screen. The "not created" and error states now offer a generate
    action wired to `POST /api/rounds/{roundId}/trigger-ai`, handling 409 and 504 separately.
    Confirmed later the same day by a read-only check: `SHALOM-F125` now carries 3 responses and a non-null
    `ai_insights`, so both the re-entry fix and the analysis path work end to end on the deployed runtime.
  - **Route loaders.** No segment had a `loading.tsx` while every manager screen renders on the server and reads
    persistence, so a navigation left the previous page frozen. Added
    [`route-loading.tsx`](src/components/layout/route-loading.tsx) and a `loading.tsx` for `/`, `/setup`,
    `/round`, `/survey`, `/dashboard`, the three dashboard sub-pages and `/answer/[shareCode]`.
  - **Missing migration applied to the served database** (explicit user approval). Target confirmed before
    applying: `tpfzhyalaftotljmlont`, `aws-1-ap-northeast-2.pooler.supabase.com:5432`, database `postgres`,
    schema `public`; `prisma migrate status` reported exactly one pending migration. After
    `prisma migrate deploy`, `survey_rounds.privacy_threshold` default went `10` → `1`, round `SHALOM-F125` kept
    its configured threshold `1`, and status reports up to date. DDL only, no row was modified. Rollback:
    `ALTER TABLE "survey_rounds" ALTER COLUMN "privacy_threshold" SET DEFAULT 10;` and delete the row from
    `_prisma_migrations`.
  - **`MANAGER_ORGANIZATION_ID` corrected** (explicit user approval) to `34d05e66-fa4d-4a07-a2af-c9d5c41b6088`
    in Vercel Production as a Sensitive variable, then `vercel redeploy` of the existing production deployment —
    the same `main` source, no local working-tree upload. Deployment
    `shalomut-map-demo-5lx9n5rmn` is Ready and carries the alias. Read-only smoke: `/login/` → 200,
    `/api/rounds/` → 401, `/api/survey/SHALOM-F125/` → 200, and `POST /api/auth/login/` with deliberately wrong
    credentials → `USER_NOT_FOUND` rather than `503 UNCONFIGURED`, which proves the mandatory variables resolve.
    That the value is the right organization can only be proven by a manager login and was not verified.
  - **Gates that were skipping real code.** `npm run lint` reported 37 errors from
    `.claude/worktrees/epic-bassi-a4fe18/.next/**` because the top-level `.next/**` ignore does not cover a
    nested worktree, and `npm test` matched only `*.test.ts`, so the eight component tests in
    `dashboard-semantic-quality.test.tsx` never ran. Both fixed; those eight tests pass.
  - Verified locally: `npm test` 194/194, `npm run lint` 0 errors, `npm run build` 39/39 pages. Local dev server
    on empty in-memory repositories (`DATABASE_URL` empty, no staging write): manager routes `307` to login,
    `/login/` 200, `/answer/NOPE/` 200, zero console and server errors.
  - **One database, and it is the connected one.** Two Supabase projects were reachable from local
    configuration. `tpfzhyalaftotljmlont` (`aws-1-ap-northeast-2`, Seoul) is what the deployed app reads and
    holds every real row; `fvnulyirrqjrnjbahmsn` held one empty organization and zero rounds. Local `.env` and
    `.env.local` pointed at the second one, and [`prisma.config.ts`](prisma.config.ts) reads `.env` through
    `dotenv/config` — that is the mechanism by which a migration with no explicit override reached the database
    the app never serves. `.env` now names the single project and is the only place that defines a database;
    `.env.local` deliberately defines none, because Next.js would let it override `.env` for the app while
    migrations kept reading `.env`. Proven by `npx prisma migrate status` with no override at all: host
    `aws-1-ap-northeast-2.pooler.supabase.com:5432`, "Database schema is up to date!". Previous values were
    kept in gitignored `.env.retired-fvnulyirrqjrnjbahmsn.bak` files. Deleting the retired Supabase project is
    left to the owner.
  - **Vercel Preview organization scope aligned.** Preview still carried `MANAGER_ORGANIZATION_ID=be9f184a-…`
    while `DATABASE_URL` is shared between Preview and Production, so Preview pointed at the one database with
    an organization that does not exist there. Set to `34d05e66-…`; both scopes now match.
  - Open, not addressed: the callback compares a dynamic result against the round only for `3.0`
    ([`ai-insights/route.ts`](src/app/api/rounds/[roundId]/ai-insights/route.ts)), so the `4.0` payload now in
    production skips the questionnaire-hash and Core-score cross-check; and the Python webhook is synchronous
    ([`main.py`](ai-analytics-service/src/main.py)), so a Core timeout at `AI_SERVICE_TIMEOUT_MS=30000` aborts the
    connection and uvicorn cancels the run before any callback is sent.

- [x] **2026-07-27**: **`MANAGER_ORGANIZATION_ID` is mandatory on a deployed runtime**
  ([`manager-auth-service.ts`](src/lib/auth/manager-auth-service.ts)):
  - Deleted the hardcoded fallback `34d05e66-…`, which pointed at an organization removed during an earlier staging
    cleanup. With the variable missing, a manager used to receive a session scoped to a non-existent organization and
    every screen looked empty instead of failing.
  - `resolveManagerOrganizationId()` returns the configured value, `null` on a deployed runtime without it, and
    `"local-dev-organization"` outside a deployed runtime. `isUnconfigured()` now covers it alongside `SESSION_SECRET`
    and `MANAGER_ADMIN_PASSWORD`, so `POST /api/auth/login` answers `503 UNCONFIGURED` even for correct credentials;
    `defaultAccounts()` is fail-closed on the same condition. The production build phase keeps the local fallback.
  - The three demo memberships were module-level constants frozen at import time and are now built per call from the
    resolved organization, which is what makes the variable readable at runtime.
  - Four new tests in [`manager-auth-service.test.ts`](src/lib/auth/__tests__/manager-auth-service.test.ts) cover the
    missing/blank variable (including `VERCEL_ENV=preview`), the trimmed configured value, the local-only fallback
    with a regression guard on the retired UUID, `UNCONFIGURED` when only the organization is missing, and the
    organization a deployed session is scoped to. Confirmed fail-first: the missing-variable case passes login on the
    previous code.
  - Verified locally: `npm test` 180/180, `npm run lint` 0 errors, `npm run build` 39/39 pages. Pushed to `main` as
    `f9b1c50` on 2026-07-27 at the owner's explicit request; Vercel builds every push to `main` automatically.
  - Deployed and smoke-tested: production deployment `shalomut-map-demo-o3os80zm4` is `● Ready` (39s) and carries
    the `shalomut-map-demo.vercel.app` alias. `GET /login/` → 200, `GET /api/rounds/` → 401 JSON, and
    `POST /api/auth/login/` with a deliberately wrong password → `401 INVALID_CREDENTIALS` — not
    `503 UNCONFIGURED`, which proves all three mandatory variables are present in the deployed environment.
  - Residual risk: sessions issued before this change stay valid up to 24h with the stale organization; the gate
    covers new logins only.

- [x] **2026-07-27**: **Deployment, migrations and the contract 4.0 rollout** (explicit user approval):
  - Pushed `9e15732` to `main`; Vercel built production deployment `dpl_EerCv593tZyLTE9kU2SVTAxY4eKX` (Ready, aliased).
  - `npx prisma migrate deploy` on the staging Supabase DB applied the two pending migrations. The DB was missing
    `survey_rounds.background_context` and `survey_rounds.survey_definition` entirely, so the deployed app could not
    save a round. At migration time: 1 organization, 0 rounds, 0 responses. Verified afterwards: both columns present,
    `privacy_threshold` default `1`, both rows in `_prisma_migrations`.
  - Fixed three defects found while preparing the 4.0 flip (`1f76622`): the dynamic parser ignored `4.0`, it rejected
    `privacyThreshold` below 10 (breaking contract 3.0 in production, since Core's default is now 1), and it dropped
    `backgroundContext`. Added Python tests 15 and 16, which fail on the previous code.
  - Added the running commit and accepted contract versions to the Python `/health` (`82c17f2`) so a consumer-first
    rollout can be proven from outside. Render redeployed and answered
    `{"commit":"82c17f2","supportedContractVersions":["1.0","2.0","3.0","4.0"]}`; only then was
    `AI_ANALYTICS_CONTRACT_VERSION=4.0` set in Vercel and the app redeployed.
  - Vercel env cleanup and `MANAGER_ORGANIZATION_ID` correction; six stale origin branches deleted with their tips
    recorded in `docs/shalomut-tracker-handoff.md`.

- [x] **2026-07-26 (evening)**: **Completion plan `docs/completion-plan-2026-07-26-evening.md` executed**:
  - **A1 — auto-trigger survives the response**: `POST /api/survey/[shareCode]/submit` schedules the dispatch with
    `after()` from `next/server` instead of a detached promise (with a try/catch fallback for non-request contexts).
  - **A2 — privacy threshold default 1 everywhere**: `DEFAULT_PRIVACY_THRESHOLD = 1`, `MINIMUM_PRIVACY_THRESHOLD = 1`,
    `prisma/schema.prisma` `@default(1)` plus an unapplied migration. Both manager screens warn explicitly below 5
    (`LOW_PRIVACY_THRESHOLD_WARNING`), because such an average describes individual respondents.
  - **A3 — one run per round + manual rerun**: `claimAiAnalysisRun` / `releaseAiAnalysisClaim` (a 2-minute lease on
    `aiInsightsUpdatedAt`, implemented as a conditional `updateMany`) make concurrent submissions dispatch a single
    webhook; `POST /api/rounds/{roundId}/trigger-ai` answers `409 already_running` while a run is in flight, and
    `/round` got an explicit `רענון ניתוח` button.
  - **B1/B4 — builder**: question cards freeze after the first response (all actions disabled, ids/texts read-only,
    Hebrew freeze notice); a new round starts as an empty draft and is promoted to `active` on save once the
    questionnaire covers all eight dimensions.
  - **B2/B3 — dialog**: full Tab/Shift+Tab focus trap, Escape close, focus restore to the trigger, backdrop close, and
    design-system markup (`question-dialog-*`).
  - **C1 — contract 4.0 consumer-first**: `AI_ANALYTICS_CONTRACT_VERSION` selects the produced version (`3.0` default);
    the school `backgroundContext` reaches the MCP payload and the Python prompt only on `4.0` and never for a locked
    round.
  - **C2/C3/C4**: audience is owned by `/setup` and mirrored read-only into the questionnaire (`src/lib/audience.ts`);
    round reset records a `ROUND_RESET` audit event and clears the persisted analysis; the dead HTTP Basic Auth code
    was deleted and the OpenAPI spec now documents `managerSession` instead of `basicAuth`.
  - **Regression found and fixed during the browser smoke**: with the new empty-draft rounds every manager screen
    crashed (`Invalid round survey definition: Enabled survey questions must cover all eight dimensions`), because
    `AnalyticsService.calculateDynamicRoundAnalytics` parsed strictly. An unfinished questionnaire now returns a
    locked result instead of throwing (two new tests).
  - **Verification (local)**: `npm test` 175/175, `npm run lint` 0 errors, `npm run build` 39/39 pages,
    `python3 ai-analytics-service/run_tests.py` 14/14, `openapi.test.ts` 5/5, plus a browser smoke on a dev server with
    in-memory repositories: empty draft builder → template load → save auto-activates the round → respondent submission
    dispatched exactly one `round_closed` webhook to a local listener (`after()` proven in a real runtime) → two further
    submissions and a manual rerun click produced **no** second webhook and a `409 already_running` note → freeze state,
    dialog focus trap (Tab wraps, Shift+Tab wraps back, Escape restores focus) → reset logged
    `{"audit":"ROUND_RESET",...,"deletedResponseCount":3}` and disabled the refresh button below the threshold.
  - **Not done (owner gates)**: nothing committed, pushed, deployed or migrated; `AI_ANALYTICS_CONTRACT_VERSION` still
    `3.0`.
  - **Follow-up on explicit user instruction**: the threshold `1` was afterwards propagated to *every* layer,
    including the Python fallbacks (`src/config.py` now reads `PRIVACY_THRESHOLD`, default `1`;
    `src/schemas/mcp_types.py`), `surveyInstrument.privacyThresholdDefault`, demo data, `PrivacyTooltip` and the
    OpenAPI / PROJECT_CONTEXT / ROADMAP descriptions. Accepted consequence: a payload without `privacyThreshold`
    no longer locks at 10 by default.

- [x] **2026-07-26**: **Global Privacy Threshold Floor 1 & Automatic AI Analytics Triggering**:
  - Set default & minimum allowed `privacyThreshold` to `1` across Core, setup forms, survey definitions, Python service docstrings, and `.agents/skills/shalomut-map/SKILL.md`.
  - Implemented automatic non-blocking AI analytics trigger in `POST /api/survey/[shareCode]/submit`: when survey response submission causes response count to reach or exceed `privacyThreshold` (for threshold = 1, on the 1st response), AI generation is automatically dispatched.
  - Added reusable server utility `src/lib/server/trigger-ai-analytics.ts` and automated integration test `submit-auto-trigger.test.ts`.
  - Full verification: `npm test` 169/169 passed, `python3 ai-analytics-service/run_tests.py` 13/13 passed.

- [x] **2026-07-26**: **Privacy Threshold Floor Lowered to 1**:
  - Lowered minimum allowed privacy threshold (`minimumResponses` / `privacyThreshold`) from 10 to 1 across `survey-definition.ts`, manager setup API (`route.ts`), `SetupForm`, `SurveyBuilderSettings`, and `survey-definition.test.ts`.
  - Full verification executed: `npm test` 168/168 passed, `npm run lint` 0 errors, `npm run build` 39/39 pages compiled.

- [x] **2026-07-26**: **Session Close — P0 Deployment Recovery & Basic Auth Sunset**:
  - **P0 Lazy Session Provider**: `JwtSessionProvider` instantiated lazily in `session-auth.ts` and `login/route.ts` so module loading never throws when manager secrets are absent. Respondent and machine routes operate without manager secrets.
  - **Vercel Secrets & Redeploy**: Configured `SESSION_SECRET` and `MANAGER_ADMIN_PASSWORD` in Vercel for Production & Preview. Deployed build `334db68` -> **Ready**. Tested live `GET /login/` (`200 OK`).
  - **HTTP Basic Auth Popup Sunset**: Completely removed `WWW-Authenticate: Basic ...` popup challenge header from `middleware.ts`. Set `DISABLE_BASIC_AUTH_FALLBACK="true"` in Vercel. Unauthenticated manager UI requests redirect to `/login` (307); API routes return 401 JSON. Removed dev credentials hint footer from `/login`.
  - **Builder Freeze & Draft Persistence**: Wired `isFrozen` in `SurveyBuilder` & `page.tsx`. Added `allowIncomplete: true` option in `parseSurveyDefinition` and `isSaveable` in `BuilderQuestionnaireValidation` to allow saving draft questionnaires before all 8 dimensions are populated.
  - **Dialog Focus & Accessibility**: Auto-focus on `textarea` and focus return on close in `QuestionEditDialog`.
  - **Full Verification**: `npm test` (168/168), `npm run lint` (0 errors), `npm run build` (39/39 pages), `python3 ai-analytics-service/run_tests.py` (13/13), live HTTP probes on `/login/` (200) and `/setup/` (307).

- [x] **2026-07-26**: **Consolidated to a single deployed environment** (explicit user approval): alias `shalomut-map-demo-ui-redesign.vercel.app` removed via `vercel alias rm` (URL now `404`; its preview deployment `dpl_FystEnZZ5rNPbJevXcNrfQmn83in` was not deleted and stays `READY`). The only product URL is `https://shalomut-map-demo.vercel.app/`, serving as staging for now; a separate production environment will be created later. `docs/openapi.yaml`, `public/openapi.json` and the environments section of `PROJECT_CONTEXT.md` updated accordingly. Verified with `openapi.test.ts` 5/5 and `vercel alias ls`.

- [x] **2026-07-26**: **UI Loading Indicators Added**: Added animated `Loader2` spinners and disabled states across all screens where backend API calls occur upon clicking buttons or forms (`/login`, `ManagerUserBar`, `RoundControls`, `SetupForm`, `SurveyBuilder`, `SurveyFlow`). Executed `npm test` (168/168 passed), `npm run lint` (0 errors), and `npm run build` (39/39 pages compiled).

- [x] **2026-07-26**: **6 Sequential Quality & Security Blocks Completed (P0 Auth, Lint/Build, AI Contract 4.0, UX & OpenAPI)**:
  - **P0 Auth Hardening**: `ManagerAuthenticationService` uses SHA-256 password hashing. Default `manager123` fallback account prohibited in deployed runtime. Returns HTTP status `503` (UNCONFIGURED) if mandatory secrets `SESSION_SECRET` or `MANAGER_ADMIN_PASSWORD` are absent in deployed runtime.
  - **Lint & Build Recovery**: Added `deleteMany` to `MinimalPrismaClient` contract. Removed synchronous `setState` in `useEffect` in `QuestionEditDialog`. `npm run lint` and `npm run build` pass with 0 errors.
  - **AI Context & Contract 4.0**: Added `contracts/ai-analytics-v4.json`. Passed school `backgroundContext` via Python parser, workflow, and `llm_provider`. Fixed `NameError` in `llm_provider.py`. Added `backgroundContextIncluded` flag in `generationProvenance`. Added unit tests in `ai-contract-v4.test.ts`.
  - **Product UX & Builder Improvements**: Setup form CTA redirects to `/survey/`. Survey builder numbers active (enabled) questions sequentially; hidden questions displayed without number (`-`). Implemented empty draft, clear questionnaire, load template, delete confirmation, and freeze state when responses exist. `QuestionEditDialog` updated with Esc key close, inline validation, and respondent preview.
  - **API & OpenAPI Sync**: Added `POST /api/rounds/{roundId}/reset` endpoint to `docs/openapi.yaml` and `public/openapi.json`. Synchronized `openapi.test.ts` integration tests.
  - **Full Verification**: Executed `npm test` (166/166), `npm run lint`, `npm run build`, `python3 ai-analytics-service/run_tests.py` (13/13), `openapi.test.ts` (5/5).

- [x] **2026-07-26**: **GitHub Pages retired, Vercel established as single web deploy target**:
  - `DELETE /repos/shteynu/shalomut-map-demo/pages` -> `204`, `has_pages: false`.

- [x] **2026-07-26**: **Manager UI auth & Basic Auth sunset preparation**:
  - Auth API routes `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
  - `/login` page and `ManagerUserBar`.

