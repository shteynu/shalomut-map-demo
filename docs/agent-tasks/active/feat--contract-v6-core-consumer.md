# Contract 6.0 Core consumer

## Metadata

- Branch: `feat/contract-v6-core-consumer`
- Base branch: `main`
- Base commit: `40781c9`
- Current HEAD: `40781c9`
- Status: complete; ready to commit and archive
- Last updated: 2026-08-02
- Last agent/tool: Codex

## Objective

Implement the consumer-first Core slice of the approved Contract 6.0 execution
plan: publish the V6 schema, accept and cross-check V6 callback payloads, and
normalize V5/V6 results into the existing Dashboard layout while leaving the
producer on Contract 5.0.

## User-visible outcome

When a persisted V6 result is eventually received, each dimension keeps the
existing overview/metric/recommendation navigation but renders three overview
paragraphs and qualitative per-question metric text instead of a large numeric
value and distribution bar. Existing V5 results continue to render unchanged.

## Context

- Input plan: `shalomut_contract_v6_execution_plan_revised (2).pdf` supplied by
  the owner on 2026-08-02.
- `docs/ai-contract-version-matrix.md` currently reserves V6 because no semantic
  delta had previously been accepted; the supplied plan now defines that delta.
- Phase 0 prerequisites are already present: V5 background context, shared
  capabilities, fail-closed producer selection, typed/decomposed Python state,
  durable jobs and MCP `structuredContent`.

## Scope

- `contracts/ai-analytics-v6.json` and shared capability metadata.
- Core V6 TypeScript types and strict validation.
- Callback evidence cross-check for V6 metrics/distributions.
- V5/V6 view-model normalization.
- Narrative `MetricBlob` rendering and focused UI tests without layout changes.
- Contract/OpenAPI/version-matrix documentation needed by the consumer slice.

## Non-goals

- Python V6 parser, generation, structured summary, metric insight generation
  or formatter.
- Catalog expansion and five-recommendation producer behavior.
- Changing `AI_ANALYTICS_CONTRACT_VERSION`, deploying either service, changing
  secrets/env/aliases, or running a real provider round.
- Auth Phase E.

## Acceptance criteria

- Core accepts valid V6 success payloads and continues accepting V5 payloads.
- V6 requires exactly three summary paragraphs, full question metric coverage
  with qualitative `insightText`, and exactly five interventions per stone.
- Callback recomputes and rejects tampered Core-owned score, status, question
  average/count/distribution while treating narrative fields as validated text.
- V6 view-model maps three overview paragraphs and narrative metric copy; V5
  rendering remains unchanged.
- V6 `MetricBlob` does not render its numeric value or distribution bar.
- Core producer remains 5.0 and unknown configured versions remain fail-closed.

## Relevant repository instructions

- `AGENTS.md`
- `.agents/skills/shalomut-tracker/SKILL.md`
- `.agents/skills/shalomut-map/SKILL.md`
- `.agents/skills/shalomut-verification/SKILL.md`

## Relevant architecture and contracts

- `docs/wellbeing-refactoring-plan-v4-review.md`
- `docs/ai-contract-version-matrix.md`
- `docs/source-of-truth.md`
- `contracts/capabilities.json`
- `contracts/ai-analytics-v5.json`
- `src/lib/ai-contract.ts`
- `src/app/api/rounds/[roundId]/ai-insights/route.ts`
- `src/lib/ai-insights-view-model.ts`

## Decisions made

- Treat V6 as a breaking additive version and preserve immutable V1/V2 plus
  compatibility readers for V3-V5.
- Keep numeric evidence in the contract and Core callback only; hide it from
  primary V6 metric rendering.
- Keep the Core producer at 5.0 until Python health advertises real V6 support.
- Implement this as one Core consumer branch; later Python/rollout work uses
  separate branches and task files.

## Assumptions

- The supplied revised PDF is the owner's accepted semantic definition of V6.
- Narrative text rules apply only to V6 and must not tighten V5 validation.

## Completed

- Audited current `main`, deployed Python health and the revised PDF.
- Created an isolated worktree/branch from `origin/main@40781c9`.
- Published the Contract V6 manifest and capability metadata without adding V6
  to Core or Python producer-version lists.
- Added strict Core V6 validation: three Hebrew summary paragraphs, qualitative
  metric narratives, five distinct recommendations, evidence/provenance and
  privacy-locked semantics.
- Reused the callback's capability-driven evidence cross-check and proved V6
  rejects tampered score/status, average, response count and distribution.
- Normalized V5/V6 stones into the existing dashboard and made V6 MetricBlob
  narrative-only while preserving V5 numeric/distribution rendering.
- Added and synchronized V6 OpenAPI JSON/YAML schemas and updated the version
  matrix, project context and cross-task rollout handoff.
- Completed Core, Python, build and browser verification recorded below.

## In progress

- None.

## Remaining

