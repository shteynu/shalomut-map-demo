# Shared scoring bands manifest (backlog §9)

## Metadata

- Branch: `feat/shared-scoring-bands`
- Base branch: `main`
- Base commit: `92a62b5` (local; `origin/main` was `a5cf1dc` at branch time)
- Current HEAD: `095e984`
- Status: complete and committed; not pushed
- Note: this branch also carries `92a62b5`, the still-unpushed archive commit
  from the previous task, so publishing it publishes both
- Last updated: 2026-08-03
- Last agent/tool: Claude Code

## Objective

Close backlog §9: make the green/yellow/red score bands configuration rather
than literals, as required by §5.4 of the requirements document.

## User-visible outcome

None. Behaviour is identical with the shipped bands; what changed is where they
are defined.

## Context

The bands existed five times across two runtimes: `computeStatus` and the
methodology table in Core, Core's payload validation in `ai-contract.ts`, and
the service's `mcp_types.status_for_score` plus a private copy in
`stone_map_validation.py`. The docstring on that private copy already said the
bands belonged in the shared manifest.

## Decisions made

- Owner decision 2026-08-03: bands are deployment-wide, not round-scoped. The
  service validates a payload's status against its score, so per-round bands
  would have to travel in the payload — new semantics for contracts `1.0`–`6.0`
  needing their own version and a consumer-first rollout.
- The manifest lives in `contracts/` and is loaded the same way
  `capabilities.json` already is on both sides.
- `DimensionStatus` moved to `scoring_bands.py` and is re-exported from
  `mcp_types`, so the module both runtime boundaries depend on has no imports of
  its own and no cycle appears.
- The per-question distribution keeps its own rule: it counts the colour a
  respondent picked, not an aggregate, so it does not read the bands. The score
  path there is a fallback for a malformed stored row and resolves against the
  response scale.

## Completed

- `contracts/scoring-bands.json` with the shipped bands and the rules they obey.
- `src/lib/scoring-bands.ts` and
  `ai-analytics-service/src/schemas/scoring_bands.py`: validating loaders plus
  `statusForScore`/`status_for_score`.
- All five literal copies replaced by the shared source.
- `scoringThresholds` in `shalomut-source.ts` now derives its numbers from the
  manifest and keeps only its Hebrew labels.
- Tests on both sides, including that Core's scoring, methodology table and
  payload check agree, and that both service call sites are the same function.
- Docs updated: `docs/source-of-truth.md`, `PRODUCT.md`,
  `docs/dashboard-semantic-contract.md`, `PROGRESS.md`, backlog §9 marked
  completed, and the `shalomut-map` skill invariant now names the manifest.

## Remaining

Nothing in this task beyond committing.

## Changed files

- `contracts/scoring-bands.json` (new)
- `src/lib/scoring-bands.ts` (new)
- `src/lib/__tests__/scoring-bands.test.ts` (new)
- `ai-analytics-service/src/schemas/scoring_bands.py` (new)
- `ai-analytics-service/tests/test_scoring_bands.py` (new)
- `src/lib/services/analytics.service.ts`, `src/lib/ai-contract.ts`,
  `src/lib/shalomut-source.ts` (modified)
- `ai-analytics-service/src/schemas/mcp_types.py`,
  `ai-analytics-service/src/schemas/stone_map_validation.py` (modified)
- `PRODUCT.md`, `PROGRESS.md`, `docs/source-of-truth.md`,
  `docs/dashboard-semantic-contract.md`,
  `docs/product-behaviour-backlog.md`,
  `.agents/skills/shalomut-map/SKILL.md` (modified)

Pre-existing unrelated modifications left untouched:
`.idea/shalomut-map-demo.iml`, `next-env.d.ts`.

## Verification evidence

### Passed

- `npm run verify:core`: version-literal and composition-root fitness checks,
  `tsc --noEmit`, 437 TypeScript tests (7 new), ESLint and `next build`.
- `npm run verify:db`: 7 PostgreSQL integration tests against the local
  database.
- `npm run verify:ai`: 375 Python tests (7 new).

### Failed

None.

### Blocked or not run

- No browser verification. The change has no visible surface: the shipped bands
  are unchanged, so every screen renders exactly as before.
- Mutation pilot not run; it is opt-in and scoped to `ai-contract.ts` rules
  rather than to this module.

### Environment

Local worktree and local PostgreSQL. No deployment, no schema change, no
migration.

### Residual risk

Low. One residual gap worth naming: nothing mechanically prevents a future
change from writing `score >= 75` again. The literal-guard scripts cover
contract versions, not bands; the new tests catch a drifting copy only in the
call sites they name.

Operational note: because the bands are deployment-wide and both runtimes read
the same file, changing them requires deploying Core and the AI service
together. Deploying only one would make the service refuse payloads whose
status no longer matches its own bands.

## Approval gates

None. No secrets, credentials, authentication configuration or alias changes.

## Questions requiring an owner decision

None open.

## Next concrete step

The owner runs `git push origin feat/shared-scoring-bands:main`; pushing is
blocked for the agent in this environment. Until then the work exists only in
this worktree. Archive this file once it lands.
