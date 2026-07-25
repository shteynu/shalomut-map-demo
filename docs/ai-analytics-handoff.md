# AI Analytics — handoff

> Status update, 2026-07-25: functional AI code is at `a9b6c34`; the later
> session-close slice changes core manager scoping and project memory, not the
> Python provider. Provider resolution is credential-source-aware, transient
> failures use bounded retry/backoff, and a per-dimension time budget leaves
> room for MCP and callback. One explicitly approved Gemini staging E2E
> completed with four `outcome=llm`, zero retry and zero heuristic fallback.
> Broader operational state is tracked in
> `docs/shalomut-tracker-handoff.md`.

## Snapshot

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
- Render AI deployment: `dep-d9ibutgk1i2s73b2oolg`, `Live`,
  `https://shalomut-ai-analytics.onrender.com`.
- Shared secrets match across the two runtimes; raw values were neither printed
  nor committed. The obsolete preview URLs and placeholder Vercel bypass were
  removed from the actual Render configuration.
- Provider key exists only in deployed environment configuration; no raw value
  is tracked or recorded in this handoff.

## What is complete

### Contract and data boundaries

- `contracts/ai-analytics-v1.json` is the shared source of truth for contract
  version `1.0`, eight canonical dimension IDs, and Hebrew labels.
- TypeScript validates callback payloads before persistence.
- Python loads the same manifest through `ai-analytics-service/src/contracts.py`.
- Privacy lock prevents stones from being generated or displayed below the
  configured response threshold.

### Python service

- FastAPI webhook is the production entrypoint. The direct analyze endpoint
  exists only for `ENV=development` and returns `404` elsewhere.
- MCP client calls the core JSON-RPC endpoint and fails closed on transport
  errors unless `USE_MOCK_MCP=true` is explicitly enabled.
- The current runtime is an async graph-style workflow with a structured local
  intervention catalog. It does not currently execute LangGraph or ChromaDB.
- Recommendations are dimension-scoped and use the OECD/ISO 45003 catalog.
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
- A later local Playwright audit against read-only staging persistence proved
  that structural validity is not content quality: `0/4` non-green
  interpretations fulfilled the requested two complete sentences, all four
  green dimensions received improvement recommendations, all `11`
  recommendation titles were English, and all eight metric sets repeated the
  same score/status/risk template.
- The current prompt receives only dimension score/status, the provider accepts
  any HTTP `200` text without checking `finish_reason` or completeness, the
  intervention fallback ignores status when an exact match is missing, and the
  UI appends the same overall summary to every dimension.

## Verification evidence

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
- No real secrets were committed.

## What remains

1. Define the dashboard semantic contract: Hebrew-only, grounded
   interpretations, question-level metrics, and status-aware actions. The
   recommended pending product decision is «חוזקה לשימור» for green instead
   of improvement goals.
2. Add privacy-safe aggregates for the 24 canonical questions to the Core
   Data → MCP request boundary; locked rounds must expose none.
3. Add strict versioned request/output/privacy models plus quality validation
   for `finish_reason`, completeness, Hebrew, status consistency and
   deterministic question-grounded fallback.
4. Localize the intervention catalog, remove cross-status fallback, and stop
   repeating the overall summary on every dimension.
5. Version and persist `llm` versus `heuristic` provenance; it currently exists
   only in service logs.
6. Verify a privacy-locked real round separately before broader rollout, after
   explicit bounded approval.
7. Separate staging and production aliases/env; the current production alias
   is being used as a staging core endpoint and is not production-ready.
8. Decide separately whether the runtime should adopt real LangGraph/ChromaDB;
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

Start locally with the independent `/setup/` partial-JSON regression fix. Then
write the dashboard semantic contract and failing quality tests before changing
the MCP or AI implementation. Do not invoke another real webhook: it still
needs an explicitly selected environment and round plus bounded approval.
