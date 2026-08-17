# AI analytics — current cross-service overview

Updated: 2026-08-02. This document explains the current Core/Python boundary.
Contract capability and rollout status is canonical in
`ai-contract-version-matrix.md`; service configuration belongs in
`../ai-analytics-service/README.md`; historical rollout evidence remains in Git
and archived task files.

## Runtime flow

1. A manager closes a round that has reached its privacy threshold, or asks an
   already-closed round for a refresh. A respondent submission dispatches
   nothing (owner decision 2026-08-17).
2. Core commits an idempotent `AiAnalysisRun` before returning.
3. The Python worker polls Core, atomically claims the oldest due run and keeps
   its 90-second lease alive by heartbeat.
4. Core computes `CanonicalRoundAnalytics` from the exact persisted round
   questionnaire and encodes the configured contract at the MCP boundary.
5. Python validates the versioned payload and maps it to
   `CanonicalAnalysisInput`.
6. The graph generates interpretations, summary, narrative metrics and
   recommendations; selective safety replay touches only rejected parts.
7. A single output adapter builds the versioned Stone Map and validates it
   before transport.
8. The callback includes run/lease identity. Core rechecks contract semantics
   and its own numeric/question evidence before idempotent persistence.
9. Dashboard reads durable run state/result and renders locked, running,
   failed or ready UI without exposing provider errors.

The legacy webhook remains a rollback boundary. Durable `AiAnalysisRun` state,
not a `202` response or timestamp, is the execution source of truth.

## Ownership boundary

### Core owns

- organization and manager scope;
- exact `SurveyRound.surveyDefinition` snapshots;
- anonymous responses and database-enforced idempotency;
- privacy threshold enforcement;
- dimension/question aggregates, scores and statuses;
- durable job lifecycle, callback identity and persistence;
- validation of returned numeric evidence and Dashboard rendering.

### Python owns

- validated version-aware generation policy;
- provider transport, pacing, bounded retry and safe logging;
- Hebrew interpretation, summary and narrative generation;
- exact dimension/status intervention selection and adaptation;
- safety validation, selective repair and outgoing payload validation;
- polling/heartbeat behavior behind Core-owned job APIs.

Neither side sends or stores respondent identity in the AI exchange.

## Contracts

- `1.0`: structural legacy exchange.
- `2.0`: immutable exact-24 semantic exchange.
- `3.0`: dynamic exact persisted questionnaire.
- `4.0`: school background context.
- `5.0`: per-question score distributions, partial-map/adaptation semantics.
- `6.0`: structured three-part summaries, narrative metrics and exactly five
  recommendations per stone; successful output returns all eight stones.

Shared capability policy is `../contracts/capabilities.json`. Core can produce
`3.0`–`6.0`; an unset producer setting means rollback-safe `5.0`, while the
deployed environment explicitly selects `6.0`. Both runtimes accept the
versions required by `1.0`–`6.0` callback/parser compatibility.

Published versions are not edited silently. A new incompatible exchange gets a
new manifest and rolls out consumer-first.

## Privacy and failure behavior

- Total responses and every enabled analyzed question must meet the configured
  threshold before any detailed aggregate reaches Python.
- A single low-count question locks the whole detailed result. The system does
  not drop it and invent a partial unlocked map.
- Provider failure after bounded attempts produces a visible failed analysis;
  yellow/red copy is never fabricated.
- A green dimension may use one aggregate-grounded deterministic sentence. Its
  provenance remains `deterministic_fallback` with the actual attempt count.
- Raw provider/configuration/transport errors never reach the manager UI.
- Python validates the assembled payload before callback; Core validates it
  again against recomputed round facts.

## Architecture after the 2026-08-02 refactor

Core calculation no longer constructs version-specific wire data. The domain
returns `CanonicalRoundAnalytics`; `encodeAnalyticsInput` applies capabilities
at MCP/manager/callback comparison boundaries. AI results use a separate
`IAiInsightsRepository` from round records, without changing current storage.
The callback route is transport-focused; orchestration and evidence checking
live in server services.

Python uses:

- `AnalyticsSource` for aggregate input;
- `ResultSink` for callback delivery;
- `JobStore` for durable claim/heartbeat/failure operations;
- `AnalysisRunner` for worker orchestration;
- `TextGenerator` for the five model-facing operations;
- `CanonicalAnalysisInput` and `schemas/analytics_output.py` for internal/wire
  separation.

Core has the matching shape since 2026-08-03: `src/lib/composition-root.ts`
constructs every repository and only entrypoints resolve it.

## Verification

- Core and cross-boundary tests: `npm test`.
- Full Core gate: `npm run verify:core`.
- PostgreSQL integration: `npm run verify:db`.
- Full Python suite from repository root: `npm run verify:ai`.
- Canonical all-layer local gate: `npm run verify`.
- Focused non-blocking mutation pilot:
  `npm run test:mutation:ai-contract`.

Mutation testing currently covers `src/lib/ai-contract.ts` only and is not a CI
gate. Exact checkpoint counts belong in archived task evidence, not this guide.
