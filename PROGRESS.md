# Shalomut Map — product progress

Updated: 2026-08-02. This file is a concise product-level milestone record, not
a session log. Branch evidence lives in `docs/agent-tasks/archive/`; current
deployed state and approval gates live in `docs/shalomut-tracker-handoff.md`.

## Current state

- `origin/main` is `278ba9b` after the 2026-08-02 refactoring stack was merged
  and published.
- Contract `6.0` is deployed end to end and the deployed Core explicitly
  produces it. The unset configuration default remains rollback-safe `5.0`.
- The six latest architecture slices are in `main`: separate AI-insights
  repository, thin callback route, canonical Core analytics input, canonical
  Python analysis output, application runner ports and `TextGenerator`.
- The combined refactoring checkpoint passed `npm run verify:core` with 352
  TypeScript tests and the full Python suite with 368 tests. Those counts are
  checkpoint evidence, not evergreen expectations.
- All seven repository migrations were applied to the confirmed deployed
  database and to the local test database at the recorded checkpoint.
- There are no real respondents or production data. The deployed Vercel alias
  remains an operational staging endpoint for the design stage.

## Completed product capabilities

### Survey and manager workflow

- Persisted organization onboarding, round setup and share-code distribution.
- Dynamic round-scoped questionnaire snapshots with the original 24 questions
  as the default/legacy template.
- Builder editing, enable/required controls, duplication, dimension coverage,
  template suggestions and AI-generated suggestions. An AI suggestion names
  its source and must be edited by a manager before it can be added.
- Anonymous respondent flow with stable attempt tokens and database-enforced
  idempotency.
- Application-level manager session, server-owned organization scope and
  fail-closed deployed authentication configuration.

### Privacy and analytics

- Ten is the default and minimum privacy threshold; managers can only raise it.
- Total and per-question privacy gates prevent partial unlocked analysis.
- Core owns deterministic aggregates, statuses and callback evidence checks.
- Dashboard, round and detail routes show honest locked, queued/running, ready,
  failed, missing and refresh states without exposing service internals.
- Green dimensions are strengths to preserve; yellow/red use attention or
  improvement semantics.

### AI analytics

- Separate FastAPI service with MCP input, durable Core-owned jobs,
  lease/heartbeat recovery and idempotent callback completion.
- Published contracts `1.0`–`6.0` with shared capability metadata, version
  fitness checks, OpenAPI coverage and cross-runtime accepted/refused corpora.
- Exact dynamic questions, school background context and per-question
  green/yellow/red distributions reach generation according to version
  capability.
- V6 returns three-part summaries, qualitative question insights and exactly
  five recommendations per stone while retaining numeric callback evidence.
- Provider failure is visible. Safety repair is selective and Python validates
  its own outgoing payload before callback.

### Architecture and verification

- Core domain calculation is separated from wire encoding through
  `CanonicalRoundAnalytics` and `encodeAnalyticsInput`.
- Python uses `CanonicalAnalysisInput`, a single output adapter and application
  ports for analytics source, result sink, job store, runner and text generator.
- Core wires every repository in one composition root; only entrypoints resolve
  it, and a fitness check in `npm run verify` keeps that boundary.
- CI runs TypeScript tests/types/lint/build, PostgreSQL integration tests and
  the full Python suite through `npm run verify`; CodeQL covers TypeScript and
  Python.
- StrykerJS provides an opt-in, non-blocking mutation pilot for
  `src/lib/ai-contract.ts`. It is not repository-wide coverage or a CI gate.

## Next up

### Product

1. Comparative multi-round analytics across semesters.
2. Decide whether recommendations become tracked goals/action plans.
3. Improve survey-builder recovery/search/bulk/reorder behavior.
4. Complete keyboard/reduced-motion support for the interactive map.
5. Report clipboard permission failure honestly instead of treating it as a
   successful copy.

### Architecture

1. Define a stable `DashboardInsightsDto` and remove production type ownership
   from `src/lib/demo-data.ts`.
2. Choose the long-term identity model before real respondents or multi-tenant
   deployment.
3. Decide whether OpenAPI should be generated from one source.
4. Classify high-value surviving Stryker mutants before expanding mutation
   scope.

## Durable references

- Architecture and invariants: `PROJECT_CONTEXT.md`.
- Product direction: `PRODUCT.md` and `ROADMAP.md`.
- Documentation lifecycle: `docs/README.md`.
- Survey/runtime source roles: `docs/source-of-truth.md`.
- Contract runtime state: `docs/ai-contract-version-matrix.md`.
- Current operational/deployed state: `docs/shalomut-tracker-handoff.md`.
- Final task evidence: `docs/agent-tasks/archive/` and Git history.
