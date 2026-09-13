# The eval corpus runs on `7.0`, and a model is measured reading a reversed scale

## Metadata

- Branch: `claude/relaxed-hellman-4ad0ff`
- Base branch: `claude/methodology-questions-analysis-gvh18u` — the published
  branch that carries contract `7.0`, now at `ccf76e1` (eleven commits above
  `origin/main` at `f47959e`). See *Decisions made* for why the branch pointer
  has not been moved there yet, and for what `ccf76e1` is.
- Base commit: `ccf76e1`, the tip of the `7.0` branch
- Current HEAD: `ccf76e1`, fast-forwarded by the owner on 2026-09-13; the
  reconciled eval work is applied and uncommitted
- Status: implemented, verified in this worktree, ready to commit; the two
  missing cases wait on provider credit
- Last updated: 2026-09-13
- Last agent/tool: Claude Code (Fable 5.1)

## Objective

Contract `7.0` (`contracts/ai-analytics-v7.json`, ADR-056) had only ever been
produced by the deterministic fallback and the local stub. Make the eval
corpus run on it — mixed `likert-5-extent` / `likert-7-frequency` aggregates
with both polarities, no metric narratives — add a grader that catches a model
reading a reverse-scored statement backwards, run the corpus against the
configured provider and keep the report as a baseline.

## User-visible outcome

None. This measures the prompts; it changes no product behaviour.

## Context

`7.0` changed two things the model sees: every aggregate carries `scaleId` and
`polarity`, and `hebrew_prompts.ANSWER_SCALE_RULE` is appended to the
structured-summary and the intervention-adaptation prompts when the aggregates
carry a polarity. Whether one sentence is enough for a model to read
"average 22" beside «לחץ זמן» as heavy pressure rather than light had never
been measured.

## Scope

- `ai-analytics-service/evals/corpus.py` on `7.0`, a demand statement in every
  dimension, both scales on both polarities, one new case built around the trap.
- A sixth grader, `polarity_reading`, pinned by tests.
- A provider run and its report under `evals/baselines/`.
- `evals/README.md` for all of the above.

## Non-goals

- Changing the prompts on what the report shows. Baseline first.
- Turning any grader into a threshold.
- Touching `.env`, secrets or deployment configuration.
- Landing or deploying `7.0` itself — that is the base branch's next step.

## Acceptance criteria

- Every corpus case parses as `7.0` contract input and carries a scale and a
  polarity on every statement; both scales carry both polarities.
- `polarity_reading` fires on a narrative that reads a low average on a demand
  as little of it, and on the opposite reversal, and on nothing else the tests
  name.
- The report was produced from a provider, not the fallback, and is filed
  under `evals/baselines/` with its provenance recorded here and in the README.

## Relevant repository instructions

- `AGENTS.md`; `.agents/skills/shalomut-map`, `shalomut-verification`,
  `shalomut-tracker`.
- `ai-analytics-service/evals/README.md` — the runner and how a baseline is
  recorded.

## Relevant architecture and contracts

- `contracts/ai-analytics-v7.json`, `PROJECT_CONTEXT.md` ADR-056,
  `docs/ai-contract-version-matrix.md` § Contract `7.0`.
- `ai-analytics-service/src/services/hebrew_prompts.py` —
  `ANSWER_SCALE_RULE`, `answer_scale_section`.

## Decisions made

- **The branch has to sit on the `7.0` branch, and the agent could not put it
  there.** `origin/main` has no `7.0`: no manifest, no capability, no parser
  support, and `docs/ai-contract-version-matrix.md` there still says a `7.0` is
  planned. The only place `7.0` exists is
  `origin/claude/methodology-questions-analysis-gvh18u`, which descends from
  `origin/main` and touches none of the eval files. This branch had no commits
  of its own, so a fast-forward onto that branch loses nothing; both
  `git merge --ff-only` and `git pull --ff-only` were refused by the session's
  permission classifier. The work was therefore done in this worktree and
  tested by copying the changed files into a read-only `git archive` of the
  `7.0` branch in the session scratchpad, with the main checkout's
  `ai-analytics-service/.venv` (Python 3.14) — which is why every file here is
  uncommitted and why the next step is the owner's.
- **The corpus is pinned to `7.0`, as it was to `6.0`.** A version switch was
  considered and dropped: the point of the corpus is to measure the prompts the
  deployment will run, and every new round is on the instrument since ADR-004
  as amended.
- **The demand statements are the instrument's own phrasing** (`לחץ זמן`,
  `יחסים מתוחים בין עובדים`, `אי ודאות לגבי המשך העסקה`), not sentences invented
  for the corpus, so the grader is reading the words a real round would carry.
