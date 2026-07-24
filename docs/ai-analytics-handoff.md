# AI Analytics — handoff

> Status update, 2026-07-24: implementation PR #4 has been merged into
> `main` at `19401a6`. This file keeps the AI-specific handoff. Current staging,
> empty-runtime, and manager UI status is tracked in
> `docs/shalomut-tracker-handoff.md`.

## Snapshot

- Original branch: `feature/ai-analytics-microservice-mcp`
- Merged to `main`: PR #4, merge commit `19401a6`
- Latest original branch commits: `c96716b` implementation, `1d0b040` migration status docs
- Working tree at handoff: clean
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

- FastAPI webhook and direct analyze endpoints exist.
- MCP client calls the core JSON-RPC endpoint and fails closed on transport
  errors unless `USE_MOCK_MCP=true` is explicitly enabled.
- The current runtime is an async graph-style workflow with a structured local
  intervention catalog. It does not currently execute LangGraph or ChromaDB.
- Recommendations are dimension-scoped and use the OECD/ISO 45003 catalog.
- `pyproject.toml` declares the Vercel FastAPI entrypoint
  `src.main:app`; runtime dependencies were reduced to the packages actually
  used by the service.
- Webhook processing and callback complete within the serverless request
  instead of relying on an in-process background task.
- Outside development, the webhook fails closed when `AI_WEBHOOK_SECRET` is
  missing or invalid.

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

- `npm test` — 66 tests pass.
- `python3 ai-analytics-service/run_tests.py` — 7/7 pass.
- Full Python pytest in a disposable virtualenv — 9/9 pass.
- `npm run lint` — pass.
- `npm run build` — pass.
- `npx prisma validate` — pass.
- `npx prisma migrate status` — database schema is up to date.
- No real secrets were committed.

## What remains

1. Provide or confirm a dedicated staging Supabase target. Vercel currently has
   no Preview or Production env vars, so the existing local project ref cannot
   be safely classified there.
2. Create a separate staging Vercel project rooted at
   `ai-analytics-service/`.
3. Configure matching `APP_BASE_URL`, `AI_SERVICE_URL`,
   `MCP_SHARED_SECRET`, `AI_WEBHOOK_SECRET`, and `AI_CALLBACK_SECRET` in the
   intended staging environments.
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

Confirm a dedicated staging Supabase project and authorize creation of a
separate Vercel project for `ai-analytics-service`; do not reuse the only known
local database target by assumption.
