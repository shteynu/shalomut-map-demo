# Offline evaluation

Deterministic, provider-free measurement of how good a generated Stone Map
actually is — as opposed to whether it is valid, which the contract and the
safety validator already decide.

## What this is not

- **Not a gate.** Nothing here blocks a payload, a build or a merge. The
  runtime refusals live in `src/schemas/stone_map_validation.py` and
  `src/services/hebrew_validation.py` and stay the only things that can stop a
  round.
- **Not an LLM judge.** Every measurement is a function of the payload and the
  case: same input, same report, no provider, no network, no randomness.
- **Not a baseline system.** There is no committed score to regress against and
  no threshold to pass. Comparing two runs is `diff` on two reports, which is
  why the report has no timestamp in it.
- **Not shipped.** The `Dockerfile` copies `src`, `data` and `contracts`; this
  directory stays out of the runtime image.

## What it measures

Anything the safety validator refuses can never reach a grader, so the graders
only look at the part no rule catches: text that is well formed, Hebrew, the
right length, consistent about statuses — and still generic, repetitive, or
asserting something the numbers do not support.

| Grader | The failure it exists for |
| --- | --- |
| `summary_grounding` | "Three dimensions are green" when four are. The runtime checks the summary's language and shape, not its arithmetic. Number, noun and status all have to be present: a summary counting *answers* is counting a different set, and goes unmeasured rather than wrong. |
| `no_overreach` | Clinical vocabulary and asserted causes. Aggregates show co-occurrence; a survey of ten people diagnoses nobody. |
| `evidence_specificity` | A paragraph that would read identically for any school, measured as overlap with the round's own question texts. |
| `distinctness` | One paragraph written eight times. Each stone can pass its own validation while the map says one thing. |
| `recommendation_fit` | A recommendation carrying another dimension's id, aimed at a status the stone is not in, or repeated five times. |
| `polarity_reading` | "Little time pressure" when a reverse-scored `לחץ זמן` averages 22. Since `7.0` the average is normalised with the polarity applied, so a low number on a demand means the demand is felt strongly; the prompts say so in one sentence, and nothing at runtime checks whether the model heard it. Read from the words around the statement's subject in the two descriptive paragraphs of the stone — the third proposes, and a proposed "space without rivalry" is not a reading of how much rivalry there is; a yellow stone, an unnamed demand or a clause carrying both readings goes unmeasured rather than wrong. |

A score runs 0.0 to 1.0 and is only ever a summary of `measured`. Read
`findings` — the score says how much, the findings say what.

## The corpus

Nine synthetic rounds in `corpus.py`, aggregate-only and invented. No
respondent, school or real answer is represented, and none can be. Each case
carries a `challenge` line saying what an analysis of it has to get right;
read that first when a grader fires.

The corpus is contract `7.0` input since 2026-09-12 (`6.0` before that). Every
dimension carries one statement worded the way the dimension is good and one
worded the way the research instrument words its demands — `לחץ זמן`, `אי
ודאות לגבי המשך העסקה` — with `polarity: negative` and an average that has
already been reversed. Both scales the instrument answers on appear on both
polarities, so a model that reads the scale instead of the polarity cannot
score as if it had read the polarity. `7.0` asks for no metric narrative, so
a run is eight structured summaries, eight adaptation batches and one round
summary per unlocked case.

`reversed-demands` is the case built around what `7.0` changed: healthy
resources, red `balance` and `certainty`, and in each red stone a demand
statement at a low normalised average — heavy pressure, real uncertainty.
Reading that number as "little pressure" reverses the round while producing
prose every runtime rule accepts.

`mixed-middle` and `polarized` are a deliberate pair: identical dimension
averages, opposite distributions. An analysis that reads averages and stops
will say the same thing about both, and that is the point of having them.

The cases are declared compactly and expanded into contract input rather than
committed as expanded JSON — the spec is what a person reads and changes.
`surveyDefinitionHash` mirrors Core's `createSurveyDefinitionHash` exactly, so
a case is real contract input rather than a plausible-looking placeholder.

## Running it

Producing payloads and scoring them are two commands on purpose: the first
calls a provider and costs money, the second is free and deterministic.

