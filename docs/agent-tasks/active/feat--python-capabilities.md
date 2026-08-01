# Task: Python capabilities pipeline and MCP contract

## Status

- **Branch**: `feat/python-capabilities`
- **Current HEAD**: `7843a461a6b337f837e33bb399c73423f94d823c`
- **Upstream**: `origin/feat/python-capabilities`, aligned (`0 ahead / 0 behind`)
- **State**: Review findings fixed and fully verified; changes are not committed.

## Completed

- Moved MCP `structuredContent` to the `CallToolResult` level, retained the text fallback, published `outputSchema`, and added Core/Python regression coverage.
- Added a Core runtime validator for the MCP analytics payload and exercised the complete shared golden corpus in TypeScript and Python.
- Removed dummy `6.0` from the production capability manifest and proved test-only registry extension on both sides.
- Replaced remaining exact-version policy branches in Python nodes/graph and the Core callback route with capability checks.
- Strengthened TypeScript and Python fitness gates for 1.0/2.0 branches and comparisons through version constants; added regression tests.
- Made standalone typecheck generate Prisma Client.
- Moved the durable AI-run PostgreSQL test out of the unit-test discovery path. `verify:db` now generates Prisma Client, applies migrations, and runs both PostgreSQL suites sequentially.

## Decisions and assumptions

- MCP text content remains present for backwards compatibility during consumer-first rollout; structured content is the preferred standard path.
- Dummy `6.0` is a test fixture injected into the registry loader, not a runtime-supported contract.
- PostgreSQL suites use only the disposable local/CI test database selected by `TEST_DATABASE_URL`; the verified local target was `shalomut_test` on `127.0.0.1:5433`.
- `next-env.d.ts` was already modified before this work and is unrelated user state; it must remain excluded from this task's commit.

## Verification evidence

- **Passed**: targeted MCP/Core golden-corpus tests — 18/18.
- **Passed**: targeted Python MCP/corpus/registry/fitness tests — 7/7.
- **Passed**: `npm run typecheck`, including `prisma generate` on the typecheck path.
- **Passed**: `npm run verify:db` after the final ordering fix — 7/7 against PostgreSQL after 7 migrations.
- **Passed**: full `npm run verify` — architecture fitness, typecheck, 307 TypeScript tests, ESLint, production build, 7 PostgreSQL tests, and 286 Python tests. One existing Starlette/httpx deprecation warning remains.
- **Passed**: `git diff --check`.
- **Not run**: browser smoke; no UI behavior changed.

## Git state

- **Committed**: HEAD `7843a46`; no commits beyond upstream.
- **Staged**: none.
- **Unstaged task changes**: MCP route/client/schema/tests; contract registries and capability-driven pipeline/callback changes; golden-corpus and fitness tests; Prisma/typecheck/DB verification ordering; this task file; relocation of `prisma-ai-analysis-runs.integration.test.ts` from `__tests__` to `__dbtests__`.
- **Untracked task files**: `ai-analytics-service/tests/test_contract_registry.py`, `ai-analytics-service/tests/test_mcp_client.py`, `ai-analytics-service/tests/test_version_fitness.py`, `scripts/check-version-literals.test.mjs`, `src/lib/__tests__/round-analytics-golden-corpus.test.ts`, `src/lib/repositories/__dbtests__/prisma-ai-analysis-runs.integration.test.ts`, `src/lib/round-analytics-payload.ts`.
- **Unrelated unstaged user change**: `next-env.d.ts`.

## Risks and approval gates

- No production, credential, authentication, deployment-alias, or customer-data mutation was performed.
- The task diff is portable only inside this worktree until committed; it has not been pushed.

## Next concrete step

Review and commit the task diff on `feat/python-capabilities`, explicitly excluding `next-env.d.ts`.
