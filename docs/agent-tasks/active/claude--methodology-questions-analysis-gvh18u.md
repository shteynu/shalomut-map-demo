# Proposed answers to the six methodologist questions

## Metadata

- Branch: `claude/methodology-questions-analysis-gvh18u`
- Base branch: `main`
- Base commit: `f47959e`
- Current HEAD: the commit carrying this file, on top of `8d8d4e0` (the
  instrument) and `9813c44` (the analysis)
- Status: three steps on one branch — analysis, instrument, contract `7.0` —
  each committed; the third is the consumer-side of the rollout, verified by
  `verify:core` and not deployed
- Last updated: 2026-09-12
- Last agent/tool: Claude Code

## Objective

Three steps on one branch, each the "next step" the previous one named. First,
the owner asked the agent to analyse and answer the six questions in
`docs/methodologist-questions-2026-08-15-ru.md` itself — a proposal the
methodologist can confirm or correct. Then "do the next step": author the 126
items as data from its §2 table, read as accepting the proposal's defaults
(variant A for burnout, notes 1, 2 and 4, the §7 defect resolutions) as the
working mapping. Then "go": phase 5 of the instrument plan, contract `7.0`,
consumer-first, as far as a container with no deployment access can take it.

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

Step 3, contract `7.0` (ADR-056):

- `contracts/ai-analytics-v7.json` and the `7.0` entry in `capabilities.json`,
  with a new flag `carriesAnswerScale` declared false on every earlier version
  and read by both registries.
- Python: `contracts.py`, the input parser (required `scaleId`/`polarity` on
  `7.0`), canonical models and the output encoder (echo both), the psychologist
  node (no metric batch on a version without narrative metrics), the safety
  node, the outgoing gate (`v7_metric_insight_forbidden`,
  `v7_answer_scale_missing`, both non-repairable), the prompts (a polarity rule
  appended only when aggregates carry one), the version-literal gate regex.
- Core: the aggregate types and the canonical analytics (scale and polarity
  always computed), the encoder (sent on `7.0` only), the input validator, the
  contract module (`StoneMetricV7`, `StoneDetailV7`, `isValidV7Stone` through a
  shared structured-stone validator), the callback verifier (scale and polarity
  checked against the persisted questionnaire), the producible list, published
  analytics (scale read back with the legacy default), the two gates.
- OpenAPI: `StoneMapResultV7` and `RoundAnalyticsResultV7` with their parts,
  both unions and discriminators; `public/openapi.json` regenerated.
- Tests: `test_contract_v7.py` (10), `ai-contract-v7.test.ts` (3),
  `ai-contract-v7-refusals.test.ts` (7), a `7.0` case in `ai-e2e.test.ts`, the
  golden corpus, the matrix, encoder and OpenAPI tests.
- Documents: the version matrix (runtime table, a *Contract `7.0`* section, the
  rollout paragraph), ADR-056, `source-of-truth.md`, `ai-analytics-handoff.md`,
  `PROJECT_CONTEXT.md` ranges, the tracker skill's invariant, both READMEs,
  `.env.example`, `PROGRESS.md`, the handoff, `open-decisions.md`.

Steps 1 and 2:

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

- **No deployment.** Steps 2, 3 and 5 of the matrix's rollout sequence deploy
  Python, deploy Core and change the deployed producer configuration; none can
  be done from this container, and the matrix says so under *Contract `7.0`*.
  The unset producer default stays `5.0`.
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
- **`7.0` is `6.0` minus the metric narrative plus the answer scale**, and no
  more. `scoreDistribution` keeps its shape and gains a definition rather than
  a replacement: the bands of normalised scores are what Core already computes
  and what the Python ranking already consumes. A per-point histogram was
  considered and left out — nothing reads it yet, and a field nothing reads is
  a promise. Scale and polarity travel as strings the way the distribution
  travels as numbers: Core owns them and verifies the echo.
- The refusal-suite gate gained `usesNarrativeMetrics` as a dispatch flag, per
  `shalomut-guardrails`: `7.0` differs from `6.0` on exactly that flag, and
  without it the gate would have reported `7.0` covered by `6.0`'s suite.
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

