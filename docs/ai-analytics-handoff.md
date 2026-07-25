# AI Analytics — handoff

> Status update, 2026-07-25: canonical POST route fix `6473a88` is in `main`
> and `origin/main`; Vercel and Render deployments for that commit are live.
> A real Vercel → Render → Vercel transport/persistence E2E passed for one
> explicitly approved staging round. OpenAI returned `429` for four calls, so
> the pipeline completed through its heuristic fallback rather than proving the
> real LLM path. A later read-only account check localized the `429` responses
> as API quota/billing failure: the current API organization prompts to add
> credits and has no successful API usage. Broader operational state is tracked
> in `docs/shalomut-tracker-handoff.md`.

## Snapshot

- Original branch: `feature/ai-analytics-microservice-mcp`
- Merged to `main`: PR #4, merge commit `19401a6`
- Current AI hardening: `main` commit `7e0e1fd`
- Parallel follow-up: `35a190b` keeps `/api/mcp` dynamic so deployed requests
  retain the Authorization header.
- Current transport fix: `6473a88` canonicalizes MCP and callback POST routes
  to trailing-slash URLs required by the Next.js deployment.
- Vercel core deployment: `dpl_7FxfrtHYUdaKbD4AMVH6J7V4cx3j`, `READY`,
  production alias currently used as a staging endpoint.
- Render AI deployment: `dep-d9iamf3eo5us73cndcu0`, `Live`,
  `https://shalomut-ai-analytics.onrender.com`.
- Shared secrets match across the two runtimes; raw values were neither printed
  nor committed. The obsolete preview URLs and placeholder Vercel bypass were
  removed from the actual Render configuration.
- Session-memory update is kept in a separate local commit; no additional push
  is performed at close because it would trigger new production deployments.
- Read-only OpenAI Platform evidence shows an active `Shalomut` API key,
  no successful usage and `Add credits — Run your next API request by adding
  credits`. No key, billing, limit or provider setting was changed.

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

## Verification evidence

- TDD RED: both new regression tests received slashless MCP/callback URLs before
  the fix and failed with the exact URL mismatch.
- `npm test` — 81/81 pass on `6473a88`.
- `python3 ai-analytics-service/run_tests.py` — 13/13 pass.
- Full Python pytest — 15/15 pass, with one existing Starlette
  `TestClient`/httpx deprecation warning.
- `npx tsc --noEmit` — pass.
- `npm run lint` — pass.
- `npm run build` — pass, with a Next.js warning that the `middleware`
  convention will be replaced by `proxy`.
- OpenAPI JSON and YAML parse successfully.
- Vercel deployment `dpl_7FxfrtHYUdaKbD4AMVH6J7V4cx3j` reached `READY`;
  Render deployment `dep-d9iamf3eo5us73cndcu0` reached `Live`; both point to
  commit `6473a88`.
- Render `/health` and authenticated Vercel `/` returned HTTP 200.
- Approved round `80e78f3e-1240-42d4-8a9e-23a3467bb650`: trigger `202`, MCP
  POST `200`, Render webhook `200`, callback POST `200`, persisted GET `200`.
- Persisted result has contract `1.0`, `status: success`, `isLocked: false` and
  all eight canonical dimension IDs.
- Vercel error/fatal scan for the exact deployment and E2E window found no
  matching logs.
- Render recorded four OpenAI `429 Too Many Requests` warnings; the documented
  heuristic fallback completed the result. This is residual evidence, not a
  passed real-LLM check.
- Render logs show four green dimensions were skipped locally and four
  non-green dimensions called OpenAI concurrently. OpenAI Platform account
  state classifies these `429` responses as quota/billing failure rather than a
  demonstrated transient RPM/TPM burst.
- Session-close docs-only checks passed: `git diff --check` and relative
  Markdown link validation. Runtime suites were not run because code and
  configuration did not change.
- No real secrets were committed.

## What remains

1. After bounded approval, enable API billing/add credits for the correct
   organization/project and confirm a non-zero project budget.
2. Distinguish quota from transient rate limits in the provider, safely record
   error code/request ID, retry only transient throttling with bounded backoff,
   and expose `llm` versus `heuristic` provenance.
3. After the provider issue is resolved, repeat one explicitly approved round
   and prove the real LLM path without heuristic fallback.
4. Add strict request/output/privacy models and explicit fail-closed safety
   semantics as the next isolated AI-service change.
5. Verify a privacy-locked real round separately before broader rollout.
6. Separate staging and production aliases/env; the current production alias
   is being used as a staging core endpoint and is not production-ready.
7. Decide separately whether the runtime should adopt real LangGraph/ChromaDB;
   this is not required for the current contract or local E2E path.

## Approval gates

- Do not rotate or copy secrets without the environment owner.
- Do not run a second migration against another database until its target is
  confirmed and a backup/PITR checkpoint is available.
- Do not change OpenAI key, billing or limits without explicit bounded
  approval.
- Do not invoke another real webhook without an explicitly selected
  environment and round; the completed approval covered only
  `80e78f3e-1240-42d4-8a9e-23a3467bb650`.
- Do not treat the fallback-backed result as proof of real LLM generation.
- Do not promote production until aliases/env are separated and the real LLM
  plus privacy-locked staging scenarios are verified.

## First next action

Obtain bounded approval for the OpenAI API billing/credits change. Before the
next real webhook, harden provider error classification and provenance. After
an approved provider correction, repeat one bounded staging round E2E and
require logs that show the LLM path completed without heuristic fallback.
