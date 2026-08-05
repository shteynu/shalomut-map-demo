# The metric narratives say who wrote them

## Metadata

- Branch: `feat/metric-narrative-provenance`
- Base branch: `docs/adr-002-additive-fields`, itself based on `main` (`55d1eea`)
- Base commit: `70fb40c`
- Current HEAD: merged into `main`; landed as `64bc838`, `55e249c`, `8ab17f2`,
  `67048b5`
- Status: landed on `main` on 2026-08-05, pushed by the owner, and deployed
- Last updated: 2026-08-05
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the last known disclosure gap on contract `6.0`: a stone could show three
model-written paragraphs above metric narratives the service derived from the
aggregates, with nothing on screen or on the wire saying which.

## User-visible outcome

The metrics screen of a dimension says, in Hebrew, when the sentence beside
every question was derived from the round's aggregates rather than written by
the model — and says it independently of the overview, which may well have been
the model's. A round analysed before today claims nothing either way.

## Context

`generationProvenance.outcome` describes the dimension's overview only. The
narratives come from a separate call (`generate_metric_insights_result`) that
falls back on its own, and its outcome was computed and then discarded in
`psychologist_node`. A rate-limited key produces exactly the mixture: the short
summary prompt answers, the longer narrative one times out.

Unblocked by the ADR-002 amendment clause settled earlier the same day, and its
first use: this is an optional additive field on published `6.0`, not a `7.0`.

## Scope

- `generationProvenance.metricInsightsOutcome` on the wire, in the `6.0`
  manifest, in Python's node, safety gate and outgoing gate, and in Core's
  callback validation.
- `DashboardStone.metricNarrativesAreDeterministic` and the note on the metrics
  screen.
- `ai_deterministic_metric_narrative_ratio_sample`.
- Two refused cases and one amended accepted case in the shared corpus.
- `docs/openapi.yaml`: the new field, plus `unavailableReason` and the
  `unavailable` outcome, which the partial-map slice put on the wire and never
  documented. `public/openapi.json` regenerated from it.

## Non-goals

- No new contract version, and no change to `5.0` or below beyond refusing a
  field they have no narratives for.
- No per-narrative granularity. One call writes every narrative of a dimension,
  so one outcome is the whole truth; a field per narrative would be finer than
  the thing it describes.
- No `unavailable` value. A dimension whose overview is a gap still owes its
  narratives.

## Acceptance criteria

- A round where the overview falls back and the narratives are the model's is
  labelled differently from one where both fall back, proved through the real
  graph rather than by calling the writer.
- A stone that is a gap still says who wrote its narratives.
- The field is refused on a version without narrative metrics, and refused with
  any value outside the two, by both runtimes.
- A round analysed before the field existed stays valid and produces no note and
  no metric sample.

## Relevant repository instructions

`AGENTS.md` contract rule and `PROJECT_CONTEXT.md` ADR-002 as amended: an
optional additive field on a published version, consumer-first, recorded in
manifest, matrix and ADR. `.agents/skills/shalomut-map/SKILL.md` for the
Dashboard DTO boundary and RTL/WCAG copy.

## Relevant architecture and contracts

`PROJECT_CONTEXT.md` ADR-002 and ADR-007; `contracts/ai-analytics-v6.json`;
`src/lib/ai-contract.ts`; `ai-analytics-service/src/agents/psychologist_node.py`.

## Decisions made

- **One outcome per dimension, not per narrative.** They are written in one
  exact-coverage call and fall back together.
- **No `unavailable`.** The gap covers the overview; the narratives are still
  somebody's copy.
- **The note lives on the metrics screen, not the overview.** That is where the
  sentences are, and the overview may be the model's.
- **Optional on the wire, and not required by the safety gate.** An over-strict
  internal gate would turn a missing label into a failed round, which costs the
  manager the whole map to protect a disclosure. Presence is asserted by the
  graph tests instead.
