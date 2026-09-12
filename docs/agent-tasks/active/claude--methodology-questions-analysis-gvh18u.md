# From the methodologist's questions to contract `7.0`

## Metadata

- Branch: `claude/methodology-questions-analysis-gvh18u`
- Base branch: `main` at `f47959e`
- Current HEAD: the commit carrying this file, on top of `150c335`
- Status: four commits landed on the branch and pushed; the branch is four
  commits ahead of `main` and nothing is uncommitted. Consumer-side work on
  `7.0` is complete and verified; nothing is deployed
- Last updated: 2026-09-12
- Last agent/tool: Claude Code

## Objective

One branch, four "next steps" each named by the previous one:

1. Answer the six methodologist questions of
   `docs/methodologist-questions-2026-08-15-ru.md` as a proposal the
   methodologist can confirm or correct — `9813c44`.
2. Author the 126-item research instrument as data from that proposal's §2
   table, the owner's "do the next step" read as accepting its defaults —
   `8d8d4e0`.
3. Contract `7.0`, the instrument-scale exchange, consumer-first as far as a
   container without deployment access can take it — `7674f73`, ADR-056.
4. The shared callback corpus judging `7.0` on both sides — `150c335`.

## User-visible outcome

None for a manager yet: the default questionnaire is still the canonical 24,
nothing offers the instrument, and the deployed services speak `6.0`. A
respondent on a round built from `createResearchInstrumentDefinition` (the
local seed's `--respondent --research` walk) meets the whole instrument: 16
background screens, two 13-row grids, 13 statement blocks with the 30 unscored
statements as optional rows inside their blocks.

## Where things are

- **Analysis** — `docs/methodologist-questions-analysis-2026-09-12.md`
  (Russian, the letter's language): a proposed answer to every question, the
  full item-to-dimension table with polarity and a confidence mark per row,
  the bands read against the 1–5 and 1–7 anchors, twelve source-document
  defects with resolutions. Two evidence labels: *[проверено]* and
  *[по памяти агента]*; the ISO 45003 clause-number finding is the most
  consequential of the latter and is flagged for a check, not asserted.
  Registered in `docs/README.md`; `docs/open-decisions.md` item 6 now waits
  for the methodologist's confirmation rather than for the table.
- **Instrument** — `src/lib/research-instrument.ts`: 126 items as 150 stored
  questions (a grid is thirteen rows). 78 statements scored, 30 collected and
  never scored — written as background single-choice questions whose options
  are the scale's anchors, which `buildSurveySteps` seats in the section's
  block (`scaleMatchingOptions`, exact on value and label). Scored statements
  required, unscored optional (ADR-004: a skipped analytic question below the
  threshold locks the round), so the `(רשות)` mark coincides with what counts.
  Defects 1–12 of the analysis applied in the data; Q11 optional.
- **Contract `7.0`** — `contracts/ai-analytics-v7.json`, capability
  `carriesAnswerScale` (false on every earlier version),
  `usesNarrativeMetrics: false`. Every aggregate names `scaleId` and
  `polarity`, every metric echoes them and Core's verifier checks the echo
  against the persisted questionnaire; `insightText` and
  `metricInsightsOutcome` forbidden; `scoreDistribution` keeps its shape and
  gains its definition (bands of normalised scores). Python: parser, canonical
  models, encoder, psychologist node (no metric batch), safety node, outgoing
  gate (`v7_metric_insight_forbidden`, `v7_answer_scale_missing`,
  non-repairable), prompts (a polarity rule appended only when aggregates
  carry one). Core: types, canonical analytics, encoder, input validator,
  `StoneMetricV7`/`StoneDetailV7`/`isValidV7Stone` over a shared
  structured-stone validator, verifier, producible list (unset default still
  `5.0`), published analytics reading the scale back with the legacy default.
  OpenAPI on both sides; both version-literal gates accept `7.0`; the
  refusal-suite gate groups by `usesNarrativeMetrics` too, so `7.0` has its
  own path and suite. Documents: version matrix (*Contract `7.0`* section
  with the rollout state), ADR-056, `source-of-truth.md`,
  `ai-analytics-handoff.md`, `PROJECT_CONTEXT.md`, both READMEs,
  `.env.example`, the tracker skill's invariant, `PROGRESS.md`, the handoff.
- **Corpora** — golden corpus and callback corpus both carry `7.0`; the
  callback corpus's four refused mutations are judged by the same rule name
  in both runtimes.

## Decisions made

- `7.0` is `6.0` minus the metric narrative plus the answer scale, and no
  more. A per-point histogram was considered and left out: nothing reads it.
- An unscored statement is a background question on the scale's anchors, not
  a third question kind and not an analytic question with no dimension.
- SMBM burnout items go to `balance` (negative) as the pilot default; the
  "unscored until an outcome index exists" alternative is recorded beside it.
- The overall-summary prompt needs no polarity rule: it lists dimension
  scores and summed distributions, never per-question averages (checked).
- Answered in chat, not in a document: whether questionnaires and service
  boundaries can become configuration. Questions, scales, polarity and
  contract capabilities already are; templates would take a registry or a
  catalogue (audit 2026-08-16 options A/B); the eight dimensions are a fixed
  taxonomy by owner decision and making them data would be a product rewrite
  across both services plus catalog content. If the owner wants this kept, it
  belongs beside `docs/questionnaire-modularity-audit-2026-08-16.md`.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0 on the tree of `7674f73`: fifteen gates,
  typecheck, `npm test` 1683/1683, `verify:ai` 601 passed, lint, build. Two
  earlier runs failed on the mutation-config gate (new suites not listed) and
  on three tests using `7.0` as an unknown version; both fixed before the
  passing run.
- After `150c335`: Python callback-corpus suite 55 passed, Core parity suite
  passed, `lint:fixtures` and `lint:doc-numbers` passed.
- `ai-e2e.test.ts` — 4 pass, including a mixed-scale, reverse-scored round
  with a background question crossing MCP → the shipping Python pipeline →
  callback verification → the Dashboard DTO under `7.0`; a tampered polarity
  is refused with 400; the background question never crosses.
- Step 2: production build browser walk of the instrument (31 steps, no
  overflow at 400 px), the stored response read back — 78 scored answers, 57
  unscored, reverse polarity correct on both scales.

### Failed

None attributable to this branch.

### Blocked or not run

- Deployed health evidence (matrix step 6): nothing deployed; the matrix
  records `7.0` as not deployed.
- `verify:db`: no schema change.
- ISO 45003:2021 clause structure not checked against the standard's text.

### Environment

Remote container. The AI service virtualenv was created here
(`python3.11 -m venv .venv`, `pip install -e ".[dev]"`; git-ignored). A
throwaway PostgreSQL 16 was started for the step-2 walk and stopped. No
deployed write of any kind.

### Residual risk

- `7.0` has never been produced by a real provider call — only the fallback
  path and the local stub. The eval corpus still runs `6.0`, so the polarity
  sentence in the prompts is unmeasured on a model.
- The mapping is the agent's, accepted by the owner, not the methodologist's.
  A corrected row is an edit to the table and to the module.
- `scaleMatchingOptions` compares anchor labels; a changed anchor text would
  turn unscored rows of persisted rounds back into standalone screens.
- The consent screen counts stored questions («150 שאלות»), a grid being
  thirteen rows; pre-existing, now visible at scale.
- A `balance` stone on the instrument has 36 metrics; nobody has looked at
  that screen in a browser.

## Git state

Committed and pushed: `9813c44`, `8d8d4e0`, `7674f73`, `150c335` and this
file's commit, all on `origin/claude/methodology-questions-analysis-gvh18u`.
Nothing staged, unstaged or untracked. `main` is still `f47959e`; landing the
branch is the owner's.

## Approval gates

None on the branch. Deploying either service, changing the deployed producer
configuration and sending the analysis to the methodologist are the owner's.

## Questions requiring an owner decision

- Whether the analysis goes to the methodologist as a draft reply.
- Whether the instrument becomes the default questionnaire (the swap); the
  contract no longer blocks it.

## Next concrete step

Owner: land the branch on `main`, deploy the AI service and confirm its
`GET /api/health` reports `7.0`, then deploy Core; leave
`AI_ANALYTICS_CONTRACT_VERSION` at `6.0` until a round exists on the
instrument. The next engineering step after that is the swap of the default
questionnaire, once the owner decides it.
