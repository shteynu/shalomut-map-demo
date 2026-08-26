---
name: shalomut-verification
description: Verify changes and runtime behaviour of the shalomut-map-demo project. Use when a bugfix or feature has to be proven correct, when tests must be chosen from a diff, when checking readiness to merge, when running lint/build/Prisma/Python/OpenAPI/AI E2E/browser smoke, when checking a deployed environment, or when recording verification evidence without unproven claims.
---

# Shalomut Verification

## How to read this skill

Always in force: `Purpose` — proportionality to risk; `Preflight` — without it
the matrix rows cannot be chosen; `Selection matrix` — the mandatory minimum per
area touched; `Handling results` and `Evidence format` — what counts as a passed
check and how to report it.

On condition, once the matrix has selected rows: `Project commands` — the
subsection under each selected row, not the whole section;
`Browser and runtime scenarios` — the diff changes a user-visible flow;
[references/mutation-testing.md](references/mutation-testing.md) — the row about
mutation config or mutated files fired, or the strength of the tests has to be
proven.

## Purpose

Choose the smallest set of checks that proves the changed behaviour, then widen
it in proportion to risk. Do not run the full suite mechanically for a
docs-only change, and do not stop at one targeted test for a change to privacy,
auth, persistence, contracts or deployment.

## Preflight

1. Determine the repository root with `git rev-parse --show-toplevel`.
2. Read `AGENTS.md`, `package.json`, the relevant source and the nearest tests.
3. Check `git status --short`, the staged/unstaged diff and the list of changed
   files.
4. Identify the layers touched: UI, API, services, persistence, Prisma, survey
   methodology, OpenAPI, AI contract, the Python service, auth/security or
   deployment.
5. Record the evidence context: local, test or deployed. `test` denotes an
   isolated check, not a third product environment. Do not mix evidence from
   different environments without labelling it.
6. Against deployed, a read-only smoke is the default: do not create data, do
   not fire a webhook and do not change an alias without permission appropriate
   to that environment. The rule sits here rather than among the scenarios
   because checking a callback or the AI boundary also reaches deployed without
   being a user-visible flow.
7. `npm run dev` starts a runtime but is not evidence by itself.

## Selection matrix

| Area changed | Mandatory minimum |
| --- | --- |
| Markdown, instructions or skills only | Frontmatter/links, `git diff --check`, the relevant structural validation; for `AGENTS.md`, the client adapters and `.agents/skills/**` — `npm run lint:skills` |
| A repository gate: `scripts/check-*.mjs`, a `lint:*` command, its place in `verify:core` or the gate inventory | The paired `node --test` and the gate itself, `npm run lint:gate-inventory`, plus `npm run lint:skills` when `.agents/skills/**` is edited. Weakening a check is changing a rule: update the doc-comment and the tests for both sides, per `../shalomut-guardrails/SKILL.md` |
| Mutated files (`src/lib/ai-contract.ts`, `src/lib/scoring-bands.ts`), their tests or the mutation config | `npm run lint:mutation-config`, a Stryker dry run; a full mutation run if the task changes mutation evidence or asks for test strength. Details in [references/mutation-testing.md](references/mutation-testing.md) |
| `src/components`, page TSX, CSS | Targeted tests, `npm run lint`, `npm run build`; browser smoke for a user-visible flow |
| Fonts: `src/app/fonts/**`, `next/font` or the font stack in `globals.css` | `npm run lint:fonts`, `npm run build` and a browser smoke with `document.fonts` — compare `.next/static/media/*.woff2` against the file in the repository and confirm that no resource entry goes to Google |
| `src/app/api`, services, hooks, utilities | The nearest API/unit tests, then `npm test` and `npm run build` |
| Repositories or server guards | Repository/API regression tests, `npm test`, `npm run lint`, `npm run build` |
| `prisma/schema.prisma` or migrations | `npx prisma validate`, `npx prisma generate`, repository tests; status/migration only under the rules below |
| Survey source, scoring or privacy | Survey-definition/math/API tests, `npm test`, respondent and locked/ready browser states |
| `docs/openapi.yaml` or the API contract | `npm run openapi:generate`, OpenAPI integrity tests, and a comparison of route/schema changes against the real handlers |
| A versioned AI manifest, `contracts/capabilities.json` or AI TypeScript | `npm run lint:contract-refusals` — a new version must get a suite of negative tests; contract/registry/client/view-model tests, `npm test`, Python tests and the local boundary E2E |
| `ai-analytics-service` | `.venv/bin/python -m pytest` from `ai-analytics-service` — the full set, contract suites included |
| Python dependencies: `pyproject.toml`, `requirements*.txt`, `Dockerfile`, python steps in workflows | `npm run lint:python-deps`; locks are regenerated by the commands in `ai-analytics-service/README.md`, never edited by hand. The deployed interpreter is 3.11 and a development machine usually does not have it, so there is one proof: `docker build` and running the suite in that image. The command is in the `Local container check` section of the same README |
| Auth, secrets or authorization | Unauthorized/missing-secret/organization-isolation tests and a security-focused diff review |
| Deployment, env or runtime config | The full local suite, deployed source/build/health/status/logs and a safe read-only browser smoke |