- **The metric sample skips rounds that recorded nothing** rather than counting
  them as model-written — the one direction a provenance metric must not drift.

## Assumptions

None left open; each was checked in code rather than assumed.

## Completed

Everything in `Scope`. Both runtimes validate the field, both produce it, the
screens use it, and the shared corpus judges it from both sides.

## In progress

Nothing.

## Remaining

Push. Optionally, a browser check of the note against a locally analysed round.

## Changed files

Python: `agents/state.py`, `agents/psychologist_node.py`, `agents/safety_node.py`,
`schemas/stone_map_validation.py`, `tests/test_contract_v6.py`.
Core: `lib/ai-contract.ts`, `lib/ai-insights-view-model.ts`,
`lib/dashboard/dashboard-insights.ts`, `lib/server/ai-operational-metrics.ts`,
`lib/server/ai-insights-service.ts`,
`components/dashboard/dashboard-metrics-page.tsx`, four test files.
Shared: `contracts/ai-analytics-v6.json`, `contracts/fixtures/callback_corpus.json`,
`docs/openapi.yaml`, `public/openapi.json`.
Docs: `PROJECT_CONTEXT.md` (ADR-007), `docs/ai-contract-version-matrix.md`,
`PROGRESS.md`, `docs/shalomut-tracker-handoff.md`.

## Verification evidence

### Passed

- `npm run verify:core`, exit code 0: 565 TypeScript tests, both fitness checks,
  typecheck, ESLint and the production build.
- `npm run verify:ai`, exit code 0: 446 Python tests.
- The two new graph tests exercise the real `analytics_graph`, not the writer:
  one asserts both outcomes are `deterministic_fallback` on a silent provider,
  the other asserts the mixture (`outcome: deterministic_fallback`,
  `metricInsightsOutcome: llm`). A third asserts a stated gap still carries a
  narrative outcome. They read the key directly, so a dropped field is a
  `KeyError`, not a silent pass.
- The shared corpus is judged by both runtimes: two refused cases
  (`metric_insights_outcome_invalid` on an invented value and on `5.0`) and the
  accepted partial `6.0` payload now stating an outcome.

### Failed

None.

### Blocked or not run

- `npm run verify:db` — not run and not applicable: no schema, migration or
  repository changed.
- **No browser check.** Local PostgreSQL is not running, and rendering the note
  for real needs a seeded round analysed by the provider on `6.0` with the
  narrative call falling back. The screen is covered instead by a server-render
  test asserting the exact Hebrew string, its absence on an unlabelled round,
  and its absence when only the *overview* was derived.
- No deployed check. Nothing here is deployed yet.

### Environment

Local worktree. No database, no deployment and no provider call.

### Residual risk

Low. The field is optional everywhere, absent on every existing round, and the
screens only ever add a note — they never claim a model wrote anything.

## Failed approaches

None.

## Known risks

The safety gate does not require the field on `6.0`, so a future producer change
that stops writing it would be caught by the graph tests and by the operational
sample going silent, not by a failing round. That is the deliberate trade in
`Decisions made`.

## Approval gates

None. `.idea/shalomut-map-demo.iml` and `next-env.d.ts` were already modified
before this task and stay unstaged.

## Questions requiring an owner decision

None.

## Git state

Merged. `origin/main` is `67048b5`, which carries this branch and the
`docs/adr-002-additive-fields` branch it sat on. Both can be deleted.

## Deployment

Confirmed read-only on 2026-08-05, after the push: the Render service reports
`commit: 67048b5` at `/health` with `1.0`–`6.0` supported, and the Vercel
Production alias holds `dpl_3Zbn5Zj4Gkn57o8GaKFe3ha3yLqT`, READY and PROMOTED,
built from `main` at `67048b5`. Both runtimes are on the tip.

No round has exercised the new field against a real provider yet, so nothing
here is evidence about what the model writes — only about which code is running.

## Next concrete step

None. Landed, deployed and closed.