```bash
# what each case is built to catch
.venv/bin/python -m evals.report --list-cases

# run the corpus through the real pipeline — this spends provider quota
.venv/bin/python -m evals.run_corpus --out /tmp/eval-payloads

# score whatever came back
.venv/bin/python -m evals.report /tmp/eval-payloads/*.json > report.json
```

`--env-file` defaults to `.env`, which is *this directory's* parent — the
service's own file, and it carries the key and little else. The models and the
token cap the deployment runs are in the repository root `.env`, so an
unqualified run measures `gemini-flash-latest` at the 2048-token default rather
than `gemini-3.5-flash` at 8192, and produces a perfectly readable report about
a configuration nobody deploys. The line the command prints — `provider gemini
(model / model), key configured` — is the one to read before letting it spend
anything. Pass `--env-file ../.env` to measure the deployment.

`run_corpus` loads that file before importing the service, and refuses to run at
all without a provider key. Both matter: `src.config` builds its settings
singleton at import time, so a service imported too early runs keyless — and a
keyless run does not fail. Every dimension falls back to deterministic copy and
the round is reported `success`, which would file a corpus of the service's own
boilerplate as evidence about the prompts.

`--emit-inputs DIR` writes the contract inputs instead, for driving a run some
other way. Payloads are matched to cases by the `roundId` they carry
(`eval-<caseId>`); one with no matching case is skipped loudly on stderr.

**Check the provenance before reading a report.** A round whose provider was
rate-limited comes back full of `deterministic_fallback`, and the graders will
happily score that text. It is a valid measurement of the fallback copy and
says nothing at all about the prompts:

```bash
.venv/bin/python - <<'EOF'
import json, glob, collections
for path in sorted(glob.glob("/tmp/eval-payloads/*.json")):
    payload = json.load(open(path))
    outcomes = collections.Counter(
        (stone.get("generationProvenance") or {}).get("outcome")
        for stone in (payload.get("stones") or {}).values()
    )
    print(path.split("/")[-1], dict(outcomes))
EOF
```

## Baselines

`baselines/` keeps reports that were actually produced from a provider, named
by the date and the model that wrote them. The report carries no timestamp, so
two of them diff cleanly — that is the whole point of keeping one.

`2026-08-05-gemini-3.5-flash-lite.json` is the first. It is a full run on the
models `render.yaml` deploys, with `outcome: "llm"` on 55 of 56 stones. Read it
next to `docs/agent-tasks/archive/test--eval-corpus-baseline.md`, which records
what the low grader turned out to mean.

`2026-08-05-gemini-3.5-flash-lite-language-rules.json` is the same corpus on
the same models after the prompts were told which words they may not use — the
clinical vocabulary and the causal connectives the first report found. Two
reports of one model differ only by the prompts between them, which is the
comparison this directory exists to make: `no_overreach` 0.2725 to 0.94,
21 clinical terms to 0, 9 asserted causes to 4.

`2026-08-19-gemini-3.5-flash.json` is the first report on the model the
deployment has actually run since 2026-08-09, at `MAX_TOKENS_PER_DIMENSION`
8192: mean 0.9644, two findings, and `outcome: "llm"` on 56 of 56 stones.
Against the lite report beside it, `no_overreach` 0.94 to 0.97 and
`evidence_specificity` 0.9832 to 1.0, while `distinctness` falls 0.9079 to
0.8522.

`2026-08-19-gemini-3.5-flash-reasoning-low.json` is the same corpus on the same
model with `LLM_REASONING_EFFORT=low`. The graders barely notice — mean 0.9586,
`distinctness` unchanged at 0.8529 — but three stones came back
`deterministic_fallback` instead of 56 of 56, and all three were lost to
`TimeoutError` rather than to anything the graders can see. A report is not the
only thing to read: check the provenance first, as the block above says.

`2026-08-19-gemini-3.5-flash-reasoning-low-waited.json` is that run again after
the retry budget stopped abandoning slow answers (25/20/8 seconds to 90/40/20,
`src/config.py`): 56 of 56 stones by the model, mean 0.9604, no `TimeoutError`
anywhere. Read as a trio, the three reports separate two things a single run
confounds — what the model writes, which `low` does not change, and whether
this service waits for it, which was the whole defect. It was assembled from
two runs, four cases and then three, because the account ran out of credit in
between; the cases are independent and the report carries no timestamp, which
is what makes that legitimate.