If a diff touches several rows of the table, merge their checks and remove
duplicates.

One check belongs to no row: `npm run typecheck` is the mandatory minimum for
any `.ts`/`.tsx` change. `npm run build` types only the application graph and
cannot see an error in `__tests__`, and `npm run lint` does not check types at
all, so no row above replaces it.

## Project commands

### TypeScript and Next.js

- Run the nearest test directly with `npx tsx --test <test-file>`.
- Run the full TypeScript suite with `npm test`. `tsx` strips types without
  checking them, so a green `npm test` says nothing about types.
- Type-check the whole project, tests included, with `npm run typecheck`
  (`next typegen && tsc --noEmit`). It is the mandatory minimum for any
  `.ts`/`.tsx` change: `npm run build` types only the application graph and
  cannot see an error in `__tests__`, and `npm run lint` does not check types at
  all.
- Check lint with `npm run lint`.
- Check production compilation and App Router boundaries with `npm run build`.
- `npm run lint:fonts`, part of `verify:core`, keeps a font from going back to
  the network: the gate fails on `next/font/google`, on a Google font host in
  code or CSS, and on a `next/font/local` source that is not on disk. The rule
  is not decorative: until 2026-08-12 `next build` downloaded five `.woff2`
  files from `fonts.gstatic.com`, and on 12 August a runner received a stale
  stylesheet — all five answered 404, Turbopack recorded that as a warning and
  failed the build with a message that mentions neither fonts nor the network.
  The same commit built cleanly in the neighbouring job, so the gate had become
  a coin toss rather than a red light.

### Mutation testing

The rules, commands and history of this layer live in
[references/mutation-testing.md](references/mutation-testing.md). Open the file
when the matrix row about mutation config or mutated files fires, or when the
user asks for proof of test strength.

Both related checks are already named in the matrix because they are part of
`verify:core` and fail CI: `npm run lint:mutation-config` re-derives
`tap.testFiles` from the repository, and `npm run lint:contract-refusals`
requires every stone-validation path to be exercised by some `*-refusals.test.ts`.
Do not edit `stryker.config.mjs` or add a contract version without running them.

### Prisma and persistence

- Validate the schema with `npx prisma validate`.
- Check client generation with `npx prisma generate`.
- Run repository and API tests after schema/repository changes.
- Before `npm run db:status`, `db:migrate:*`, `db:clear` and other writes, check
  which database environment they will reach. The data is disposable, so no
  backup/rollback boundary and no separate confirmation are required — only the
  correctness of the target matters.

### Python and the AI boundary

- Run the full suite from `ai-analytics-service`: `.venv/bin/python -m pytest`.
  It is the only command that covers the contract suites in `tests/` as well.
  The interpreter must be the one from `.venv`, not `python3`: the dependencies
  are installed only in the venv, and an agent's shell does not keep
  `source .venv/bin/activate` between calls, so `python3 -m pytest` answers
  `No module named pytest`. If there is no `.venv`, create it per
  `docs/local-environment.md` — with the `[dev]` extra, or pytest never appears
  in the venv.
