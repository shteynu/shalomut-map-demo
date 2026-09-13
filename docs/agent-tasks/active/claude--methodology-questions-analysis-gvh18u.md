# From the methodologist's questions to the instrument as default

## Metadata

- Branch: `claude/methodology-questions-analysis-gvh18u`
- Base branch: `main` at `f47959e`
- Current HEAD: the commit carrying this file and step 8 together
- Status: complete on the branch — every commit pushed, nothing uncommitted.
  Nothing is deployed, and the `7.0` eval run waits on a provider key this
  environment does not hold
- Last updated: 2026-09-13
- Last agent/tool: Claude Code

## Objective

One branch, five steps each named as "the next step" by the one before it,
and three follow-ups the owner asked for after the save:

1. `9813c44` — proposed answers to the six methodologist questions of
   `docs/methodologist-questions-2026-08-15-ru.md`, for the methodologist to
   confirm or correct.
2. `8d8d4e0` — the 126-item research instrument authored as data from that
   proposal's §2 table (the owner's "do the next step" read as accepting its
   defaults).
3. `7674f73` — contract `7.0`, the instrument-scale exchange, consumer-side,
   ADR-056.
4. `150c335` — the shared callback corpus judges `7.0` on both sides.
5. `455e33e` — the swap: the instrument is the questionnaire a round is born
   with, the owner's "Да"; ADR-004 as amended.
6. `60b8873` — the builder's «שאלות פעילות» stone counts items, not stored
   rows.
7. `7075de9` — the history list counts items too, in `summariseVersion` and
   in the SQL summary alike.
8. The commit carrying this file — the eval corpus speaks `7.0`: every
   aggregate names its scale and polarity, `run_corpus --contract` keeps
   `6.0` producible for a diff against the old baselines, and a ninth case,
   `reverse-scored`, puts negative-polarity Likert statements in front of the
   prompts. The owner asked for the run itself; it could not be made here.

## User-visible outcome

A new round is born with the research instrument, `טעינת תבנית` loads it, the
builder's template suggestions come from it, and the consent screen and the
builder's summary stone and history list all count its 126 items rather than
150 stored rows, with «מתוכן 77 שאלות חובה» counted the same way. A respondent meets 16 background
screens, two 13-row grids and 13 statement blocks with the 30 unscored
statements as optional rows inside their blocks. Rounds created before the swap
keep their questionnaire; a round persisted without a snapshot is still served
the canonical 24.

Until the deployment produces `7.0`, closing a round on the instrument fails
its analysis closed at the MCP boundary — `ContractCannotCarryQuestionnaireError`
names the variable to change — instead of analysing it under `6.0`. The
manager screens still read the round; only its AI analysis waits.

## Where things are

- **Analysis** — `docs/methodologist-questions-analysis-2026-09-12.md`
  (Russian): every question answered, the full item-to-dimension table with
  polarity and a confidence mark per row, the bands read against the 1–5 and
  1–7 anchors, twelve source-document defects with resolutions. Claims about
  published scales and standards are marked *[по памяти агента]*; the
  ISO 45003 clause numbers in the catalog are flagged for a check. Item 6 of
  `docs/open-decisions.md` now waits for the methodologist's confirmation.
- **Instrument** — `src/lib/research-instrument.ts`: 126 items as 150 stored
  questions. 78 statements scored, 30 collected and never scored as background
  single-choice questions on the scale's anchors, which `buildSurveySteps`
  seats in their block (`scaleMatchingOptions`, exact on value and label).
  Scored statements required, unscored optional. Defects 1–12 applied.
- **Contract `7.0`** — `contracts/ai-analytics-v7.json`, capability
  `carriesAnswerScale`, `usesNarrativeMetrics: false`: every aggregate names
  `scaleId` and `polarity`, every metric echoes them for Core to verify,
  `insightText` and `metricInsightsOutcome` forbidden. Implemented in both
  runtimes, OpenAPI on both sides, own refusal suite (the refusal-suite gate
  groups by `usesNarrativeMetrics` too), golden and callback corpora,
  version matrix section, ADR-056. Producible in Core; the unset default
  stays `5.0`.
