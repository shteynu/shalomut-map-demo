# The round summary and the recommendation wording say who wrote them

## Metadata

- Branch: `claude/fallback-disclosure`
- Base branch: `main`
- Base commit: `3c22977`
- Current HEAD: `3c22977` (work is committed on top of this base; see the
  branch's own log after commit)
- Status: implemented and verified, not merged
- Last updated: 2026-08-19
- Last agent/tool: Claude Code

## Objective

Extend the provenance-disclosure pattern this product already uses at
dimension and metric level — a quiet note plus a suggestion to re-run the
analysis — to the two round-level surfaces that had none: the organizational
summary on the map page, and the recommendation wording on the goals screen.

## User-visible outcome

- The map page's organizational summary carries a quiet note, in the same
  style as the existing dimension-level ones, whenever that sentence is the
  service's own deterministic aggregate rather than model-written prose.
- A dimension's goals screen carries one note, beneath the five recommendation
  cards, whenever every recommendation on that screen is the catalog's
  original wording rather than an adaptation the model wrote for this round.
- Both notes end in the same suggestion the existing notes use: running the
  analysis again may produce a fuller answer.
- No change to any recommendation's title, body or source — only whether a
  note about authorship appears beside it.

## Context

A user question about independent per-dimension fallback ("if the model
doesn't answer one call, only that dimension degrades") led to an audit of
how visible that degradation actually is. The audit found:

- Dimension-level (`summaryIsDeterministic`) and metric-level
  (`metricNarrativesAreDeterministic`) disclosure already existed and worked.
- `adaptationOutcome` already reached the wire on every recommendation
  (`ai-contract.ts`, `adaptationOutcomeRequired: true` in the 6.0 manifest)
  but was never read anywhere in `ai-insights-view-model.ts` or any dashboard
  component — a recommendation adaptation could fall back and nothing said
  so.
- The round-level opening sentence (`overallPsychologicalSummary`) had no
  provenance field on the wire at all, so contract 6.0 could not disclose it
  even in principle.
- On the deployed 6.0 contract, none of `generate_structured_summary_result`,
  `generate_metric_insights_result` or `adapt_interventions_result` raise
  `ProviderUnavailableError` — all three always return a
  `deterministic_fallback`-tagged result instead. That means
  `DashboardPartialMapNotice` (scoped to `outcome: "unavailable"`) does not
  fire for the most likely real-world failure (a silent provider on 6.0);
  the only place that scenario was visible at all was the two per-blob
  notices that already existed. This branch closes the two remaining gaps in
  that existing pattern rather than changing when `unavailable` fires or
  building per-dimension re-run — those were offered as options 2 and 3 and
  were not requested.

## Scope

- Python: a provenance field on the round-level summary, threaded through
  state, the generator, the graph, the canonical schema and the wire encoder.
- TypeScript: the matching wire field, its validator, the view-model mapping
  for both the summary and every recommendation's `adaptationOutcome`, and
  the two new UI notices.
- Contract manifest and docs: `contracts/ai-analytics-v6.json`,
  `docs/ai-contract-version-matrix.md`, `PROJECT_CONTEXT.md` (ADR-007).

## Non-goals

- Changing `DashboardPartialMapNotice`'s gating condition to also cover
  `deterministic_fallback`. That is option 2 from the research and was not
  requested.
- Building true per-dimension re-run (re-running one dimension's analysis
  without repeating the whole round). That is option 3 and was not
  requested; a stored `AiAnalysisRun` still starts every field empty on a
  fresh run, so nothing here changes what re-running means.
- Per-recommendation-card disclosure. One call adapts every recommendation of
  a dimension together in practice, and the cards are space-constrained, so
  one note per set follows `DashboardPartialMapNotice`'s own precedent
  ("one banner for a set") rather than the in-blob pattern.

## Acceptance criteria

- A payload with `overallSummaryOutcome: "deterministic_fallback"` on
  contract 6.0 renders the map-page note; `"llm"` or absent renders none.
- A payload with `overallSummaryOutcome` present on any contract without
  `usesStructuredDimensionSummary` (1.0–5.0) is refused, mirroring how
  `metricInsightsOutcome` is refused on 5.0.
- A dimension whose recommendations are all `adaptationOutcome:
  "deterministic_fallback"` shows the note on its goals screen; a dimension
  with even one `"llm"` recommendation shows none.
- Full Python and Node suites pass; typecheck and lint are clean; the
  mutation run for `ai-contract.ts` does not regress and the two lines this
  branch added coverage requirements for are killed, not merely covered.

## Relevant repository instructions

- ADR-002's optional-additive-field rule governed the new wire field:
  optional, absence keeps every prior version's meaning, recorded in the
  manifest, the version matrix and the owning ADR.
- ADR-007 ("provider failure is visible, not disguised") is the ADR this
  branch extends; the new paragraph in `PROJECT_CONTEXT.md` is under that
  heading, not a new one.
- `.agents/skills/shalomut-verification/references/mutation-testing.md`
  requires a full `test:mutation:ai-contract` run, not just a dry run,
  whenever the validator itself changes — it did, so the full run happened
  twice (see Verification evidence).

## Relevant architecture and contracts

- `TextGenerator` protocol (`ports.py`): all five operations return `Any`,
  not a concrete type, precisely so an implementation can carry provenance.
  `generate_overall_summary` moved from `-> str` to `-> Any` here to match
  its four siblings, which had already made that move.
- The generation-provenance dataclass shape
  (`{text, outcome, attempts}`) that `InterpretationGeneration`,
  `StructuredSummaryGeneration`, `MetricInsightsGeneration` and
  `AdaptedIntervention` already use. `OverallSummaryGeneration` is the fifth.
- `usesStructuredDimensionSummary` — true only for contract 6.0 — is the same
  capability flag `isValidMetricInsightsOutcome` already gates on;
  `isValidOverallSummaryOutcome` mirrors it exactly.

## Decisions made

- **Dataclass over a bare string return.** `generate_overall_summary` used to
  return `str`; every other generator on this protocol already returns a
  provenance-carrying dataclass. Matching the existing shape (rather than,
  say, a second return value or an out-parameter) means
  `psychologist_node.py` handles all five operations the same way.
- **The field lives at payload level, not inside `generationProvenance`.**
  `overallPsychologicalSummary` itself is payload-level, so
  `overallSummaryOutcome` sits beside it rather than inside any one stone's
  provenance block — there is no single stone it belongs to.
- **"every", not "some", for the recommendations note.** A note claiming a
  whole set is catalog text would be wrong if only part of it were. Checked
  per entry despite one call adapting all five in practice, because that
  uniformity is not a contract guarantee — the payload shape is what's
  checked.
- **One note for the set of recommendation cards, not one per card.** Follows
  `DashboardPartialMapNotice`'s own precedent of one banner for a set, and
  respects the auto-fit "blob" cards' space constraint.
- **CSS selector generalized from `.dashboard-single-blob-copy
  p.dashboard-blob-provenance` to bare `p.dashboard-blob-provenance`.** The
  note now appears outside that single-blob container (map page, goals
  screen), so the old scoped selector would have silently not applied.
  Re-verified the 0.82-opacity contrast measurement (6.02:1, against the
  hardest case — a red dimension surface) still holds in both new contexts;
  the map page's summary section uses a neutral
  `--surface-panel-strong` background, not a saturated dimension color.

## Assumptions

- The Hebrew copy for both new notices follows the same tone and length as
  the three existing provenance notices (dimension summary, metric
  narratives, partial-map banner): state what happened, state what stayed
  true (the content itself, not invented), suggest re-running.
- No product screen needed a way to distinguish "some but not all
  recommendations are deterministic" from "all are" — the acceptance
  criteria above cover only the all-or-none case because that's what one
  call producing all five entries actually yields in practice.

## Completed

- Python: `OverallSummaryGeneration` dataclass; `generate_overall_summary`
  returns it on all three paths (pre-6.0 deterministic, 6.0 fallback, 6.0
  success); `ports.py` protocol signature widened to `Any`;
  `psychologist_node.py` threads `overall_summary_outcome` through the
  `keeps_summary` short-circuit and the generation call alike;
  `graph.py` and `canonical.py` carry it to the encoder; `analytics_output.py`
  puts it on the wire only when `usesStructuredDimensionSummary` and the
  value is present.
- Contract manifest (`contracts/ai-analytics-v6.json`): `provenanceField`,
  `provenanceOutcomes`, `provenanceOptional` under
  `output.overallPsychologicalSummary`.
- Docs: `docs/ai-contract-version-matrix.md` (new field paragraph, added to
  the "amending a published version" list); `PROJECT_CONTEXT.md` (ADR-007
  paragraph covering both the summary field and the recommendations UI).
- TypeScript: `overallSummaryOutcome` on `StoneMapResult`;
  `isValidOverallSummaryOutcome` wired into `validateStoneMapResult`;
  `overallSummaryIsDeterministic` on `DashboardInsightsDto` and
  `interventionIsDeterministic` on `DashboardRecommendation`, both mapped in
  `ai-insights-view-model.ts`.
- UI: `DashboardOverviewSummary` (map page) and `DashboardRecommendationsStage`
  (goals screen) each render a `p.dashboard-blob-provenance` note under the
  same condition their sibling screens already use; `globals.css` selector
  generalized, `.dashboard-recommendations-provenance` added for the
  section-level placement.
- Tests: Python — `test_analytics_output.py`,
  `test_contract_v6.py` (including a graph-level test that mutation-proved
  the wiring by temporarily removing it and confirming `KeyError`),
  `test_contract_v5.py`, `test_agent_state_contract.py`,
  `test_text_generator_port.py`, `test_replay_targets.py`,
  `test_outgoing_payload_gate.py`. TypeScript —
  `dashboard-semantic-quality.test.tsx` (two new render tests),
  `dashboard-dto-rendering.test.tsx`, `round-threshold-next-step.test.tsx`,
  `goal-rows.test.ts` fixture updates, and — added after the first full
  mutation run surfaced two uncovered lines in the new validator — two new
  cases in `ai-contract-v6.test.ts` (accept/reject `overallSummaryOutcome`
  values) and `ai-contract-v5-refusals.test.ts` (a 5.0 payload refuses the
  field).

## In progress

Nothing.

## Remaining

Nothing on this branch. Merging is the user's call, separately — no merge
has been requested for this branch yet.

## Changed files

29 files: 8 Python source/test files under `ai-analytics-service/`;
`contracts/ai-analytics-v6.json`; `docs/ai-contract-version-matrix.md`;
`PROJECT_CONTEXT.md`; `src/app/globals.css`; 6 TypeScript source files under
`src/lib/` and `src/components/dashboard/`; 6 TypeScript test files. Full
list in `git diff --stat` against `3c22977`.

## Verification evidence

### Passed

- Python: `518 passed` (`.venv/bin/python -m pytest -q`), including the two
  new `test_contract_v6.py` cases, mutation-proven by temporarily deleting
  the `overall_summary_outcome=...` wiring line in `graph.py` and confirming
  both failed with `KeyError: 'overallSummaryOutcome'` before restoring it.
- Node: `1191 passed` (`npm test`; was 1189 before this branch's two new
  contract tests).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run lint:mutation-config` — "13 test files for 2 mutated modules".
- `npm run lint:contract-refusals` — "3 suites cover 5 validation paths
  across 6 contract versions".
- `npm run test:mutation:ai-contract`, run twice because this branch changes
  the validator itself:
  - First run (before the two new contract-refusal cases existed):
    `ai-contract.ts` 94.48% (95.78% of covered code), 49 survived, 16
    no-coverage. Two of those survivors were in this branch's own new code:
    the `if` guarding `isValidOverallSummaryOutcome`'s call site (line 1053)
    and a branch inside the function itself (line 710) — proof the earlier
    Python-side mutation proof didn't extend to the TypeScript validator.
  - Added `ai-contract-v6.test.ts`'s "the round summary says who wrote it,
    independently of any dimension" and
    `ai-contract-v5-refusals.test.ts`'s "a 5.0 payload cannot label a round
    summary it does not carry", mirroring the existing
    `metricInsightsOutcome` tests exactly.
  - Second run: `ai-contract.ts` 95.50% (95.99% of covered code), 47
    survived, 6 no-coverage. Lines 710 and 1053 no longer appear among
    survivors or no-coverage; the remaining 47/6 are pre-existing gaps
    unrelated to this branch, unchanged in identity between the two runs.
    `scoring-bands.ts` (the mutation suite's other target) is untouched by
    this branch and its numbers (90.74%, 5 survived) did not move.
  - Not claiming repository-wide mutation coverage — only that this branch's
    own additions are now proven load-bearing and nothing regressed.
- `npm run build` — compiled and generated all 44 routes.
- `npm run verify:db` — `36 passed` against the disposable local PostgreSQL
  16 cluster at port 5433.
- `next-env.d.ts` reverted with `git checkout --` after both `typecheck` and
  `build`.

### Failed

None.

### Blocked or not run

None. `verify:core`'s full combined run was covered piecewise above (Python
suite, Node suite, typecheck, lint, build, mutation, contract-refusal and
mutation-config lints, DB integration) rather than as one invocation, because
the mutation run needed to happen twice around a mid-verification test
addition.

### Environment

Local only. No deployed environment touched; the DB suite ran against the
disposable local `verifydata` cluster, not any shared database.

### Residual risk

Low. Additive wire field gated by an existing capability flag; the two UI
notices reuse an established, contrast-checked style; no existing field's
meaning or type changed. The main residual risk is the one named in Non-goals:
`DashboardPartialMapNotice` still under-fires for 6.0's actual common failure
mode (silent provider → `deterministic_fallback`, not `unavailable`) — this
branch makes that failure visible at the two points that had no disclosure at
all, but does not change when the overview banner itself fires.

## Failed approaches

None — this branch's own mutation run caught the one real gap (the new
validator's two branches were uncovered by any TypeScript test) before ship,
rather than after a failed attempt.

## Known risks

If a future contract version reuses `overallSummaryOutcome` or
`adaptationOutcome` with a different meaning, `isValidOverallSummaryOutcome`
and the sibling `metricInsightsOutcome`/`adaptationOutcome` validators would
need updating together — they are three independent gates on the same
capability flag, not one shared implementation.

## Approval gates

None. No credentials, secrets, deployment aliases or database state are
touched.

## Questions requiring an owner decision

- Option 2 (make `DashboardPartialMapNotice` also cover
  `deterministic_fallback`, so 6.0's actual common failure shows an
  overview-level banner, not just per-blob notes) and option 3 (true
  per-dimension re-run) remain open, unstarted, and unrequested.

## Next concrete step

Commit this working tree and push to `origin/claude/fallback-disclosure`.
Do not merge — no merge request has been given for this branch.
