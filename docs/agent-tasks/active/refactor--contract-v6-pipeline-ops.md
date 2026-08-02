# Contract readiness, pipeline decomposition and deployed-state audit

## Metadata

- Branch: `refactor/contract-v6-pipeline-ops`
- Base branch: `main`
- Base commit: `1b5e54a`
- Current HEAD: `1b5e54a`
- Status: implementation and local verification complete; uncommitted
- Last updated: 2026-08-02
- Last agent/tool: Codex

## Objective

Close the remaining non-auth architecture follow-ups without changing current
analytics behavior: prove the exact cross-service status of contract `6.0`,
decompose the broad Python pipeline state/nodes into bounded modules, resolve
the obsolete producer default, and record the real deployed migration state.

## User-visible outcome

No intended UI or analytics-output change. The system retains the current
`5.0` behavior while future contract additions become easier to review and the
default producer version stops silently dropping supported `5.0` data when the
configuration variable is absent.

## Context

- The accepted architecture review preserved typed pipeline-state detail from
  v3, but the current Python state still uses broad `Dict[str, Any]` fields and
  `agents/nodes.py` remains an 851-line multipurpose module.
- Contract Registry tests intentionally inject dummy `6.0`; production
  manifests and runtime services currently support only `1.0` through `5.0`.
- Contract `6.0` has no accepted semantic delta or manifest. Historical notes
  proposed it for lazy/partial generation, but partial-map semantics were later
  incorporated into undeployed `5.0` by owner decision.
- Before this branch, Core defaulted an unset
  `AI_ANALYTICS_CONTRACT_VERSION` to `3.0`, while the source of truth and
  deployed configuration used `5.0`.
- A read-only status check against the explicitly identified deployed Supabase
  found both refactoring migrations pending.

## Scope

- Audit every contract-version boundary: shared manifests/capabilities, Core
  producer/validator/health/OpenAPI, Python parser/registry/health, golden
  corpus, fitness gates and deployed health evidence.
- Keep `6.0` explicitly unsupported until a semantic contract is accepted;
  strengthen tests/docs if any boundary can drift or imply runtime support.
- Replace broad pipeline state declarations with named typed structures where
  the current runtime shapes are known.
- Split `agents/nodes.py` by responsibility while keeping its public imports as
  a compatibility facade and preserving graph behavior.
- Change the unset Core producer default from `3.0` to `5.0`, with fail-first
  tests and synchronized docs.
- Record the read-only deployed migration result and the exact approval
  boundary for applying it.

## Non-goals

- Inventing or enabling contract `6.0` without an accepted schema and rollout
  contract.
- Changing partial-map, privacy, scoring, prompt, recommendation, fallback or
  provider semantics.
- Manager identity/tenant authorization (separate Phase E task).
- Applying deployed migrations, deploying services, changing secrets/env,
  switching aliases or committing/pushing without explicit authorization.

## Acceptance criteria

- A single testable matrix shows that every relevant runtime boundary either
  derives supported versions from the shared registry/manifests or deliberately
  rejects undeclared `6.0`.
- Python graph tests pass with `agents/nodes.py` reduced to a compatibility
  facade and state shapes represented by named types instead of anonymous broad
  maps wherever the runtime contract is stable.
- No exact-version policy branch is reintroduced; architecture fitness stays
  green.
- An unset producer version resolves to `5.0`; configured `3.0`/`4.0`/`5.0`
  remain valid and unknown versions remain fail-closed.
- Documentation names `5.0` as the default and records that `6.0` is reserved,
  not deployed or supported.
- Deployed migration evidence names the confirmed non-loopback target and the
  two pending migration IDs without exposing credentials.
- Full TypeScript, PostgreSQL and Python verification passes, or any blocked
  environment check is recorded exactly.

## Relevant repository instructions

- `AGENTS.md`
- `.agents/skills/shalomut-tracker/SKILL.md`
- `.agents/skills/shalomut-map/SKILL.md`
- `.agents/skills/shalomut-verification/SKILL.md`
- `planning-and-task-breakdown/SKILL.md`

## Relevant architecture and contracts

- `docs/wellbeing-refactoring-plan-v4-review.md`
- `docs/source-of-truth.md`
- `docs/ai-analytics-handoff.md`
- `PROJECT_CONTEXT.md` ADR-001, ADR-002, ADR-005, ADR-006 and ADR-007
- `contracts/capabilities.json` and `contracts/ai-analytics-v1.json` … `v5.json`
- `src/lib/contract-registry.ts`, `src/lib/ai-contract-version.ts`
- `ai-analytics-service/src/schemas/contract_registry.py`
- `ai-analytics-service/src/agents/state.py`, `agents/nodes.py`, `agents/graph.py`

