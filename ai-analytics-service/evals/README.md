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
| `summary_grounding` | "Three dimensions are green" when four are. The runtime checks the summary's language and shape, not its arithmetic. |
| `no_overreach` | Clinical vocabulary and asserted causes. Aggregates show co-occurrence; a survey of ten people diagnoses nobody. |
| `evidence_specificity` | A paragraph that would read identically for any school, measured as overlap with the round's own question texts. |
| `distinctness` | One paragraph written eight times. Each stone can pass its own validation while the map says one thing. |
| `recommendation_fit` | A recommendation carrying another dimension's id, aimed at a status the stone is not in, or repeated five times. |

A score runs 0.0 to 1.0 and is only ever a summary of `measured`. Read
`findings` — the score says how much, the findings say what.

## The corpus

Eight synthetic rounds in `corpus.py`, aggregate-only and invented. No
respondent, school or real answer is represented, and none can be. Each case
carries a `challenge` line saying what an analysis of it has to get right;
read that first when a grader fires.

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

`run_corpus` loads `.env` before importing the service, and refuses to run at
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
next to `docs/agent-tasks/active/test--eval-corpus-baseline.md`, which records
what the two low graders turned out to mean.

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

A full corpus run is roughly 140 provider requests — eight dimensions times a
dimension summary and a metric narrative, plus the overall summary and the
intervention adaptation, for each of the seven unlocked cases.

The Gemini free tier allows **20 requests per day per model**
(`GenerateRequestsPerDayPerProjectPerModel-FreeTier`), so a full run needs a
key with real quota. A free-tier key does not fail the run — it produces one
or two model-written stones and fills the rest with deterministic fallback,
which is why the provenance check above is the first thing to do with any
report.
