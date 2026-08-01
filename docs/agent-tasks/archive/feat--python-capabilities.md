# Task: Python capabilities pipeline and MCP contract

## Status

- **Branch**: `feat/python-capabilities`
- **Implementation commit**: `b1549fd` (`fix(refactoring): close contract and CI review findings`)
- **Merged state**: `main` and `origin/main` at `47333be` on 2026-08-01.
- **State**: Completed, archived, merged and pushed.

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
- **Passed**: GitHub Build & Validate run `30717540728` on clean runner at `47333be`.
- **Passed**: GitHub CodeQL run `30717540724` for TypeScript and Python at `47333be`.
- **Passed**: `git diff --check`.
- **Not run**: browser smoke; no UI behavior changed.

## Git state

- **Committed and pushed**: all task changes are in `main` through `47333be`.
- **Session-close documentation**: recorded in the documentation commit after
  `47333be`, including the progress/handoff refresh and five task-file moves
  from `active/` to `archive/`.
- **Unrelated unstaged user change**: `next-env.d.ts`.

## Risks and approval gates

- No production, credential, authentication, deployment-alias, or customer-data mutation was performed.
- No task-specific residual approval gate remains.

## Next concrete step

Choose the next independently deliverable product-backlog item and create its
own branch and active task file.
