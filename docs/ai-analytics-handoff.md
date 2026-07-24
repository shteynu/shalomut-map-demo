# AI Analytics — handoff

## Snapshot

- Branch: `feature/ai-analytics-microservice-mcp`
- Latest commits: `c96716b` implementation, `1d0b040` migration status docs
- Working tree at handoff: clean
- Merge to `main`: not performed
- AI service deployment: not performed
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

- `npm test` — 51 tests pass.
- `python3 ai-analytics-service/run_tests.py` — 7/7 pass.
- `npx tsc --noEmit` — pass.
- `npm run lint` — pass.
- `npm run build` — pass.
- `npx prisma validate` — pass.
- `npx prisma migrate status` — database schema is up to date.
- No real secrets were committed.

## What remains

1. Confirm whether the current Supabase project is staging or shared/production
   by comparing its project ref with Vercel Preview/Production environment
   variables. The database target alone is not labelled by the code.
2. Configure matching `APP_BASE_URL`, `AI_SERVICE_URL`,
   `MCP_SHARED_SECRET`, `AI_WEBHOOK_SECRET`, and `AI_CALLBACK_SECRET` in the
   intended staging environments.
3. Deploy the Python service and run a real staging webhook → callback smoke
   test. Verify both ready and privacy-locked rounds.
4. Review the result and decide whether to merge this branch into `main` and
   promote to production.
5. Decide separately whether the runtime should adopt real LangGraph/ChromaDB;
   this is not required for the current contract or local E2E path.

## Approval gates

- Do not rotate or copy secrets without the environment owner.
- Do not run a second migration against another database until its target is
  confirmed and a backup/PITR checkpoint is available.
- Do not invoke a real staging webhook until the AI service URL and callback
  URL are configured on both sides.
- Do not merge to `main` or promote production until staging smoke-test evidence
  is recorded.

## First next action

Compare the Supabase project ref for `DIRECT_URL` with the Vercel Preview and
Production environment settings, then mark the target explicitly as
`staging` or `production` in the deployment handoff.