## Decisions made

- Treat production support and future-readiness separately: the registry
  extension test proves a future version can be added without version branches;
  it does not publish `6.0`.
- Do not create `ai-analytics-v6.json` until its semantic delta, compatibility
  and consumer-first rollout are explicitly accepted.
- Use `5.0` as the unset producer default because all current consumers support
  it, the deployed producer is configured for it and it is the documented
  current contract.
- Preserve `agents.nodes` imports as a facade so decomposition does not force a
  graph/test migration in the same slice.

## Assumptions

- The requested “contract 6.0” check means verifying cross-service awareness,
  not authorizing an undefined breaking contract.
- The deployed database remains disposable design-stage data, but a deployed
  write still requires an explicit bounded instruction naming the target and
  migration action.

## Completed

- Preserved the unrelated completed UI task in its original worktree and
  created this clean worktree/branch from `origin/main`.
- Audited repository-wide `6.0` references: only test-only registry extensions
  and historical planning notes exist; no runtime manifest exists.
- Read deployed AI `/health`: commit `1b5e54a`, supported versions `1.0`–`5.0`.
- Confirmed Vercel production has an encrypted
  `AI_ANALYTICS_CONTRACT_VERSION` variable; its value was not read or exposed.
- Identified the deployed Supabase target from the gitignored deployed env file
  without printing credentials and ran read-only `prisma migrate status`.
- Split the 851-line `agents/nodes.py` into privacy, psychologist,
  intervention, safety and shared-support modules; retained a 45-line
  compatibility facade so graph and test imports do not change.
- Replaced broad evolving pipeline maps with named `TypedDict` state sections;
  `Any` remains only at external JSON boundaries.
- Added module-boundary/state guards and kept every existing Python behavior
  test green.
- Changed the unset Core producer default and local-stack banner from `3.0` to
  `5.0`; explicit supported rollback versions remain valid and unknown values
  remain fail-closed.
- Added a cross-service contract matrix test/document and Python registry
  synchronization guard. Every production boundary advertises `1.0`–`5.0` and
  rejects the undeclared reserved `6.0`.
- Updated README, source-of-truth, ADR, project progress and cross-task handoff
  documentation with the resolved default, reserved-version policy and
  deployed migration evidence.
- Ran full Core, Python and local PostgreSQL verification successfully.

## In progress

- None.

## Remaining

- Owner review, commit and push are not yet authorized or performed.
- Applying the two deployed migrations remains an explicit approval-gated
  operation and is not required for the code diff to be locally complete.

## Changed files

- Modified: `PROGRESS.md`, `PROJECT_CONTEXT.md`,
  `ai-analytics-service/README.md`, `ai-analytics-service/src/agents/nodes.py`,
  `ai-analytics-service/src/agents/state.py`,
  `ai-analytics-service/tests/test_contract_registry.py`,
  `docs/shalomut-tracker-handoff.md`, `docs/source-of-truth.md`,
  `scripts/local-stack.mjs`, `src/app/api/__tests__/ai-e2e.test.ts`,
  `src/app/api/__tests__/health.test.ts`,
  `src/app/api/__tests__/mcp-semantic-contract.test.ts`,
  `src/lib/__tests__/ai-contract-version.test.ts`,
  `src/lib/ai-contract-version.ts`,
  `src/lib/repositories/__tests__/repositories.test.ts`,
  `src/lib/services/__tests__/analytics-semantic-contract.test.ts` and
  `src/lib/services/__tests__/contract-3-staging-dryrun.test.ts`.
- Untracked: `ai-analytics-service/src/agents/intervention_nodes.py`,
  `ai-analytics-service/src/agents/node_support.py`,
  `ai-analytics-service/src/agents/privacy_node.py`,
  `ai-analytics-service/src/agents/psychologist_node.py`,
  `ai-analytics-service/src/agents/safety_node.py`,
  `ai-analytics-service/tests/test_agent_state_contract.py`,
  `docs/agent-tasks/active/refactor--contract-v6-pipeline-ops.md`,
  `docs/ai-contract-version-matrix.md` and
  `src/lib/__tests__/contract-version-matrix.test.ts`.
- Generated `next-env.d.ts` was changed by the production build and restored to
  the branch baseline; it is not part of this diff.

