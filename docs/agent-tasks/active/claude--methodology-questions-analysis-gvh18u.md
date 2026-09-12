# Proposed answers to the six methodologist questions

## Metadata

- Branch: `claude/methodology-questions-analysis-gvh18u`
- Base branch: `main`
- Base commit: `f47959e`
- Current HEAD: the commit carrying this file, on top of `9813c44` (the analysis)
- Status: analysis landed; the instrument is authored as data under it, verified
  by unit tests and a browser walk; committed and pushed
- Last updated: 2026-09-12
- Last agent/tool: Claude Code

## Objective

Two steps on one branch. First, the owner asked the agent to analyse and answer
the six questions in `docs/methodologist-questions-2026-08-15-ru.md` itself,
since the methodologist has not answered — a proposal the methodologist can
confirm or correct rather than compose from scratch. Then the owner said
"do the next step", which the analysis had named: author the 126 items as data
from its §2 table. That is read as accepting the proposal's defaults (variant A
for burnout, notes 1, 2 and 4, the §7 defect resolutions) as the working
mapping, and the documents say so.

## User-visible outcome

None for a manager: the default questionnaire is still the canonical 24 and
nothing offers the instrument yet. For a respondent on a round built from
`createResearchInstrumentDefinition` — today only the local seed's
`--respondent --research` walk — the whole instrument renders: sixteen
background screens, two thirteen-row grids and thirteen statement blocks, with
the thirty unscored statements sitting as optional rows inside their blocks
rather than as thirty screens of their own.

The analysis document itself:
`docs/methodologist-questions-analysis-2026-09-12.md`, a proposed answer to
every question, the full item-to-dimension table with polarity and confidence,
and twelve source-document defects with a proposed resolution each.

## Context

The research instrument itself (Google Doc `1W7bQhdo0oyJ-WL73MmrsZB3XJqNDo_lE`)
was read in full on 2026-09-12 through the owner's Drive connector; until now
the repository held only its shape from the 2026-08-14 plan. The item texts are
quoted in the analysis for the first time.

## Scope

- The analysis document, in Russian, the language of the letter it answers,
  registered in `docs/README.md` and pointed at from `docs/open-decisions.md`.
- `src/lib/research-instrument.ts` — the 126 items as data (150 stored
  questions), `createResearchInstrumentDefinition`, the grid components and
  prompts.
- `optionsForScale` / `scaleMatchingOptions` in `answer-scales.ts`, and
  `buildSurveySteps` seating a background single-choice question whose options
  are a Likert scale's anchors in its section's block. The block step's
  `questions` widened to `SurveyDefinitionQuestion[]`; the one consumer that
  reads per-row fields (`StatementBlock`) reads only common ones.
- `scripts/seed-breakdown-round.ts --respondent --research`.
- Living documents whose owned state moved: `PROGRESS.md`,
  `docs/shalomut-tracker-handoff.md` item 7, `docs/source-of-truth.md` source
  row, the analysis banner, `docs/open-decisions.md` item 6, `docs/README.md`.

## Non-goals

- **Not the swap.** `createCanonicalSurveyDefinition` still builds the 24 and
  the builder's template does not change: contract `6.0` would demand 108
  metric narratives and describe a 1–7 item with three colours (plan §5,
  phase 5). The instrument is reachable only by name until `7.0` exists.
- No edit to the two outgoing letters. A reply against one applies to both, and
  the analysis is that reply's draft, not a seventh question.
- `likert-5-extent-low` stays in the registry although nothing uses it now;
  its comment says to delete it once the owner calls defect 5 a typo, and that
  deletion is a builder-facing change (the scale picker lists it) left for its
  own small branch.
- No sentinel item, burnout index or paired-grid screen — the three future
  features the analysis names (§9.3).

## Decisions made

- Written in Russian, because the letter and the owner's reading language are
  Russian; the repository's English rule covers instructions, not this class of
  document (`AGENTS.md`, *Language*).
- Two evidence labels carried over from the 2026-08-10 strategy document:
  *[проверено]* for what was read in this session, *[по памяти агента]* for
  claims about published scales and standards the agent did not open. The
  ISO 45003 clause-number finding in §5 is the most consequential of the latter
  and is marked as needing a check, not asserted.
- The mapping table was generated from a scratchpad script so that the
  coverage counts (78 scored, 30 unscored; 36 items on `balance`, 3 on
  `self-expression`) match the table. The script is not committed: the table
  is the deliverable and a second copy would drift.
- SMBM burnout items go to `balance` (negative) as the recommended pilot
  default, with the "unscored until an outcome index exists" alternative stated
  beside it, because the product cannot show an outcome that reaches no stone.
- **An unscored statement is a background single-choice question whose options
  are the scale's anchors**, not a third question kind and not an analytic
  question with no dimension. The union was built to refuse the latter, and a
  new kind would have touched every consumer for thirty rows. The cost is one
  rule in `buildSurveySteps` — options matching a Likert scale exactly seat the
  question in the block — and it is exact on label as well as value, so a
  manager's own five options never become a block.
- Scored statements are required and unscored ones optional, per ADR-004: a
  skipped analytic question below the threshold locks the round. The block's
  `(רשות)` mark therefore shows which rows may be skipped, which coincides
  with which rows count; the doc-comments say so rather than claiming the two
  are indistinguishable.