- **The swap** — `createDefaultSurveyDefinition` / `defaultSurveyQuestions` in
  `survey-definition.ts` build the instrument for `RoundService.createRound`,
  the builder's template button and `templateSuggestionForDimension`;
  `createCanonicalSurveyDefinition` / `canonicalSurveyQuestions` keep the 24
  behind every fallback and the backfill. `countQuestionnaireItems` in
  `survey-steps.ts` counts a grid once, for the consent screen, the template
  dialog, the builder's summary stone and `summariseVersion` alike; the SQL
  summary in `prisma-survey-definition-version.repository.ts` counts the same
  way by distinct group id, and the database test holds the two side by side
  on the instrument with half a grid disabled. `encodeAnalyticsInput` refuses a
  non-colour questionnaire under a version without `carriesAnswerScale`.
  Documents moved with it: `source-of-truth.md`, `PRODUCT.md`,
  `platform-handbook.md` §4, ADR-004 amendment, `docs/README.md` (the plan is
  historical, marked delivered) and the plan's header, `PROGRESS.md`, the
  handoff, `open-decisions.md`, both skills, `.env.example`, the version
  matrix, `shalomut-source.ts` (source-material entry), `types/backend.ts`.

## Decisions made

- `7.0` is `6.0` minus the metric narrative plus the answer scale, and no
  more; a per-point histogram was left out because nothing reads it.
- An unscored statement is a background question on the scale's anchors, not
  a third kind and not an analytic question with no dimension.
- SMBM burnout items go to `balance` (negative) as the pilot default; the
  alternative is recorded beside it in the analysis.
- The legacy factory keeps its name and its 24; a second, named factory for
  the default says which question each answers. The manager-setup legacy
  branch stays on the legacy one on purpose: it persists what an old round has
  in fact been running.
- Fail closed at the wire, not at dispatch: the MCP tool is the one place
  every analysis run passes through, and a refusal there costs no provider
  call. The manager API and the callback verifier are not behind it.
- The overall-summary prompt needs no polarity rule: it lists dimension
  scores and summed distributions only (checked).
- The eval corpus defaults to `7.0` rather than following the deployed
  producer: the owner asked to measure `7.0`, the deployment is meant to move
  to it, and `6.0` stays one flag away. `reverse-scored` is refused under
  `6.0` by name rather than sent without its scale, because a colour-scale
  rendering of it would measure the prompts on evidence they were not shown.
- Answered in chat only: whether questionnaires and service boundaries can be
  configuration. Questions, scales, polarity and capabilities already are;
  templates would take a registry or catalogue (audit 2026-08-16, A/B); the
  eight dimensions are a fixed taxonomy by owner decision and making them data
  is a product rewrite plus catalog content.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0 on the tree of step 8: fifteen gates,
  typecheck, `npm test` 1688/1688, `verify:ai` 624 passed, lint, build. The
  same chain was exit 0 on step 7 (610 in `verify:ai`) and on `455e33e`
  (1686 and 601).
- `npm run verify:db` — 109 pass, 0 fail, on the tree of step 7 against a
  throwaway PostgreSQL 16 on `127.0.0.1:5433`, including the new case that
  compares the SQL summary with `summariseVersion` on the instrument. Intermediate runs found and fixed: the mutation config missing the
  two `7.0` suites; three tests using `7.0` as an unknown version; five tests
  pinning "a new round is born with 24"; one doubled comma.
- `ai-e2e.test.ts` — 4 pass, including a mixed-scale, reverse-scored round
  with a background question crossing MCP → the shipping Python pipeline →
  callback verification → the Dashboard DTO under `7.0`; a tampered polarity
  is refused with 400.
- Browser, production build, Chromium, throwaway PostgreSQL 16:
  - the instrument walked end to end (31 steps, no overflow at 400 px) and
    the stored response read back — 78 scored, 57 unscored, reverse polarity
    right on both scales;
  - the swap: sign-in, `/setup?round=new` → a draft round with 150 stored
    questions and the instrument's `instrumentId`; the builder on it reads
    «150 שאלות פעילות, מתוכן 77 שאלות חובה» (before step 6; it is 126 now,
    by the unit test, not re-walked); «שמירה והכנה להפצה» activates
    it; the share link as a stranger shows «126 שאלות, כ־23 דקות» and 31
    steps. A first attempt against a stale `.next` produced a 24-question
    round; the evidence is from the rebuilt server.