- Deploying `7.0`: Python first (health must report it), then Core, then
  `AI_ANALYTICS_CONTRACT_VERSION=7.0` on a deployment whose rounds use the
  instrument. Owner actions, per the matrix.
- The swap (phase 6 proper: `createCanonicalSurveyDefinition`, builder
  suggestions, the OpenAPI answer enum) — now unblocked on the contract side
  and blocked only on the decision to make the instrument the default.
- The methodologist's confirmation of the §2 table, which may change rows here.
- The consent screen counts stored questions — it says «150 שאלות» for this
  instrument because a grid is thirteen rows. Pre-existing behaviour (the
  three-row walk said 25), now visible at scale; a count of items rather than
  rows is a small follow-up in `survey-consent-step.tsx`.

## Changed files

Step 3 (this commit): see Scope; 48 files, five of them new
(`contracts/ai-analytics-v7.json`, `tests/test_contract_v7.py`,
`fixtures/v7-payload.ts`, `ai-contract-v7.test.ts`,
`ai-contract-v7-refusals.test.ts`).

Step 2 (`8d8d4e0`):

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

Step 3:

- `npm run verify:core` — exit 0 on the final tree, 2026-09-12: fifteen gates
  passed, typecheck, `npm test` 1683 pass / 0 fail, `verify:ai` (the Python
  suite, 601 passed), lint clean, build compiled. Two earlier runs failed and
  were fixed before this one: the mutation-config gate wanted the two new
  `7.0` suites listed in `stryker.config.mjs`, and three tests had used `7.0`
  as their example of a version that does not exist (now `8.0`).
- Python: 601 passed after the change (587 before; +10 in `test_contract_v7.py`,
  +1 registry, the corpus test now covers `7.0`);
  `scripts/check_version_literals.py` clean.
- The stub pipeline was run by hand on a `7.0` input before the e2e was
  written: `status: success`, `7.0`, metrics with scale and polarity and no
  narrative, three paragraphs, five recommendations.
- `ai-e2e.test.ts` — 4 pass, the new one a mixed-scale, reverse-scored round
  with a background question: the aggregates carry the scale, the reverse-
  scored statement averages 0 with a distribution of ten red, the background
  question never appears, the shipping Python pipeline returns `7.0`, a metric
  whose polarity was tampered is refused with 400, the untampered map is
  accepted, persisted as `7.0` and renders with no narrative-only metric.
- `lint:contract-refusals`: 4 suites cover 6 validation paths across 7
  versions. `lint:literals`, `openapi:check`, the OpenAPI integrity tests
  (documented versions = supported versions) — passed.

Step 2:

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

- Deployed health evidence from both services (matrix step 6): nothing was
  deployed. The version matrix records `7.0` as not deployed.
- `verify:db` not run: no schema change.
- The AI service virtualenv was created in this container for step 3
  (`python3.11 -m venv .venv`, `pip install -e ".[dev]"`), which is what let
  `ai-e2e.test.ts` and `verify:ai` run; step 2's note that they could not is
  superseded.
- ISO 45003:2021 clause structure not verified against the standard's text —
  stated as such in the analysis.

### Environment

Remote container. Local PostgreSQL 16 on `127.0.0.1:5433`, started with
`initdb` for the walk and stopped afterwards; `.env` created for it and
removed. No deployed write of any kind.

### Residual risk

- `7.0` has never been produced by a real provider call, only by the fallback
  path and the local stub. The prompts gained one sentence about polarity;
  whether a model honours it is an eval question, not a contract one, and the
  eval corpus still runs `6.0`.
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

Owner: deploy the AI service from this branch's landing and confirm
`GET /api/health` on it reports `7.0`; then deploy Core. Until a round exists
on the instrument, leave `AI_ANALYTICS_CONTRACT_VERSION` at `6.0`. The
engineering step after that is the swap of the default questionnaire, which is
a product decision the owner has not yet taken.