- **`polarity_reading` reads the words around a declared subject** in the two
  descriptive paragraphs of a stone: an adjective up to four words after it,
  stopping at a conjunction; a negation, an absence or a quantifier up to two
  words before it, which outranks the adjective, with a negated infinitive
  («אין להסיק») excluded. A yellow stone, an unnamed demand and a clause
  carrying both readings all go unmeasured, never wrong. The third paragraph
  and the recommendations are proposals and are not read; neither is the
  overall summary, which names dimensions, not statements. Three of those
  rules were taught by the first provider run — see *Verification evidence*.
- **The mean now averages six graders.** A `6.0` report and a `7.0` report are
  therefore not the same number even on identical prose; the README says so
  beside the baseline.
- **A second session did the lighter half of this task on the `7.0` branch
  itself, as `ccf76e1` (2026-09-13, no provider key there).** It gives the
  corpus a `--contract` switch keeping `6.0` producible, turns two dimensions
  in a `reverse-scored` case while every other statement stays on the colour
  scale, adds no grader ("no grader can settle that"), makes no run, and
  files no baseline; its README puts a `7.0` run at "roughly 80 requests",
  which the run here measured at about 16 billed answers per case. This
  worktree's version supersedes it on every one of those points and keeps
  nothing from it: the `--contract` switch goes, because a corpus whose every
  dimension carries a demand statement has nothing to say under `6.0`, and
  `reverse-scored` is replaced by `reversed-demands`. The reconciled tree —
  this worktree's eval files on `ccf76e1`, with `run_corpus.py` back to its
  `4ae0375` form — passes the full suite (639) and is parked as
  `.claude/evals-on-ccf76e1.patch`, together with the two document lines
  below. The `7.0` branch's own task file still names the run as its next
  step; it is that session's file and was left alone.
- **`PROGRESS.md` and `docs/shalomut-tracker-handoff.md` are not edited in
  this worktree.** The `7.0` branch changes both, and a local modification to
  either would make the fast-forward refuse. The two edits that belong to this
  task are spelled out under *Remaining* and prepared as a patch in the session
  scratchpad, which does not survive the session — the text below is the record.

## Assumptions

- The paid key and the deployment's models live in the repository root `.env`
  of the main checkout (`LLM_MODEL_FAST`, `LLM_MODEL_HEAVY`,
  `MAX_TOKENS_PER_DIMENSION`, `GEMINI_API_KEY` — names read from the runner's
  own output, values never read). `LLM_REASONING_EFFORT` is not among them, so
  the run measures the unset default, as `render.yaml` deploys.

## Completed

- `evals/corpus.py`: `CORPUS_CONTRACT_VERSION = "7.0"`; `QuestionSpec` with
  `scale_id`, `polarity`, `subjects`; every dimension carries one resource
  statement and one demand statement; both scales on both polarities; every
  aggregate emits `scaleId` and `polarity`; the new case `reversed-demands`
  (resources at 78, `balance` 22, `certainty` 38). Nine cases.
- `evals/graders.py`: `grade_polarity_reading`, in `GRADERS`.
- `tests/test_evals.py`: the corpus shape on `7.0`, the new case, sixteen
  pins on the grader (both reversal directions, four Hebrew forms of the
  reversed reading, three innocents, a proposal, the two readings the first
  provider run taught, yellow and unnamed and single-statement dimensions
  unmeasured); the callback-fixture test scores the `7.0` accepted payload.
  73 tests.
- A keyless dry run of `reversed-demands` through `run_pipeline`: `success`,
  `7.0`, eight stones of deterministic fallback, metrics with `scaleId` and
  `polarity` and no `insightText`, no `metricInsightsOutcome`. And
  `ANSWER_SCALE_RULE` is present in the structured-summary prompt built from the
  corpus's `balance` aggregates.
- The provider run, `gemini-3.5-flash` / `gemini-3.5-flash`, 8192-token cap,
  reasoning effort unset, from the root `.env` of the main checkout: nine cases
  in 19 minutes, every case with the status the corpus expects. Provenance:
  `outcome: "llm"` on all eight stones and the round summary of six unlocked
  cases; `workload-pressure` had 35 of 40 adaptations from the fallback;
  `reversed-demands` and `dynamic-questionnaire` came back fallback on every
  stone. Cause established by a five-token probe of the provider: the `429`
  body says the prepayment credits are depleted.
- The baseline, `evals/baselines/2026-09-12-gemini-3.5-flash-contract-7-0.json`,
  scored from the seven payloads with real provenance: mean 0.9664, three
  findings (asserted causes), `polarity_reading` 1.0 on five readings in four
  dimensions, `distinctness` 0.8501, `no_overreach` 0.9486. The two fallback
  payloads were deliberately left out; scoring them would file the service's
  boilerplate as evidence. Ninety-nine billed answers, 572,050 total tokens.
- Three grader rules learned from the run's prose and pinned before filing:
  the after-window closes at a conjunction, an absence before the subject
  outranks an adjective after it, and only the two descriptive paragraphs are
  read. The same payloads scored 0.8591 with three findings before those
  rules, none of them a reversed reading.
- The eval README: corpus, grader table, quota and baseline sections.

## In progress

Nothing.

