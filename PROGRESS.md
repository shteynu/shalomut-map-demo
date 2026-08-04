# Shalomut Map — product progress

Updated: 2026-08-04. This file is a concise product-level milestone record, not
a session log. Branch evidence lives in `docs/agent-tasks/archive/`; current
deployed state and approval gates live in `docs/shalomut-tracker-handoff.md`.

## Current state

- `origin/main` is `26f4c37`: the 2026-08-02 refactoring stack, the Dashboard
  DTO slice, seven manager-facing slices merged on 2026-08-03/04 — shared
  scoring bands, round selection, round creation, the map comparison, map
  keyboard and reduced-motion support, clipboard failure states and the builder
  list work — and three more on 2026-08-04: the single-active-round index, the
  "last saved" line, and the builder's keyboard accelerators.
- `origin/main` moved to `233f905` with the tracked-goals slice, which closed
  the last open item in the product-behaviour backlog.
- The setup screen and the survey builder now open with the round's stored save
  time, so "when did this last save?" survives a reload. It needs the tenth
  migration on the deployed database — see the handoff.
- Contract `6.0` is deployed end to end and the deployed Core explicitly
  produces it. The unset configuration default remains rollback-safe `5.0`.
- The six latest architecture slices are in `main`: separate AI-insights
  repository, thin callback route, canonical Core analytics input, canonical
  Python analysis output, application runner ports and `TextGenerator`.
- The checkpoint at `26f4c37` passed the full `npm run verify`: 498 TypeScript
  tests, 12 PostgreSQL tests and 375 Python tests, with both fitness checks,
  typecheck, ESLint and the production build. The tracked-goals branch passed
  the same gate at its tip, `233f905`, with 529, 18 and 375. Counts are
  checkpoint evidence, not evergreen expectations.
- All nine repository migrations are applied to the confirmed deployed database
  and to the local test database; the ninth, `round_goals`, landed on
  2026-08-04.
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
- Builder search across text, dimension and question id; bulk enable/hide of
  whatever the filter and search leave on screen; and real reordering through
  move-up/move-down buttons rather than a drag handle that did nothing.
- Keyboard accelerators for the per-question actions, read from the physical key
  so they work on a Hebrew layout, listed on screen, and deliberately absent
  from deletion.
- The dashboard reads any round the school owns, chosen from a switcher and
  carried through every dashboard link, with each round read through its own
  snapshot, threshold and analysis. The home screen stays on the active round.
- A school can open a second round from `/setup?round=new`, keeping its own
  details and starting an empty measurement period. A school runs one round at
  a time: a round going live closes the previous one and the builder names it,
  and a partial unique index makes the rule the database's rather than the
  service's alone.
- A recommendation can become a tracked goal: chosen from the dimension's
  recommendations screen, moved through selected, in progress and done, and
  dropped when the school changes its mind. The goal keeps the recommendation's
  words as they read when it was chosen, so it survives the next analysis and
  says so when that analysis no longer recommends it.
- Setup and builder say when their work last reached the database, and say so
  again as "not saved yet" the moment the manager edits. The time is the one the
  save endpoint reports, so it is evidence of a completed write.
- The map shows the change against the previous measured round — per stone and
  overall — naming the round it compared with and skipping any round that never
  reached its privacy threshold.
- Map stones move with the arrow keys as well as the pointer, reset returns
  focus to the map and announces itself, and stone motion is instant under
  `prefers-reduced-motion`.
- A blocked clipboard is reported as a blocked clipboard: the share link is
  selected, the note names Ctrl+C/Cmd+C and stays until the next attempt.
- Anonymous respondent flow with stable attempt tokens and database-enforced
  idempotency.
- Explicit informed consent before the first question, stating the guarantees
  the code owns rather than manager-edited copy; declining sends nothing.
- An unfinished attempt survives a reload of the same tab, consent included,
  and a retry after a lost response completes instead of recording twice.
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
- The green/yellow/red score bands live in `contracts/scoring-bands.json` and
  are read by both runtimes, so tuning the methodology after the pilot is one
  edit rather than five code copies. They are deployment-wide by decision: the
  service checks a payload's status against its score, so per-round bands would
  be new contract semantics.

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
- The Dashboard renders `DashboardInsightsDto` instead of the AI wire payload,
  and `src/lib/demo-data.ts` is gone along with the fixture analysis it held.
- StrykerJS provides an opt-in, non-blocking mutation pilot for
  `src/lib/ai-contract.ts`. It is not repository-wide coverage or a CI gate.
  Its survivors were classified on 2026-08-03, which turned into one refusal
  test per contract rule that had only ever been tested from the accepting
  side; the pilot's score moved 60.00% to 69.34%.
- The OpenAPI specification has one editable source, `docs/openapi.yaml`;
  `public/openapi.json` is generated from it and checked as a whole document.

## Next up

### Product

Nothing open. The last product decision in the backlog — whether recommendations
become tracked goals — was taken on 2026-08-04 and shipped in its minimal form
(§5). What §5 deliberately leaves undecided is whether a goal ever gains an
owner, a due date or a plan of steps.

Cross-round work is **closed for now**: per-round reading and second-round
creation landed on 2026-08-03, the deterministic dimension-level delta and the
partial unique index behind the single-active-round rule on 2026-08-04, and the
owner decided on 2026-08-04 that AI analysis across rounds is not wanted yet.

The backlog was reconciled with the owner's development requirements document
on 2026-08-03. Its opening section records the four points where the shipped
product deliberately differs from that document: the single three-colour answer
scale, deferred viewer/admin roles, the privacy-threshold floor of ten, and
environment separation being infrastructure rather than product behavior.

### Architecture

Nothing open. Mutant classification closed on 2026-08-03; widening mutation
scope is now conditional on giving contracts `1.0`–`4.0` payload fixtures, and
`ROADMAP.md` records why.

The long-term identity model left this list on 2026-08-03: one manager per
deployment is the requested product shape, so it is requirement-gated future
work in `docs/product-behaviour-backlog.md` §8, not an open task. See
`PROJECT_CONTEXT.md` ADR-013 for why swapping the password hash alone does not
close it.

## Durable references

- Architecture and invariants: `PROJECT_CONTEXT.md`.
- Product direction: `PRODUCT.md` and `ROADMAP.md`.
- Documentation lifecycle: `docs/README.md`.
- Survey/runtime source roles: `docs/source-of-truth.md`.
- Contract runtime state: `docs/ai-contract-version-matrix.md`.
- Current operational/deployed state: `docs/shalomut-tracker-handoff.md`.
- Final task evidence: `docs/agent-tasks/archive/` and Git history.
