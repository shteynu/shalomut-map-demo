# AI Analytics — handoff

> Status update, 2026-07-25: AI callback/entrypoint hardening commit `7e0e1fd`
> is in `main` and `origin/main`; the parallel MCP dynamic-route fix `35a190b`
> was pushed on top of it. This session did not invoke push or deployment.
> Current staging, empty-runtime, and manager UI status is tracked in
> `docs/shalomut-tracker-handoff.md`.

## Snapshot

- Original branch: `feature/ai-analytics-microservice-mcp`
- Merged to `main`: PR #4, merge commit `19401a6`
- Current AI hardening: `main` commit `7e0e1fd`
- Parallel follow-up: `35a190b` keeps `/api/mcp` dynamic so deployed requests
  retain the Authorization header.
- Working tree at handoff: clean after the local session-memory commit
- AI service deployment: not performed; no separate Vercel project exists
- Shared secrets in Vercel/AI runtime: not configured by this work

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

- `npm test` — 78/78 pass on final `main`, including the parallel MCP
  dynamic-route regression.
- `python3 ai-analytics-service/run_tests.py` — 11/11 pass.
- Full Python pytest — 15/15 pass, with one existing Starlette
  `TestClient`/httpx deprecation warning.
- `npx tsc --noEmit` — pass.
- `npm run lint` — pass.
- `npm run build` — pass, with a Next.js warning that the `middleware`
  convention will be replaced by `proxy`.
- OpenAPI JSON and YAML parse successfully.
- A fresh Docker build was attempted but could not start because the local
  Docker daemon was unavailable. The earlier container build/smoke remains
  recorded in `docs/shalomut-tracker-handoff.md`.
- No staging or production runtime was exercised in this session.
- No real secrets were committed.

## What remains

1. Add strict request/output/privacy models and explicit fail-closed safety
   semantics as the next isolated AI-service change.
2. Deploy the container image to Cloud Run (or Render) from the repository
   root; no hosting environment exists yet.
3. Configure matching `AI_SERVICE_URL`, `DATA_LAYER_MCP_URL`,
   `DATA_LAYER_CALLBACK_URL`, `MCP_SHARED_SECRET`, `AI_WEBHOOK_SECRET`, and
   `AI_CALLBACK_SECRET` in the intended staging environments.
4. Deploy the Python service and run a real staging webhook → callback smoke
   test. Verify both ready and privacy-locked rounds.
5. Review the real staging result and decide whether to promote the verified
   `main` deployment to production.
6. Decide separately whether the runtime should adopt real LangGraph/ChromaDB;
   this is not required for the current contract or local E2E path.

## Approval gates

- Do not rotate or copy secrets without the environment owner.
- Do not run a second migration against another database until its target is
  confirmed and a backup/PITR checkpoint is available.
- Do not invoke a real staging webhook until the AI service URL and callback
  URL are configured on both sides.
- Do not promote production until real AI-service staging smoke-test evidence is
  recorded.

## First next action

Implement the strict AI request/output/privacy contract as a small isolated
change. After that, authorize a hosting environment — Cloud Run is the
recommended target — and set the shared secrets and trusted Data Layer URLs on
both sides before any real webhook is invoked.