## Remaining

- **Run the two missing cases once the account has credit** and re-score all
  nine payloads into the same baseline file. From `ai-analytics-service` in a
  checkout that carries `7.0`, with the six kept payloads restored beside them
  (they live only in the session scratchpad, so in practice: run the whole
  corpus again — about 140 requests — and file the result as the second `7.0`
  report next to this one). `reversed-demands` is the case that answers the
  question this task asked; the current file answers it on five readings from
  cases not built for it.
- **Two living documents** — applied on 2026-09-13 with the rest of the
  patch, listed here for the record:
  - `PROGRESS.md`: the *Completed → AI analytics* bullet on `evals/` says nine
    rounds on `7.0` and six graders; a "Closed 2026-09-12" paragraph after the
    2026-08-19 one under *Next up → AI analytics* records the corpus, the
    grader and what the baseline covers.
  - `docs/shalomut-tracker-handoff.md`: the cost caveat "the quality half is
    unaffected, because the eval corpus runs `6.0`" becomes "the quality half
    is measured separately, on the eval corpus, which runs `7.0` since
    2026-09-12".

## Changed files

All uncommitted, all in this worktree, applied on `ccf76e1` from
`.claude/evals-on-ccf76e1.patch` (the baseline hunk skipped, because the file
was already in place untracked and byte-identical):

- `ai-analytics-service/evals/corpus.py` (modified)
- `ai-analytics-service/evals/graders.py` (modified)
- `ai-analytics-service/evals/run_corpus.py` (modified — back to its `4ae0375`
  form; the `--contract` switch of `ccf76e1` goes with the colour-scale corpus)
- `PROGRESS.md`, `docs/shalomut-tracker-handoff.md` (modified — the two lines
  under *Remaining*, now applied)
- `ai-analytics-service/evals/README.md` (modified)
- `ai-analytics-service/tests/test_evals.py` (modified)
- `ai-analytics-service/evals/baselines/2026-09-12-gemini-3.5-flash-contract-7-0.json` (new)
- `docs/agent-tasks/active/claude--relaxed-hellman-4ad0ff.md` (new)

## Verification evidence

### Passed

- `.venv/bin/python -m pytest tests/test_evals.py` — 73 passed; and the full
  suite, `.venv/bin/python -m pytest` — 639 passed, 1 warning. Both in the
  scratchpad copy of the `7.0` branch at `4ae0375` with the changed files
  copied in, and again 639 passed on a copy of `ccf76e1` with the patch
  applied. Main checkout's venv, Python 3.14.
- `patch -p1 --dry-run` of `.claude/evals-on-ccf76e1.patch` on a fresh
  `git archive ccf76e1` — every hunk applies.
- In this worktree on `ccf76e1` with the patch applied:
  `.venv/bin/python -m pytest` — 639 passed, 1 warning (the main checkout's
  venv; this worktree has none); `git diff --check` clean.
- Keyless dry run and prompt check, as under *Completed*.
- `python -m evals.run_corpus` on the provider — 8 `success`, 1
  `locked_error`; provenance checked per the README before scoring.
- `python -m evals.report` on the seven payloads with real provenance — the
  baseline file.
- `git diff --check` — clean.

### Failed

- The second provider run (`--cases reversed-demands,dynamic-questionnaire,
  workload-pressure`, 30 requests/minute): 153 requests, every one `429`, zero
  billed answers. Not a pacing failure — the body says
  "Your prepayment credits are depleted".

### Blocked or not run

- `reversed-demands` and `dynamic-questionnaire` by the model: blocked on
  provider credit.

### Environment

local; provider calls go to the configured Gemini project.

### Residual risk

- `polarity_reading` is a word-window heuristic. It reads only the forms the
  tests pin; a reversal phrased without the subject noun or with the adjective
  five words away goes unmeasured, and `findings` carry the clause so a reader
  can judge each one.

## Failed approaches

- `git merge --ff-only` and `git pull --ff-only` onto the `7.0` branch: refused
  by the permission classifier, twice, with no branch state changed.
- Re-running the three rate-limited cases at 30 requests/minute: the first
  run's `429`s were read as pacing (the effective provider pace is 30, not the
  60 in `.env`), but the account was out of credit — worth a five-token probe
  before any rerun.

## Known risks

- Until the `7.0` branch lands on `main`, this branch cannot be merged into
  `main` on its own: its tests import `7.0`.

## Approval gates

- None for the work itself. The run spent provider quota, as the task asked,
  and exhausted the prepayment; topping up is the owner's.

## Questions requiring an owner decision

- None.

## Next concrete step

Owner: commit the nine files — `git add ai-analytics-service/evals
ai-analytics-service/tests/test_evals.py PROGRESS.md
docs/shalomut-tracker-handoff.md
docs/agent-tasks/active/claude--relaxed-hellman-4ad0ff.md` — on this branch,
then push it. After that, once the account has credit, run the two missing
cases as the first item under *Remaining*.