- The same rule for Node callers is checked by `npm run lint:interpreter`, part
  of `verify:core`. The interpreter is resolved by
  `scripts/ai-service-python.mjs`; the gate fails on `python3` in command
  position in `scripts/`, `src/`, `e2e/`, `package.json` and
  `.github/workflows/`. Only `python3 -m venv` is allowed. The rule is not
  decorative: `npm test` starts a real Python pipeline, and until 2026-08-12 it
  took `python3` from PATH — on macOS that is 3.9, which does not satisfy
  `requires-python = ">=3.11"` and fails three cross-service tests with an
  ImportError from the middle of the service, taking all of `verify:core` with
  it.
- `run_tests.py` exists for compatibility only: it delegates to the same
  command. Do not cite it as separate evidence.
- After contract, MCP, webhook or callback changes, run the corresponding
  TypeScript tests and the local Next.js → Python → callback boundary test
  through `npm test`.
- Do not treat a mock MCP as proof of real deployed transport.

### OpenAPI

- `docs/openapi.yaml` is the single editable source. After editing it run
  `npm run openapi:generate` and commit the generated `public/openapi.json`.
  Editing the JSON by hand is drift, not a change.
- Run `src/app/api/__tests__/openapi.test.ts` after route/schema changes. It
  includes `npm run openapi:check`, which compares the whole document.
- Check that status codes, authentication requirements, payload schemas and
  versioned contract semantics match the real handlers. That is what the
  generator cannot check: it guarantees the artefacts are identical, not that
  they are truthful.

## Browser and runtime scenarios

Check only the states the scenario needs:

- empty persistence: no invented school or round;
- manager onboarding and round setup;
- the respondent flow through a real share code;
- the below-threshold privacy lock;
- ready analytics and the eight canonical dimensions;
- loading, not-found, upstream error and unauthorized;
- RTL reading order, keyboard access, responsive layout and reduced motion for
  UI changes.

One path from that list is automated: `npm run test:e2e` builds the project and
runs `e2e/smoke.spec.ts` — manager sign-in, the collection screen, the
respondent link and the dashboard. Playwright starts the server on port 3100
itself and supplies `SESSION_SECRET`, `MANAGER_ADMIN_PASSWORD` and
`MANAGER_ORGANIZATION_ID`, so no real secrets are needed locally or in CI. A
database with a round is needed: locally the dev database, in CI a step that
applies migrations and seeds. The smoke answers "is the application standing?",
not "are the rules correct", and replaces no other check.

For local UI use `playwright` or `playwright-interactive` when available. For a
deployed environment the read-only rule from `Preflight` applies.

## Handling results

- Count a check as passed only on an actual exit code `0` or a confirmed
  expected runtime result.
- Separate `passed`, `failed`, `blocked` and `not run`.
- On a failure, keep the exact command and a useful fragment of the error; do
  not mask the problem with a fallback success.
- Do not fix an unrelated failure without widening scope. Establish whether it
  predates the current diff, when that can be checked safely.
- After a fix, re-run the failing check first, then the affected suite.
- If the diff touches privacy, authentication, authorization, contracts,
  deployment or the Core/AI boundary and the residual risk needs independent
  review, return the short signal `Independent review recommended.` to the
  tracker; the tracker forms the final model recommendation.

## Evidence format

Before finishing, report:

```text
Verification:
- Passed: <command or smoke and result>
- Failed: <command and concise cause>
- Blocked/not run: <check and reason>
- Environment: <local/test/deployed>
- Residual risk: <what remains unverified>
```

If an active branch task document exists and a handoff is being prepared, update
its `Verification evidence` before handing over: `Passed`, `Failed`, `Blocked or
not run`, `Environment` and `Residual risk`. Do not record checks that did not
run, and do not copy ordinary task evidence into `PROGRESS.md` or the global
operational handoff unless it changes project-wide or deployed state.