- No implementation remains in this Core-consumer slice.
- Python V6 generation, fallback/catalog and producer rollout remain separate
  tasks and non-goals of this branch.

## Changed files

- Contract/registry: `contracts/ai-analytics-v6.json`,
  `contracts/capabilities.json`, `src/lib/contract-registry.ts`,
  `ai-analytics-service/src/schemas/contract_registry.py`.
- Core contract/types/UI: `src/lib/ai-contract.ts`,
  `src/lib/types/backend.ts`, `src/lib/ai-insights-view-model.ts`,
  `src/lib/demo-data.ts`, `src/components/dashboard/metric-blob.tsx`.
- Tests: `src/lib/__tests__/ai-contract-v6.test.ts`,
  `src/lib/__tests__/ai-contract-version.test.ts`,
  `src/lib/__tests__/ai-contract.test.ts`,
  `src/lib/__tests__/ai-insights-view-model.test.ts`,
  `src/lib/__tests__/contract-version-matrix.test.ts`,
  `src/lib/__tests__/round-analytics-golden-corpus.test.ts`,
  `src/components/dashboard/__tests__/metric-blob.test.tsx`,
  `src/app/api/__tests__/ai-e2e.test.ts`,
  `src/app/api/__tests__/openapi.test.ts`,
  `ai-analytics-service/tests/test_contract_registry.py`.
- Specs/docs: `public/openapi.json`, `docs/openapi.yaml`,
  `docs/ai-contract-version-matrix.md`, `PROJECT_CONTEXT.md`,
  `docs/shalomut-tracker-handoff.md`, and this active task file.

## Verification evidence

### Passed

- Pre-implementation audit: deployed Python health returned commit `40781c9`
  and supported versions `1.0`-`5.0`.
- `npm test` — 323/323 Core tests passed.
- Existing project virtualenv: `.venv/bin/python -m pytest -q` — 290/290
  Python tests passed with one upstream Starlette deprecation warning.
- `npm run lint:literals` — Node literal tests, TypeScript architecture fitness
  and Python version-literal fitness passed.
- `npm run typecheck` — Prisma generation, Next route types and TypeScript
  passed.
- `npm run lint` — passed.
- `npm run build` — production Next build passed; only the existing Next
  middleware deprecation warning was emitted.
- Focused final V6 validator run — 6/6 passed; `git diff --check` passed.
- Local browser at 1440x1000 with an intercepted valid V6 result: the real
  `/dashboard/balance/metrics/` route rendered the Hebrew qualitative narrative
  with no numeric value or distribution in the accessibility snapshot; browser
  console had zero errors/warnings.

### Failed

- The first test attempt before `npm ci` could not resolve `tsx`; dependencies
  were then installed from the lockfile and all test gates passed.
- System `python3` did not contain `pytest`; the existing project virtualenv was
  used and the full Python suite passed.
- Playwright screenshot capture timed out while waiting for the animated blob
  to become screenshot-stable, including after animations were disabled. The
  page snapshot and console/runtime checks completed successfully; no image was
  produced.

### Blocked or not run

- A real Python-generated V6 round and deployed health/rollout evidence are
  intentionally deferred until the Python consumer/producer slice exists.
- PostgreSQL verification was not run because this diff changes no schema,
  persistence code or database behavior.

### Environment

- Local isolated worktree; no deployment or database mutation.

### Residual risk

- The strict 300-500 character V6 narrative bounds must be implemented exactly
  by Python deterministic fallback and provider-output repair.
- Browser screenshot tooling could not capture the continuously fitted blob;
  the semantic runtime snapshot passed, but image-level clipping evidence will
  be worth repeating when Python can serve an actual V6 result.

## Failed approaches

- Running tests before lockfile dependencies were installed.
- Using system Python instead of the repository virtualenv.
- Playwright page/element screenshot capture on the animated blob; both timed
  out, while DOM/accessibility snapshot inspection remained stable.

## Known risks

- V6 capability metadata is shared with Python, but Python's supported-version
  tuple and health intentionally remain V1-V5. That separation is covered by
  tests and must be preserved in the next slice.
- No V6 producer exists yet; enabling the environment value now still fails
  closed and would be a rollout error.

## Approval gates

- Deployment, producer env switch, secrets/auth and alias changes require a
  separate explicit bounded instruction.

## Questions requiring an owner decision

- None for this consumer slice.

## Next concrete step

Commit the verified Core-consumer slice, then archive this task file.

## Exact Git state at handoff

- HEAD: `40781c94fe58dcca42b47cdeaa7998626e5029c7`.
- Upstream: `origin/main`; ahead 0, behind 0.
- Staged: none.
- Unstaged: every tracked file listed under `Changed files` except the three
  untracked files below.
- Untracked: `contracts/ai-analytics-v6.json`,
  `src/lib/__tests__/ai-contract-v6.test.ts`, and
  `docs/agent-tasks/active/feat--contract-v6-core-consumer.md`.
- Visibility: local worktree only; there is no commit or push for this slice.
