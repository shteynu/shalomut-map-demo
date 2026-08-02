# Contract 6.0 Python producer

## Metadata

- Branch: `feat/contract-v6-python-producer`
- Base branch: `feat/contract-v6-core-consumer`
- Base commit: `1639cb5`
- Implementation commit: `9036410`
- Current HEAD before archival commit: `9036410`
- Status: complete and archived; ready for main integration
- Last updated: 2026-08-02
- Last agent/tool: Codex

## Objective

Implement the Python Contract 6.0 producer slice defined by the accepted revised
execution plan: safe V6 input parsing, structured narrative generation and
fallbacks, full qualitative metric insights, five ranked recommendations, batch
adaptation, formatter/state integration and compatibility with Contracts 1.0-5.0.

## User-visible outcome

A local unlocked V6 analysis can produce eight valid stones. Each stone contains
three Hebrew overview paragraphs, qualitative insight text for every active
question and exactly five content-rich recommendations, while locked input
remains detail-free and old contract versions behave as before.

## Context

- Core V6 consumer implementation is committed as `e2a472d` and its task is
  archived in `docs/agent-tasks/archive/feat--contract-v6-core-consumer.md`.
- The accepted source plan is
  `/Users/maxim.berenshtein/Downloads/shalomut_contract_v6_execution_plan_revised (2).pdf`.
- The Core producer default remains `5.0`; this branch now makes local Python
  health advertise support through `6.0` without changing Core producer config.

## Scope

- Python V6 contract capabilities and MCP parsing.
- Structured three-paragraph summary generation, validation and deterministic
  fallback.
- One batch metric-insight generation call per dimension with exact question-ID
  coverage and per-question deterministic fallback.
- V6 graph/state/safety/formatter output.
- Catalog expansion to at least eight candidates per dimension/status, top-five
  distribution-aware selection and one batch recommendation-adaptation call per
  dimension.
- Python fixtures, contract/unit/integration tests and any narrowly owned docs.

## Non-goals

- Deploying Core or Python, changing secrets, environment variables,
  authentication or deployment aliases.
- Switching `AI_ANALYTICS_CONTRACT_VERSION` in Core from `5.0` to `6.0`.
- Controlled deployed rounds, rollout/rollback execution or production-readiness
  claims.
- Dashboard layout changes, database migrations or respondent-level/raw-answer
  data.

## Acceptance criteria

- Python `/health` advertises `6.0` only after input and output support is real.
- V6 parser preserves distribution and allowed background context, rejects
  missing evidence, forbidden respondent fields and locked detail.
- Provider error, quota failure, malformed JSON or semantic rejection yields
  exactly three valid Hebrew fallback summary paragraphs and complete narrative
  metric fallbacks.
- Batch metric response covers every input question ID exactly once, with no
  extras, digits or percent signs in visible copy.
- Every dimension/status catalog pair has at least eight exact-scope candidates;
  distribution-aware ranking selects five without cross-status backfill.
- Recommendation adaptation uses one batch call per dimension, preserves IDs and
  order and returns exactly five items with explicit adaptation outcomes.
- Success output has exactly eight V6 stones, full metric coverage, three summary
  paragraphs and five recommendations per stone; locked/validation-failed output
  contains no stones or respondent-derived detail.
- Contracts 1.0-5.0 and existing Python behavior remain green.

## Relevant repository instructions

- `AGENTS.md`
- `.agents/skills/shalomut-tracker/SKILL.md`
- `.agents/skills/shalomut-map/SKILL.md`
- `.agents/skills/shalomut-verification/SKILL.md`

## Relevant architecture and contracts

- `contracts/ai-analytics-v6.json`
- `contracts/capabilities.json`
- `docs/ai-contract-version-matrix.md`
- `docs/ai-analytics-handoff.md`
- `ai-analytics-service/README.md`
- `ai-analytics-service/src/contracts.py`
- `ai-analytics-service/src/schemas/mcp_types.py`
- `ai-analytics-service/src/services/llm_provider.py`
- `ai-analytics-service/src/agents/`
- `ai-analytics-service/src/rag/store.py`
- `ai-analytics-service/data/interventions_kb.json`

## Decisions made

- Implement Python PR-2 and PR-3 together on this independently deliverable
  branch because the user named parser/generation/fallback and the five-item
  catalog as the next block.
- Keep rollout/config switching outside this branch.
- Preserve aggregate-only input and exact Core-owned numeric evidence.
- Keep every catalog entry scoped to exactly one status; the V6 expansion uses
  eight independent candidates for each dimension/status pair rather than
  sharing new yellow/red entries.

## Assumptions

- The revised V6 execution PDF is the accepted semantic contract.
- The existing Core V6 manifest and validator define the exact output boundary.

## Completed

- Reconciled the prior handoff with Git: the Core consumer is already committed
  and archived locally.
- Created this separate branch from the clean archived Core-consumer branch.
- Extracted and visually checked the relevant Python/catalog/rollout pages of
  the accepted revised V6 plan.
- Added V6 to Python contract support, dynamic parsing and local health while
  preserving background context, distributions, privacy lock and forbidden
  respondent-field rules.