### Failed

None attributable to this branch.

- Keyless shape check of the `7.0` corpus, 2026-09-13: `evals.report
  --emit-inputs` wrote nine `7.0` inputs; `reverse-scored` through
  `src.pipeline_cli` came back `success` on `7.0` with every metric carrying
  `scaleId` and `polarity` and no `insightText`; `evals.report` scored it.
  Every stone was `deterministic_fallback`, so the report is not evidence
  about the prompts and was not kept. `run_corpus` refused to run keyless,
  as it should.

### Blocked or not run

- **The `7.0` eval run against a provider** — the thing the owner asked for.
  This environment holds no `GEMINI_API_KEY`, `LLM_API_KEY` or `.env`, and
  `run_corpus` refuses without one. The command is in `evals/README.md`
  under "What is not automated"; it needs the deployment's `../.env` and
  roughly 80 requests of quota. Read `reverse-scored` first.
- Deployed health evidence from either service: nothing deployed.
- `verify:db` was not run on steps 1–6; there was no schema change and no SQL
  change until step 7.
- ISO 45003:2021 clause structure not checked against the standard's text.

### Environment

Remote container. The AI service virtualenv was created here (git-ignored).
Two throwaway PostgreSQL 16 instances were started for the browser walks —
the second under `/var/lib/postgresql/shalomut-walk` because the scratchpad's
permissions were being reset from outside — with a local `.env`, and a third
under `/var/lib/postgresql/shalomut-hist` for `verify:db` on step 7; all
removed afterwards. No deployed write of any kind.

### Residual risk

- `7.0` has never been produced by a real provider call, only by the fallback
  path and the local stub. The eval corpus can now ask the question — the
  `reverse-scored` case is built for the polarity sentence — but until the
  owner runs it with a key the sentence is unmeasured on a model.
- The mapping is the agent's, accepted by the owner, not the methodologist's.
- `scaleMatchingOptions` compares anchor labels; a changed anchor text would
  turn unscored rows of persisted rounds back into standalone screens.
- The timing figures in the SQL summary's doc-comment were measured on its
  2026-08-23 shape; the lateral aggregate of step 7 is not re-measured, and the
  comment says so.
- A `balance` stone on the instrument has 36 metrics; that screen has not
  been looked at in a browser.
- Landing this branch with `AI_ANALYTICS_CONTRACT_VERSION` still `6.0` makes
  every new round's analysis fail closed until it is `7.0`. Intended, written
  in `.env.example` and the matrix, and the one way this branch surprises the
  owner on deploy.

## Git state

Committed and pushed: `9813c44`, `8d8d4e0`, `7674f73`, `150c335`, `23b6f72`,
`455e33e`, `98fb6ea`, `60b8873`, `7075de9`, `4ae0375` and the commit
carrying step 8 and this file, all on
`origin/claude/methodology-questions-analysis-gvh18u` — checked with
`git status` and `git log origin/main..HEAD`. Nothing staged, unstaged or
untracked. `origin/main` is still `f47959e`; landing the branch is the
owner's. The handoff is portable to any checkout or machine: everything it
describes is on the pushed branch.

## Approval gates

None on the branch. Deploying either service, changing the deployed producer
configuration and sending the analysis to the methodologist are the owner's.

## Questions requiring an owner decision

- Whether the analysis goes to the methodologist as a draft reply — an action
  outside the repository.

## Next concrete step

Owner, on a machine that holds the deployment's `.env`: run the `7.0` eval
corpus — `cd ai-analytics-service && .venv/bin/python -m evals.run_corpus
--env-file ../.env --out /tmp/eval-7.0`, check the provenance, score with
`evals.report` into `evals/baselines/<date>-<model>-contract-7.0.json`, and
read the two turned stones of `reverse-scored`. Then land the branch on
`main`; deploy the AI service and confirm its `GET /api/health` reports
`7.0`; then deploy Core with `AI_ANALYTICS_CONTRACT_VERSION=7.0` — in that
order, because every new round is now on the instrument and a Core producing
`6.0` refuses to analyse it.