- Defects applied in the data: 1, 2, 3, 5 (`likert-5-extent` for the life
  satisfaction item), 6 (consent copy says 20–25 minutes), 7 (detachment item
  reworded), 8, 9, 10, 11 (typo fixed and the dated salary figure dropped), 12
  (three role options). Q11 (sexual harassment) is optional.

## Assumptions

- The Drive document read on 2026-09-12 is the version the plan of 2026-08-14
  described. Counts match (16 + 2 + 108 across 13 blocks), so it is.

## Completed

- Commit `9813c44`: the analysis, its `docs/README.md` entry and the
  `docs/open-decisions.md` pointers on items 6 and 18–21.
- This commit: everything under Scope.

## In progress

Nothing.

## Remaining

- Phase 5 of the plan: contract `7.0`, consumer-first, then the swap (phase 6
  proper: `createCanonicalSurveyDefinition`, builder suggestions, the OpenAPI
  answer enum, `capabilities.json`).
- The methodologist's confirmation of the §2 table, which may change rows here.
- The consent screen counts stored questions — it says «150 שאלות» for this
  instrument because a grid is thirteen rows. Pre-existing behaviour (the
  three-row walk said 25), now visible at scale; a count of items rather than
  rows is a small follow-up in `survey-consent-step.tsx`.

## Changed files

- `src/lib/research-instrument.ts` (new), `src/lib/survey/answer-scales.ts`,
  `src/lib/survey/survey-steps.ts`
- `src/lib/survey/__tests__/research-instrument.test.ts` (new, 11 tests),
  `src/lib/survey/__tests__/survey-steps.test.ts` (+3)
- `scripts/seed-breakdown-round.ts`
- `PROGRESS.md`, `docs/shalomut-tracker-handoff.md`, `docs/source-of-truth.md`,
  `docs/open-decisions.md`, `docs/README.md`,
  `docs/methodologist-questions-analysis-2026-09-12.md`, this file

## Verification evidence

### Passed

- `npm run typecheck` — exit 0. `npm run lint` — clean. `npm run build` —
  exit 0. `npm run lint:doc-numbers`, `npm run lint:skills` — passed.
- `npm test` — 1667 pass, 3 fail; the three are `ai-e2e.test.ts` and fail on
  the missing `ai-analytics-service/.venv` interpreter before any test body
  runs (see Blocked). The new suites: 11 instrument tests and 3 step tests,
  all passing, alongside the existing step, duration and scale suites.
- **Browser walk, production build on `127.0.0.1:3210`** against a throwaway
  PostgreSQL 16 started for the purpose, migrated with `db:migrate:deploy` and
  seeded with `seed-breakdown-round.ts --respondent --research`. Chromium
  (Playwright, the preinstalled binary) accepted consent («150 שאלות, כ־23
  דקות»), walked **31 steps** — 16 background screens, 2 grids of 13 rows, 13
  blocks — answering the midpoint on every row and 100/0 on the grids, and
  submitted; the thank-you screen appeared. At 400 px the block had zero
  horizontal overflow (`scrollWidth − clientWidth = 0`).
- **The stored response was read back**: 135 answers, 78 with a score and a
  dimension, 57 with neither (30 unscored statements + 26 grid rows + 1 number).
  Per-dimension counts 3/5/7/36/5/9/6/7 as the analysis table says. Polarity:
  `demands-01` = 3 → 50, `burnout-01` = 3 on 1–7 → 67, `demands-14` (unscored)
  → no score, `resources-06` (unscored) → no score.
- Every code claim in the analysis was read, not recalled: the scale steps,
  the bands, the analytic-only filter in `analytics.service.ts:288`, the
  single-choice restriction in `background-breakdown.ts`, and the catalog
  counts computed from `interventions_kb.json` with a script.

### Failed

None attributable to this change.

### Blocked or not run

- `ai-e2e.test.ts` (3 tests): needs the Python virtualenv of the AI service,
  which this container does not have. The change does not touch the AI
  boundary — background questions were already filtered before it.
- `verify:db` not run: no schema change.
- ISO 45003:2021 clause structure not verified against the standard's text —
  stated as such in the analysis.

### Environment

Remote container. Local PostgreSQL 16 on `127.0.0.1:5433`, started with
`initdb` for the walk and stopped afterwards; `.env` created for it and
removed. No deployed write of any kind.

### Residual risk

- The mapping is the agent's, accepted by the owner, not yet the
  methodologist's. A corrected row is an edit to the table and to the module.
- `scaleMatchingOptions` compares labels, so a change to a scale's anchor text
  would silently turn every unscored row of a persisted round back into a
  standalone screen. The scale anchors are declared stable in
  `answer-scales.ts` for a related reason already.

## Failed approaches

None.

## Known risks

None beyond the residual risk above.

## Approval gates

None. Sending the document outside the repository is the owner's action.

## Questions requiring an owner decision

- Whether the analysis goes to the methodologist as a draft reply now that the
  instrument is authored under it.

## Next concrete step

Phase 5 of `docs/default-research-instrument-plan-2026-08-14.md`: a `7.0`
manifest in `contracts/`, a capability entry, and the six-step consumer-first
rollout of `docs/ai-contract-version-matrix.md` — Python first, Core producing
the rollback value throughout. That is the one thing between
`createResearchInstrumentDefinition` and a manager.