- Added strict JSON generation/parsing for three summary paragraphs, exact-ID
  metric narratives and identity/order-preserving recommendation batches.
- Added complete deterministic fallbacks for summaries, per-question metric
  narratives, overall summary and five content-rich recommendations.
- Integrated V6 summary/metric state, safety validation and formatter output;
  V1-V5 continue through their existing interpretation paths.
- Expanded the catalog from 120 to 192 records: exactly eight candidates for
  every canonical dimension/status pair, with distribution-aware top-five
  selection and no cross-status backfill.
- Added V6 shared input golden-corpus cases and Python contract/provider/graph/
  privacy/catalog regression coverage.
- Updated runtime/version/architecture/progress documentation without changing
  deployment or producer configuration.

## In progress

- None.

## Remaining

- In a separate branch, deploy the Core consumer and Python V6 service, verify
  deployed Python health at the expected commit, run a full local V6 round, and
  only then enable/switch the Core producer under explicit rollout authority.

## Changed files

- Python contract/generation/graph: `ai-analytics-service/src/contracts.py`,
  `ai-analytics-service/src/services/hebrew_prompts.py`,
  `ai-analytics-service/src/services/hebrew_validation.py`,
  `ai-analytics-service/src/services/llm_provider.py`, and
  `ai-analytics-service/src/agents/{state,psychologist_node,intervention_nodes,safety_node,graph}.py`.
- Catalog: `ai-analytics-service/data/interventions_kb.json`.
- Tests/fixtures: `ai-analytics-service/tests/test_contract_v6.py`,
  `test_contract_registry.py`, `test_llm_output_validation.py`,
  `test_rag_store.py`, and `contracts/fixtures/golden_corpus.json`.
- Docs/state: `ai-analytics-service/README.md`,
  `docs/ai-contract-version-matrix.md`, `PROJECT_CONTEXT.md`, `PROGRESS.md`,
  `docs/shalomut-tracker-handoff.md`, and this task file.

## Verification evidence

### Passed

- `ai-analytics-service/.venv/bin/python -m pytest -q` — 301/301 passed; one
  existing upstream Starlette/httpx deprecation warning.
- `npm run verify:core` — version-literal/architecture fitness passed,
  typecheck passed, 324 Core tests passed, ESLint passed and the production
  Next build completed successfully with the existing middleware deprecation
  warning.
- Focused V6/catalog/provider/graph gate — 73/73 passed after the final exact
  single-status catalog expansion.
- Shared V6 golden corpus passed in both Python and TypeScript suites.
- In-memory real Python `run_pipeline()` V6 deterministic-fallback output was
  passed directly to Core `validateStoneMapResult`; Core accepted all eight
  stones.
- Local Python `health_check()` returned supported versions `1.0` through
  `6.0`.

### Failed

- Initial focused test collection failed as expected before the V6 constant was
  implemented; the final focused and full suites pass.
- Two attempted pre-existing virtualenv paths did not exist in this worktree;
  a clean local `.venv` was created from `.[dev]` with `uv` and used thereafter.
- The first ad-hoc Core/Python boundary command omitted the service from
  `PYTHONPATH`; the corrected in-memory boundary command passed.

### Blocked or not run

- Full local stack with callback persistence and visual UI was not run; this
  branch changes no Core UI/persistence and the controlled V6 round belongs to
  the rollout slice.
- Database suites were not run because the diff changes no schema, repository
  or persistence behavior.
- Deployment, deployed health/provider output, producer switching and rollback
  were not run and remain out of scope.

### Environment

- Local isolated worktree; no deployment, database or configuration mutation.

### Residual risk

- Provider-valid and malformed JSON paths are covered locally, but no live
  provider call has been observed for V6 content quality, latency or fallback
  rate. Independent review is recommended for this contract/privacy boundary.

## Failed approaches

- Tried to reuse virtualenv paths recorded by the prior session; neither exists
  now, so the worktree-local `uv` environment became the reproducible path.
- The first catalog expansion shared supplemental yellow/red entries. Diff
  review tightened it to eight exact single-status candidates per pair and the
  full suite remained green.

## Known risks

- The catalog/data diff is intentionally large (72 new entries); structural and
  Hebrew-copy tests protect exact scope but domain copy still merits owner review.
- Live V6 model outputs may fall back more often than local fixtures until prompt
  behavior is measured during rollout.

## Approval gates

- Deployment, environment/secret/auth changes and alias switching require an
  explicit bounded instruction and are not authorized by this task.

## Questions requiring an owner decision

- None for this implementation slice.

## Next concrete step

Integrate commits through `9036410` plus this archival commit into `main`, then
create a separate rollout/readiness branch before any deploy or producer switch.

## Exact Git state at archival

- Implementation HEAD: `9036410` (`feat(ai): add contract v6 python producer`);
  the archival document change is committed immediately after it.
- Upstream: none; the local branch contains the two committed Core-consumer
  commits plus the Python V6 implementation.
- Staged, unstaged and untracked files before this archival update: none.
- Ignored local environment: `ai-analytics-service/.venv/`.
- Visibility at archival: commits are available to local worktrees; `main` and
  `origin/main` are updated only by the following authorized integration step.
