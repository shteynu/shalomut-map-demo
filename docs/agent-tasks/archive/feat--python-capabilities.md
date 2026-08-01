# Task: Python capabilities pipeline and MCP contract

## Status

- **Branch**: `feat/python-capabilities`
- **Implementation commit**: `b1549fd` (`fix(refactoring): close contract and CI review findings`)
- **State**: Completed and archived before merging the branch into `main`.

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

- **Committed**: all task changes are contained in `b1549fd` and its branch ancestors.
- **Staged/unstaged/untracked task changes**: none after the archive commit.
- **Unrelated unstaged user change**: `next-env.d.ts`.

## Risks and approval gates

- No production, credential, authentication, deployment-alias, or customer-data mutation was performed.
- No task-specific residual approval gate remains.

## Next concrete step

Fast-forward `main` to the completed `feat/python-capabilities` branch and push both refs.
