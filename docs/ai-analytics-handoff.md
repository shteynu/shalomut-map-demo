# AI Analytics — handoff

> Status update, 2026-07-26: dynamic questionnaire contract `3.0` is implemented,
> GREEN, and deployed consumer-first while immutable `1.0`/`2.0` remain unchanged. Core uses the
> exact persisted round snapshot, Python accepts all three versions, and the
> callback/Dashboard preserve fixed eight-stone semantics with variable
> question metrics. The application release is `3e3f43f`: Vercel
> `dpl_3mfGbz5FiEfWABkfDx8iWTdB4Ris` is `READY`, Render
> `dep-d9iro1uk1jcs73f6kmh0` is `Live`, and GitHub workflow `30193485699`
> succeeded. Production readiness is not claimed.
> Broader operational state is tracked in
> `docs/shalomut-tracker-handoff.md`.

## Snapshot

- Current Git state: `main`/`origin/main` contain Python consumer `f1cd906`, Core
  consumer `6833cb2` and Core producer/survey UX `3e3f43f`, followed by this
  documentation checkpoint.
- Verified rollout sequence: `f1cd906` first (`dep-d9irlm6k1jcs73f6je50`,
  `dpl_CyDBdFHJhw5wPYy2ZwKtxEMbrcQR`, workflow `30193335363`), then `6833cb2`
  (`dep-d9irmvn41pts73aoi83g`, `dpl_AveukVTUW7Zr8iXeVmMng9CvSFuH`, workflow
  `30193418263`), then `3e3f43f` (`dep-d9iro1uk1jcs73f6kmh0`,
  `dpl_3mfGbz5FiEfWABkfDx8iWTdB4Ris`, workflow `30193485699`). All Render
  deployments are `Live`, all Vercel deployments are `READY`, and all workflows
  succeeded.
- Session baseline: clean start from `main@6555c34`. Consumer `82f7194` and
  producer `ba99a23` are published in `origin/main`.
- Original branch: `feature/ai-analytics-microservice-mcp`
- Merged to `main`: PR #4, merge commit `19401a6`
- Current AI hardening: `main` commit `7e0e1fd`
- Parallel follow-up: `35a190b` keeps `/api/mcp` dynamic so deployed requests
  retain the Authorization header.
- Current provider/latency commits: `38575e5` resolves provider from the
  credential source, `c8f9242` adds transient HTTP retry/backoff, `98b27c3`
  retries transport timeout once, and `a9b6c34` caps the full retry loop.