## Current Git state

- HEAD: `1b5e54a08b1760daa357f7a65b6c296aa431118d`.
- Upstream: `origin/main`; branch is 0 ahead and 0 behind its base. No task
  commit exists yet.
- Staged: none.
- Unstaged and untracked: exactly the paths listed in `Changed files` above.
- Visibility: this work is available only in
  `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo-v6-pipeline`
  until a commit is created.

## Verification evidence

### Passed

- Original worktree: `git diff --check` and
  `node --import tsx --test src/components/round/__tests__/round-threshold-next-step.test.tsx`
  — 7/7 passed before isolation.
- `GET https://shalomut-ai-analytics.onrender.com/health` — `online`, commit
  `1b5e54a`, supported versions `1.0`–`5.0`.
- Read-only deployed `prisma migrate status` against the non-loopback Supabase
  pooler — command reached the database and reported seven known migrations.
- Behavior-neutral extraction slices: 70/70 support, 72/72 state, 70/70
  privacy, 97/97 intervention, 137/137 safety, 96/96 psychologist/facade and
  3/3 state/facade boundary tests.
- `python -m pytest` — 290/290 passed; one pre-existing Starlette/httpx
  deprecation warning.
- Targeted corrected Core scenarios — 24/24 passed.
- `npm run verify:core` — version-literal fitness, Prisma generation,
  typecheck, 309/309 TypeScript tests, ESLint and optimized Next.js production
  build all passed.
- `npm run verify:db` against `postgresql://127.0.0.1:5433/shalomut_test` — all
  seven migrations current and 7/7 PostgreSQL tests passed.
- `git diff --check` — passed after the final documentation update.

### Failed

- First `db:status` attempt through `vercel env run` loaded local `.env` files
  and reached `127.0.0.1:5433`; it is explicitly not deployed evidence.
- Direct `vercel env run` from the clean worktree could not read encrypted
  values and the worktree has no dependency installation. Replaced by the
  documented gitignored deployed env file plus the existing dependency runtime.
- Public Core `/api/health/` returned application-level `401`; `vercel curl`
  passed deployment protection but still reached the manager-auth boundary.
- Fail-first producer test observed the intended old-default failure:
  `3.0 !== 5.0` before implementation.
- The first full Core run exposed ten tests that implicitly assumed the old
  default; general scenarios now use the exported default and the contract-3
  dry-run explicitly configures `3.0`. A follow-up repository test exposed the
  same assumption. All corrected tests and the full suite pass.
- An intervention slice initially named a nonexistent test file and stopped
  before collection; the corrected slice used `test_rag_store.py` and passed.

### Blocked or not run

- Deployed migrations were not applied; read-only discovery found
  `20260730120000_add_response_idempotency_constraints` and
  `20260730150000_add_ai_analysis_runs` pending.
- Deployed Core health remains unreadable without manager application auth;
  repository and deployed-AI evidence provide the version boundary instead.
- Commit, push, deployment and deployed migration application were not run.

### Environment

- Clean secondary Git worktree for code discovery.
- Read-only deployed checks against Vercel, Render and the confirmed Supabase
  pooler; no secret values were printed or changed.

### Residual risk

- Core health could not be read through both deployment and application auth;
  its deployed commit and local source still show the same `1.0`–`5.0` boundary.
- `npm ci` reports ten dependency audit findings (one moderate, nine high);
  dependency remediation is outside this behavior-neutral refactor.
- The complete diff is verified locally but remains visible only in this
  worktree until it is committed.

## Failed approaches

- Do not reuse `vercel env run ... db:status` from the primary worktree: local
  dotenv files can override the intended remote target.
- Passing paths to `npm test` does not narrow the suite because
  `scripts/run-tests.mjs` enumerates all tests; use `node --import tsx --test`
  for a focused Core slice.

## Known risks

- A mechanical node split can create circular imports or silently change
  monkeypatch targets; preserve facade imports and run the complete Python
  suite.
- Enabling an undefined `6.0` would create incompatible producer/consumer
  behavior despite registry readiness.

## Approval gates

- Explicit bounded approval is required before applying the two migrations to
  the deployed Supabase database.
- Deployment, secrets/env changes, aliases, commit and push are not authorized.

## Questions requiring an owner decision

- Whether to apply the two pending migrations to the deployed Supabase target
  after local implementation/verification is complete.

## Next concrete step

Review the complete uncommitted diff in this worktree and, if accepted, commit
it on `refactor/contract-v6-pipeline-ops`.
