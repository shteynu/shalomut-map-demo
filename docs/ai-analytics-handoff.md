# AI Analytics — handoff

> Status update, 2026-07-26: consumer `82f7194` and producer `ba99a23` are
> published in `origin/main`; Vercel implementation deployment
> `dpl_4eNSv1WpVvhjGBqgUCbbrBGuBbSe` is `READY`, and Render deployment
> `dep-d9ij9unlk1mc739jao30` is `Live` on `ba99a23`. `main` now implements the
> breaking shared contract `2.0` while preserving
> immutable `1.0`. Prepared TypeScript and Python semantic suites
> are GREEN, including 24 privacy-safe question aggregates, strict Hebrew and
> completeness validation, bounded retry, grounded fallback, persisted
> provenance and status-aware Dashboard UX. Consumer commit `82f7194` reached
> Render first; producer commit `ba99a23` then reached Vercel and Render. A
> session-close docs publish can create newer deployment IDs without changing
> the application runtime.
> The next approved product direction is a new breaking contract for dynamic
> round-scoped questions with the same fixed eight-stone Dashboard output;
> implementation has not started and `2.0` remains immutable.
> Broader operational state is tracked in
> `docs/shalomut-tracker-handoff.md`.

## Snapshot

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
- TypeScript validates legacy `1.0` and strict `2.0` callback payloads before
  persistence. Python accepts missing/`1.0` input as legacy and explicit `2.0`
  input as strict, returning the effective input version.
- Privacy lock prevents stones from being generated or displayed below the
  configured response threshold. In `2.0`, locked input must also contain empty
  `dimensionScores` and `questionAggregates`.
- `docs/dashboard-semantic-contract.md` specifies the published `2.0` schema,
  compatibility rules and consumer-first rollout.
- `docs/dynamic-questionnaire-ai-contract.md` specifies the next approved
  boundary: actual questions come from the persisted round snapshot, while the
  eight dimensions and Dashboard result shape stay stable. It is not yet a
  runtime contract.

### Python service

- FastAPI webhook is the production entrypoint. The direct analyze endpoint
  exists only for `ENV=development` and returns `404` elsewhere.
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

- Detail, metrics, and recommendations pages load AI insights by `roundId`.
- UI states are explicit: loading, ready, locked, not-found, and error.
- Browser scenarios were checked for ready, missing, and privacy-locked rounds.
- `2.0` UI uses all three real question metrics per dimension, renders the
  organization summary exactly once on overview and drops any explicit
  cross-status intervention.
- Green dimensions render `חוזקה לשימור` and `פעולות לשימור`, without
  improvement goals. Existing persisted `1.0` payloads remain readable.

## Verification evidence

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

1. Publish and implement a new breaking dynamic-questionnaire contract
   consumer-first. Keep `1.0`/`2.0` immutable and use exact persisted round
   question IDs/text in prompt, fallback, metrics and provenance.
2. With an exact environment/round approval, verify real staging unlocked and
   privacy-locked `2.0` paths, persisted provenance and empty locked maps.
3. Separate staging and production aliases/env; the current production alias
   is being used as a staging core endpoint and is not production-ready.
4. Implement application-level manager identity/roles and tenant authorization.
5. Decide separately whether the runtime should adopt real LangGraph/ChromaDB;
   this is not required for the current contract or local E2E path.

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

Start with RED tests for two different persisted round questionnaires, then
publish the new breaking contract skeleton and update the Python consumer
before the Core producer. Do not invoke a real webhook or external callback
without an explicitly selected environment and round.