- Core production alias remains an operational staging endpoint. Workflow
  [30160539496](https://github.com/shteynu/shalomut-map-demo/actions/runs/30160539496)
  passed for `a9b6c34`; its manual production deployment job was skipped.
- Render AI implementation deployment: `dep-d9ij9unlk1mc739jao30`, `Live`,
  `https://shalomut-ai-analytics.onrender.com`.
- Shared secrets match across the two runtimes; raw values were neither printed
  nor committed. The obsolete preview URLs and placeholder Vercel bypass were
  removed from the actual Render configuration.
- Provider key exists only in deployed environment configuration; no raw value
  is tracked or recorded in this handoff.

## What is complete

### Contract and data boundaries

- `contracts/ai-analytics-v1.json` remains the immutable source of truth for
  legacy `1.0`; its semantics were not silently tightened.
- `contracts/ai-analytics-v2.json` publishes the breaking `2.0` boundary with
  the same eight canonical dimensions and exactly 24 required canonical
  questions. TypeScript, Python and OpenAPI load/describe both versions.
- `contracts/ai-analytics-v3.json` publishes the deployed breaking dynamic input:
  exact persisted question ID/text/count, deterministic snapshot hash and the
  same eight Core-owned dimension scores. `1.0`/`2.0` manifests have zero diff.
- TypeScript validates legacy `1.0` and strict `2.0` callback payloads before
  persistence. Python accepts missing/`1.0` input as legacy and explicit `2.0`
  input as strict, returning the effective input version.
- Privacy lock prevents stones from being generated or displayed below the
  configured response threshold. In `2.0`, locked input must also contain empty
  `dimensionScores` and `questionAggregates`.
- `docs/dashboard-semantic-contract.md` specifies the published `2.0` schema,
  compatibility rules and consumer-first rollout.
- `docs/dynamic-questionnaire-ai-contract.md` specifies the implemented
  boundary: actual questions come from the persisted round snapshot, while the
  eight dimensions and Dashboard result shape stay stable.

### Contracts `4.0` and `5.0`

> Added 2026-07-27. Both are implemented and green in both mirrors; neither has
> been deployed, and no production round has run on either. The rollout order
> and its evidence are an open owner gate, tracked in
> `docs/ai-insights-depth-plan-2026-07-27.md`.

- `contracts/ai-analytics-v4.json` is `3.0` plus the school background context.
  It reaches the prompt on `4.0` and `5.0` alike and is recorded in provenance
  as `backgroundContextIncluded`.
- `contracts/ai-analytics-v5.json` is `4.0` plus `scoreDistribution`
  (`{green, yellow, red}`) on every question aggregate: three non-negative
  integers summing to the question's `responseCount`, required while unlocked,
  forbidden while locked, and outside `surveyDefinitionHash`. It was amended in
  place on 2026-07-27 by owner decision, having never been deployed; `1.0`
  through `4.0` were not touched.
- What the distribution buys is the difference the average hides: ten lukewarm
  answers and a staff halved into green and red both average 60. On `5.0` the
  interpretation may run to five sentences, the round summary is model-written
  with the fixed sentence as fallback, recommendations are ranked by the shape
  of the answers, the chosen recommendation is rewritten for the school and
  declares `adaptationOutcome`, and provenance carries `distributionIncluded`
  and `crossDimensionContextIncluded` as measurements rather than claims.
- Core owns the distribution end to end: the service returns each metric's
  buckets exactly as they arrived, and the callback compares them against the
  analytics recomputed from the round's answers before persisting.
- The manifest's `privacy.defaultThreshold` now reads `1`, matching the
  database column, the Core default and the service. `recommendedThreshold: 10`
  states what the methodology asks for, and the manager screens say so whenever
  a round is configured below it.

### Python service

- The consumer accepts `1.0`, strict canonical `2.0`, and strict dynamic `3.0`.
  For `3.0` it validates unique IDs, supported dimensions, complete coverage,
  counts, score/status consistency and the shared questionnaire hash.
- Dynamic prompt, fallback, metrics and provenance use exact persisted text and
  same-dimension question IDs. Privacy-locked input short-circuits before any
  provider call.

- FastAPI webhook is the production entrypoint. The direct analyze endpoint
  exists only for `ENV=development` and returns `404` elsewhere.
- The webhook answers `202 Accepted` once the caller is authenticated and the
  runtime configuration checks out, then runs the round in an in-process
  background task. Authentication, configuration and event-type rejections stay
  synchronous. The `202` promises acceptance, not success: a later failure is
  logged by the service and reaches Core only as a missing callback.
- MCP client calls the core JSON-RPC endpoint and fails closed on transport
  errors unless `USE_MOCK_MCP=true` is explicitly enabled.
- The current runtime is an async graph-style workflow with a structured local
  intervention catalog. It does not currently execute LangGraph or ChromaDB.
- Recommendations are dimension- and status-scoped. The local OECD/ISO 45003
  catalog is Hebrew, covers all eight dimensions across green/yellow/red, and
  has eight green-only «חוזקה לשימור» supporting-action entries. Exact lookup
  no longer backfills from another status.
- Strict `2.0` provider validation requires `finish_reason=stop`, exactly two
  complete Hebrew-only user-facing sentences and score/status consistency.
  Malformed, truncated and provider-invalid output is rejected.
- Retries are bounded. Exhausted invalid output uses a deterministic fallback
  grounded in the dimension's three question aggregates, never in a generic
  score/status/risk template.
- Every `2.0` stone persists verifiable generation provenance:
  `llm` or `deterministic_fallback`, attempts/retry count and the three source
  question IDs.
- Runtime dependencies were reduced to the packages actually used by the
  service.
- Update, 2026-07-25 (commit `c0166e0`): the service ships as a container image
  built by the repository-root `Dockerfile`, targeting Cloud Run with Render as
  the fallback. The former `[tool.vercel]` block was not a Vercel convention
  and was removed; a Vercel deployment would additionally need an `api/`
  entrypoint that this package does not provide.
- Webhook processing and callback complete within the serverless request
  instead of relying on an in-process background task.
- Outside development, the webhook fails closed when `AI_WEBHOOK_SECRET` is
  missing or invalid.
- Outside development, startup additionally requires all three shared secrets,
  non-local `DATA_LAYER_MCP_URL`/`DATA_LAYER_CALLBACK_URL`, and
  `USE_MOCK_MCP=false`.
- Callback destination is derived only from `DATA_LAYER_CALLBACK_URL` and the
  URL-encoded round ID. Payload `callbackUrl` is accepted for compatibility but
  ignored; origin validation applies regardless of Vercel bypass.
- MCP configured URL is normalized to one trailing slash, and the callback
  target ends in `/ai-insights/`, preventing POST `308` responses from the
  Next.js `trailingSlash: true` deployment.
- Provider is inferred from the provider-specific credential variable, not
  from a secret prefix or model name. A neutral `LLM_API_KEY` outside
  development requires explicit `LLM_PROVIDER` or `LLM_BASE_URL`.
- Transient HTTP `408`, `429` and `5xx` failures use bounded exponential
  backoff; known hard-quota failures do not retry. Transport timeout retries at
  most once. Logs safely distinguish `llm`, `retry` and `heuristic` outcomes.
- One request may use up to `20s`; the full per-dimension loop is capped at
  `25s`; a retry starts only if at least `8s` remain.

### Core app and persistence

- Local `3.0` aggregation reads the exact `SurveyRound.surveyDefinition`,
  preserves custom/supplemental questions and text, and emits organization- and
  round-scoped dynamic aggregates only after total and every analyzed question
  meet the threshold.
- Question snapshots cannot change after the first accepted response. New
  rounds still start from the canonical 24-question default template.
- The `3.0` callback recomputes the snapshot hash and Core analytics before
  persistence, rejecting altered dimension scores/statuses, question labels,
  averages or response counts.

- `/api/mcp` exposes `tools/list` and `get_round_analytics`.
- `2.0` MCP output contains all 24 canonical question aggregates only
  when the total and every question meet the privacy threshold; otherwise both
  detailed maps are empty. Response data is filtered by exact round and
  organization ownership, and the former fabricated organization context was
  removed.
- `/api/rounds/[roundId]/trigger-ai` forwards `round_closed` events.
- `/api/rounds/[roundId]/ai-insights` validates, persists, and reads Stone Map
  payloads.
- Prisma fields `SurveyRound.aiInsights` and `aiInsightsUpdatedAt` are present.
- Migration `20260724170000_add_ai_insights` was applied with
  `npx prisma migrate deploy` to the database configured by `DIRECT_URL`.
- The database probe found `ai_insights JSONB` and
  `ai_insights_updated_at TIMESTAMP(3)`; migration status is up to date.

### Dashboard

- Deployed readers retain legacy `1.0`/`2.0` rendering and accept `3.0` variable
  metric counts with exact persisted question labels and aggregate facts.
- Survey builder supports stable ID/text/dimension edits and additions before
  collection, with Hebrew duplicate-ID and missing-dimension activation errors.

- Detail, metrics, and recommendations pages load AI insights by `roundId`.
- UI states are explicit: loading, ready, locked, not-found, and error.
- Browser scenarios were checked for ready, missing, and privacy-locked rounds.
- `2.0` UI uses all three real question metrics per dimension, renders the
  organization summary exactly once on overview and drops any explicit
  cross-status intervention.
- Green dimensions render `חוזקה לשימור` and `פעולות לשימור`, without
  improvement goals. Existing persisted `1.0` payloads remain readable.

## Verification evidence

- Current local `3.0` evidence: targeted TypeScript 82/82; `npm test` 131/131;
  full Python pytest 88/88 with one existing Starlette/httpx2 deprecation
  warning; dependency-light 13/13; OpenAPI integrity 5/5 plus independent
  JSON/YAML parse/sync; lint; typecheck; production build; immutable `1.0`/`2.0`
  diff check.
- RED-first tests reproduced canonical-only Core aggregation/text, Python
  exact-24 rejection and Dashboard three-metric assumptions before the fix.
- Local Next.js MCP → Python CLI → callback/persistence passed for separate
  8- and 11-question rounds, including exact custom text, fixed eight stones,
  variable metric counts, tamper rejection and all-or-nothing privacy lock.
- Local Playwright on an explicitly database-free in-memory runtime verified
  `/setup/`, both respondent questionnaires, unlocked metrics/recommendations,
  locked `9/10`, single summary and green preservation UX. No external write,
  webhook, migration, deploy or provider call was used.

- Consumer-first deployment: Render `dep-d9ij96mq1p3s73fhsncg` reached Live on
  `82f7194` before Core producer `ba99a23` was pushed.
- Final runtime association: Vercel
  `dpl_4eNSv1WpVvhjGBqgUCbbrBGuBbSe` is READY on `ba99a23` with production
  alias; Render `dep-d9ij9unlk1mc739jao30` is Live on the same commit. GitHub
  build runs `30177097867` and `30177151317` passed.
- Post-deploy read-only smoke: Render health HTTP 200, unauthenticated webhook
  HTTP 401 and unauthenticated Core HTTP 401. No real webhook/callback or data
  write was invoked.
- Current local semantic verification: `npm test` 109/109; full Python pytest
  65/65; `python3 ai-analytics-service/run_tests.py` 13/13; OpenAPI integrity
  5/5 plus independent JSON/YAML parse/synchronization; lint; production build;
  `git diff --check`.
- Local real-runtime Next.js → Python CLI → local callback E2E returned
  `contractVersion: 2.0`, 8 dimensions, 24 question aggregates, 8 stones,
  deterministic provenance and callback HTTP 200. No external callback or
  webhook was invoked.
- Local Playwright on an explicitly database-free in-memory runtime verified
  `/setup/`, unlocked overview/dimension/metrics/recommendations and a separate
  privacy-locked dashboard/API state. The three question metrics reached the UI,
  organization summary appeared once, green supporting actions were used, and
  browser console had 0 errors/0 warnings.
- TDD RED: both new regression tests received slashless MCP/callback URLs before
  the fix and failed with the exact URL mismatch.
- `npm test` — 81/81 pass on `a9b6c34`.
- `python3 ai-analytics-service/run_tests.py` — 13/13 pass.
- Full Python pytest — 35/35 pass, with one existing Starlette
  `TestClient`/httpx deprecation warning.
- `npm run lint` — pass.
- `npm run build` — pass, with a Next.js warning that the `middleware`
  convention will be replaced by `proxy`.
- Render deployment `dep-d9ibutgk1i2s73b2oolg` reached `Live` on commit
  `a9b6c34`; `/health` returned HTTP 200.
- Approved round `80e78f3e-1240-42d4-8a9e-23a3467bb650`: trigger `202`, MCP
  POST `200`, Render webhook `200`, callback POST `200`, persisted GET `200`.
- Persisted result has contract `1.0`, `status: success`, `isLocked: false` and
  all eight canonical dimension IDs.
- Render logs for the exact E2E window show four Gemini `outcome=llm`, all
  `attempt=1`, zero retry, zero heuristic and callback status `200`. Four green
  dimensions were intentionally skipped by the 0-token rule.
- Local read-only browser smoke opened the unlocked map plus detail, metrics,
  and recommendations pages. It also found the semantic failures above; the
  deployed Vercel SSO/Basic-auth browser chain was not re-tested.
- Targeted manager-context/setup/view-model tests passed `9/9`; they do not
  cover partial persisted JSON rendering or AI content quality.
- Historical pre-implementation RED evidence: TypeScript `91 passed / 10 failed`; Python
  `41 passed / 10 failed`. The failures reproduce absent question aggregates,
  locked placeholder detail, missing `finish_reason`/Hebrew/completeness checks,
  ungrounded fallback, status contradiction, generic metrics, weak callback
  validation and repeated overall summary. TypeScript compile, lint and build
  pass.
- Catalog GREEN evidence: targeted pytest `6/6` and
  `python3 ai-analytics-service/run_tests.py` `13/13` pass. JSON validation
  confirms 19 unique entries, eight green-only entries and exact 8×3 status
  coverage.
- No real secrets were committed.

## What remains

1. With an exact environment/round approval, verify a real custom-questionnaire
   `3.0` provider → callback → persistence path and a privacy-locked `3.0` path,
   including exact persisted text/provenance and empty locked maps.
2. Separate staging and production aliases/env; the current production alias
   is being used as a staging core endpoint and is not production-ready.
3. Implement application-level manager identity/roles and tenant authorization.
4. Decide separately whether the runtime should adopt real LangGraph/ChromaDB;
   this is not required for the current contract or local E2E path.
5. Deploy `5.0` in the consumer-first order and record what the first live
   round actually produced. The `deterministic_fallback` on all eight stones of
   `SHALOM-F125` is no longer an open question: an owner-approved live call on
   2026-07-28 reproduced it and named the cause. `gemini-flash-latest` is a
   reasoning model, its thinking is charged against `max_tokens`, and one
   interpretation spends about 1440 thinking tokens. Under the caps in force
   (`180`, later `420`) the budget was gone before the first Hebrew word: the
   provider returned `finish_reason: "length"` carrying a fragment of its own
   reasoning, the validator refused it, and all three attempts failed
   identically. The cap now defaults to `2048`, and the same call returns
   `outcome=llm` on the first attempt for the interpretation, the round summary
   and the intervention adaptation alike.

## Approval gates

- Do not rotate or copy secrets without the environment owner.
- Do not run a second migration against another database until its target is
  confirmed and a backup/PITR checkpoint is available.
- Do not change any provider key, billing, limits or provider configuration
  without explicit bounded approval.
- Do not invoke another real webhook without an explicitly selected
  environment and round; the completed approval covered only
  `80e78f3e-1240-42d4-8a9e-23a3467bb650`.
- Do not promote production until aliases/env are separated and the real LLM
  plus privacy-locked staging scenarios are verified.

## First next action

Obtain bounded approval for an exact staging environment and dedicated custom
questionnaire round, then verify unlocked and privacy-locked `3.0` persistence.
Do not invoke an external callback without an explicitly selected environment
and round.