`2026-09-12-gemini-3.5-flash-contract-7-0.json` is the first report on
contract `7.0` — the first time a model, rather than the fallback or the local
stub, produced it — and the first with the `polarity_reading` grader, so its
mean averages six graders where every earlier file averages five; the older
files are not rescored, because their payloads were not kept. Same model, same
8192-token cap, reasoning effort unset, on the deployment's configuration from
the repository root `.env`. Mean 0.9664, three findings, all asserted causes
(`גורמים ל`, `נובעת מ` twice); `distinctness` 0.8501 and `no_overreach`
0.9486 sit where the `6.0` reports left them. `polarity_reading` read five
demand statements across four dimensions and found every one written the way
its number points, so on that evidence the one sentence
`ANSWER_SCALE_RULE` adds is heard — evidence that is thin on purpose, and
thinner than planned:

- **It covers six of the eight unlocked cases.** The prepayment credit ran out
  during the sixth case (`workload-pressure`: all eight stones and the round
  summary by the model, 35 of 40 adaptations from the fallback), and the seventh
  and eighth came back as fallback copy on every stone. A second run of those
  three cases an hour later billed nothing — every request a `429` whose body
  says the credits are depleted — so `reversed-demands`, the case built around
  the trap `7.0` sets, and `dynamic-questionnaire` are not in the file. Scoring
  their fallback payloads would have filed the service's own boilerplate as a
  measurement, which is what the provenance check above exists to prevent. Once
  the account has credit, run `--cases reversed-demands,dynamic-questionnaire`
  and re-score the nine payloads together; the cases are independent and the
  report carries no timestamp, which is what makes joining them legitimate.
- **The grader learned three rules from this run** before the report was
  filed, and the payloads were re-scored for free: an adjective after a
  conjunction belongs to the next noun (`מתח מדווח ותחושה נמוכה`), an absence
  before the subject outranks the adjective after it (`היעדר תסכול משמעותי`),
  and the third paragraph of a summary proposes rather than reads (`ללא חשש
  מתחרות` as the space to build, on a stone where rivalry is felt strongly).
  Each is pinned in `tests/test_evals.py`. Before those rules the same
  payloads scored `polarity_reading` at 0.8591 with three findings, none of
  them a reversed reading.
- **The `6.0` cost pattern held on `7.0`.** Ninety-nine billed answers for the
  six cases the model wrote, 572,050 total tokens; four adaptation batches hit
  the 8192-token cap and were retried. No `TimeoutError`.

Both 2026-08-05 files are rescorings rather than first drafts. `summary_grounding` read
every "18 green *answers*" as a claim about dimensions and scored the first run
at 0.375; the grader was fixed and the same payloads rescored, which is exactly
what a saved report is for — rescoring costs nothing and needs no provider.
Both now read 1.0 on `claims: 0`, meaning neither run made a countable claim
about dimensions at all, not that either counted correctly. Read the two
numbers together; that is why the report carries `measured` next to every
score.

## What is not automated

The graders and the corpus are covered by `tests/test_evals.py` and run in
`npm run verify:ai` like everything else, so a grader that stops working is a
failing test.

What does **not** run automatically is the part that costs money: producing
payloads from a real provider and scoring those. That is deliberate — the
output is stochastic and each round is roughly two dozen provider calls — but
it does mean the loop is only closed when a person runs it. Until someone
does, this directory measures nothing about the deployed prompts.

The natural next steps, in order, are: run the corpus against the current
prompts and keep the report; do it again after a prompt or model change and
diff the two; and only then decide whether any grader deserves to become a
threshold.

## Provider quota

A full corpus run is roughly 140 provider requests — eight dimension
summaries, eight adaptation batches and the overall summary for each of the
eight unlocked cases, before retries. On `6.0` it was the same number for a
different reason: seven cases, each also asking eight metric narratives.

The Gemini free tier allows **20 requests per day per model**
(`GenerateRequestsPerDayPerProjectPerModel-FreeTier`), so a full run needs a
key with real quota. A free-tier key does not fail the run — it produces one
or two model-written stones and fills the rest with deterministic fallback,
which is why the provenance check above is the first thing to do with any
report.
