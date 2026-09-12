# From the methodologist's questions to contract `7.0`

## Metadata

- Branch: `claude/methodology-questions-analysis-gvh18u`
- Base branch: `main` at `f47959e`
- Current HEAD: the commit carrying this file, on top of `23b6f72`
- Status: five steps on the branch; the fifth — the swap of the default
  questionnaire — is in this commit. Nothing is deployed
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
5. The swap: the instrument is the default questionnaire, the owner's "Да" to
   the question the task file left open — this commit, ADR-004 as amended.

## User-visible outcome

A new round is born with the research instrument, `טעינת תבנית` in the builder
loads it, the builder's template suggestions come from it, and the consent
screen counts its 126 items rather than 150 stored rows. A respondent meets 16
background screens, two 13-row grids and 13 statement blocks with the 30
unscored statements as optional rows inside their blocks. Rounds created
before the swap keep their questionnaire; a round persisted without a snapshot
is still served the canonical 24.

Until the deployment produces `7.0`, closing a round on the instrument fails
its analysis closed at the MCP boundary (`ContractCannotCarryQuestionnaireError`
names the variable to change) instead of analysing it under `6.0`. The manager
screens still read the round; only its AI analysis waits.

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
- **The swap** — `createDefaultSurveyDefinition` / `defaultSurveyQuestions` in
  `survey-definition.ts` build the instrument and are what `RoundService.createRound`,
  the builder's template button and `templateSuggestionForDimension` read;
  `createCanonicalSurveyDefinition` / `canonicalSurveyQuestions` keep the 24
  as the legacy template behind every fallback (respondent route, submit,
  survey-definition route, answer page, verifier, analytics, backfill, the
  manager-setup legacy branch). `countQuestionnaireItems` in `survey-steps.ts`
  counts a grid once, for the consent screen and the template dialog.
  `encodeAnalyticsInput` refuses a non-colour questionnaire under a version
  without `carriesAnswerScale`. Documents: `source-of-truth.md` (header note,
  decisions, source roles, code map), `PRODUCT.md`, `platform-handbook.md` §4,
  ADR-004 amendment, `docs/README.md` (the plan moves to historical, marked
  delivered), the plan's own header, `PROGRESS.md`, the handoff,
  `open-decisions.md`, both skills, `.env.example`, the version matrix,
  `shalomut-source.ts` (a source-material entry for the instrument) and the
  provenance comment in `types/backend.ts`.

## Decisions made

- `7.0` is `6.0` minus the metric narrative plus the answer scale, and no
  more. A per-point histogram was considered and left out: nothing reads it.
- An unscored statement is a background question on the scale's anchors, not
  a third question kind and not an analytic question with no dimension.
- SMBM burnout items go to `balance` (negative) as the pilot default; the
  "unscored until an outcome index exists" alternative is recorded beside it.
- The overall-summary prompt needs no polarity rule: it lists dimension
  scores and summed distributions, never per-question averages (checked).
- The legacy factory keeps its name and its 24. Renaming `canonical*` would
  have touched every fallback and every fixture for a word; a second, named
  factory for the default says which question each answers, and the
  manager-setup legacy branch — which persists what an old round has in fact
  been running — deliberately stays on the legacy one.
- Fail closed, at the wire, not at dispatch: the closure dispatch knows only
  a threshold and a count, and the MCP tool is the one place every analysis
  run passes through. A refusal there fails the run before a provider call is
  paid for; the manager API and the callback verifier do not go through it.
- Answered in chat, not in a document: whether questionnaires and service
  boundaries can become configuration. Questions, scales, polarity and
  contract capabilities already are; templates would take a registry or a
  catalogue (audit 2026-08-16 options A/B); the eight dimensions are a fixed
  taxonomy by owner decision and making them data would be a product rewrite
  across both services plus catalog content. If the owner wants this kept, it
  belongs beside `docs/questionnaire-modularity-audit-2026-08-16.md`.

## Verification evidence

### Passed

Step 5, the swap:

- `npm run verify:core` — exit 0 on the final tree: fifteen gates, typecheck,
  `npm test` 1686/1686, `verify:ai` 601 passed, lint, build. Two
  earlier runs found four tests that pinned "a new round is born with 24"
  (`new-round-questionnaire`, `manager-setup.service`, `api.test`,
  `analytics.service.test`) and the suggestion test reading the legacy
  template; all repointed at `defaultSurveyQuestions()`. New tests: the
  default factory is the instrument and the legacy one still the 24, the item
  count (126 for the instrument, 24 for the legacy, a grid once), and the
  encoder refusing a Likert questionnaire under `6.0`/`5.0`/`4.0` while
  accepting it under `7.0`, a colour questionnaire under any, and a locked
  round under any.
- **Browser walk of the swap, production build on `127.0.0.1:3210`** against
  a throwaway PostgreSQL 16 seeded with `seed-local.ts`, as the manager and
  then as a respondent: sign-in, `/setup?round=new`, a new round
  «סבב על שאלון המחקר» created through `PUT /api/manager/setup` — 200,
  **draft, 150 stored questions, `instrumentId` of the instrument**; the
  builder on that round reads «150 שאלות פעילות, מתוכן 77 שאלות חובה» (78
  scored minus the optional harassment item) and the section
  «משאבים בעבודה»; «שמירה והכנה להפצה» — 200, the round is `active`; the share
  link as a stranger shows «126 שאלות, כ־23 דקות» and the first of 31 steps.
  The first attempt of this walk ran against the previous build and produced
  a 24-question round, which is how the stale `.next` was noticed; the
  evidence above is from the rebuilt server.

Steps 1–4:

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

Remote container. For the swap walk a throwaway PostgreSQL 16 was started
under `/var/lib/postgresql/shalomut-walk` (the scratchpad's permissions were
being reset from outside and killed the first instance), a `.env` with the
local database, `MANAGER_ADMIN_EMAIL` and the smoke password was created, and
all three were removed afterwards. The AI service virtualenv was created here
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
- The builder's own counter still counts stored rows («150 שאלות פעילות»)
  while the consent screen and the template dialog count items (126). Both
  are true; a manager reading both screens sees two numbers for one
  questionnaire.
- A deployment that lands this branch with `AI_ANALYTICS_CONTRACT_VERSION`
  still at `6.0` refuses to analyse every new round (closed, with the reason
  in the run's failure) until the variable moves to `7.0`. Intended, and
  written in `.env.example` and the matrix, but it is the one way this branch
  can surprise the owner on deploy.

## Git state

Committed and pushed: `9813c44`, `8d8d4e0`, `7674f73`, `150c335` and this
file's commit, all on `origin/claude/methodology-questions-analysis-gvh18u`.
Nothing staged, unstaged or untracked. `main` is still `f47959e`; landing the
branch is the owner's.

## Approval gates

None on the branch. Deploying either service, changing the deployed producer
configuration and sending the analysis to the methodologist are the owner's.

## Questions requiring an owner decision

- Whether the analysis goes to the methodologist as a draft reply — an action
  outside the repository.

## Next concrete step

Owner: land the branch on `main`, deploy the AI service and confirm its
`GET /api/health` reports `7.0`, then deploy Core with
`AI_ANALYTICS_CONTRACT_VERSION=7.0` — in that order, because after this branch
every new round is on the instrument and a Core still producing `6.0` refuses
to analyse it. No engineering step is queued behind that; the methodologist's
corrections to the mapping, if any, are edits to the table and the module.
