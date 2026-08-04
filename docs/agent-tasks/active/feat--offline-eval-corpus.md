# Measure whether the generated Hebrew is any good, offline

## Metadata

- Branch: `feat/offline-eval-corpus`
- Base branch: `main`
- Base commit: `005ca01`
- Current HEAD: `40834e7` plus this docs commit
- Status: ready for review and push
- Last updated: 2026-08-04
- Last agent/tool: Claude Code (Opus 5)

## Objective

The minimal half of Phase 9 of the AI harness improvement plan: a synthetic
corpus and deterministic graders, so a prompt or model change can be compared
against the previous one instead of argued about.

## User-visible outcome

None directly. What changes is that the question "did that prompt change make
the analysis better?" has an answer that is not an opinion.

## Context

The repository has strong contract, privacy, lifecycle and safety coverage, and
all of it answers whether a payload is *valid*. Nothing answers whether it is
*good*. Anything the safety validator refuses can never reach a reader, so what
is left unmeasured is text that is well formed, Hebrew, the right length,
consistent about statuses — and still generic, repetitive, or asserting
something the numbers do not support.

Argued to the owner as the slice that should come before plan Phase 5
(stronger summary validation): Phase 5 is a hypothesis about where the summary
goes wrong, and a measurement is what turns that into a fact.

## Scope

- `evals/corpus.py`: eight synthetic aggregate-only rounds, declared compactly
  and expanded into real contract input.
- `evals/graders.py`: five deterministic, provider-free measurements.
- `evals/report.py`: a stable JSON report plus a CLI to emit inputs and score
  payloads.
- `evals/README.md`, and a pointer from the service README.
- `tests/test_evals.py`, so a grader that stops working is a failing test.

## Non-goals

Deliberately excluded, as the parts of Phase 9 that are premature here:

- Committed baseline scores and thresholds. Nothing passes or fails.
- An LLM judge, even as a noisy signal. Every grader is a pure function.
- Provider-connected runs, in CI or otherwise. They cost money and the output
  is stochastic.
- Rubric governance and sampled human review.
- Any change to runtime validation. No grader can block anything.

## Acceptance criteria

- Every corpus case parses as contract `6.0` input and covers all eight
  dimensions.
- Each grader is pinned by a payload it scores well and one it does not.
- The same payloads produce a byte-identical report.
- A payload with no matching case is reported, never silently skipped.
- The full Python suite passes.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md`: privacy is a product invariant, the
  eight dimensions are the stable taxonomy, and the round's own questionnaire
  snapshot — not the default template — is the source of question identity.
- `.agents/skills/shalomut-verification/SKILL.md`: an `ai-analytics-service`
  change means the full `.venv/bin/python -m pytest`.

## Relevant architecture and contracts

- No wire contract change, no runtime code change, no API or schema change.
  Nothing under `src/` was touched.
- The corpus is aggregate-only by construction: it has no field that could
  carry a respondent, and the locked case carries no aggregates at all.
- `Dockerfile` copies `src`, `data` and `contracts`, so `evals/` stays out of
  the runtime image.

## Decisions made

- **Graders measure what the runtime cannot refuse.** Duplicating a contract
  rule as a grader would produce a metric that is 1.0 by construction and read
  as evidence of quality. Each of the five names a failure that reaches a
  manager today.
- **The corpus is a spec, not expanded JSON.** A thousand lines of generated
  aggregates in Git would hide the eight decisions that matter. If Core ever
  needs the same cases, that is the point to emit shared JSON under
  `contracts/fixtures/`.
- **`surveyDefinitionHash` mirrors Core's algorithm** rather than using a
  well-formed placeholder, so a case is input a real Core round could have
  produced. Cross-checked against the Node implementation; the digests match.
- **The report carries no timestamp** and is sorted and rounded, so two runs
  over the same payloads are byte-identical and `diff` shows only what the
  prompt change did.
- **Nothing is wired to a provider.** The loop is only closed when a person
  runs the corpus against real prompts, and the README says so rather than
  letting the directory imply coverage it does not have.

## Assumptions

- Word-overlap is an adequate proxy for specificity and repetition at this
  scale. It cannot tell insight from echo, which the README states.

## Completed

- The corpus, the five graders, the report and its CLI.
- 37 tests: corpus validity, each grader's positive and negative case, report
  stability, the unmatched-payload path, and the graders run against the shared
  V6 callback fixture — a payload nobody wrote to make them fire.
- `evals/README.md` and the pointer from `ai-analytics-service/README.md`.

## In progress

None.

## Remaining

Nothing in scope. The push is the owner's: the agent cannot push here.

## Changed files

- `ai-analytics-service/evals/{__init__,corpus,graders,report}.py` (new)
- `ai-analytics-service/evals/README.md` (new)
- `ai-analytics-service/tests/test_evals.py` (new)
- `ai-analytics-service/README.md`
- this file

## Verification evidence

### Passed

- `.venv/bin/python -m pytest` from `ai-analytics-service`: 428 passed, 1
  warning. 391 before this slice plus 37; no existing test changed.
- The corpus hash was cross-checked against Core's
  `createSurveyDefinitionHash` by running both implementations over the
  `dynamic-questionnaire` questionnaire. Both produced
  `sha256:7fc26da0f8dab82bf8ea9998399f293ea4941dd1a6f67aaaedb826e45b9929df`.
- The CLI was run for real against the shared V6 callback fixture relabelled to
  a corpus round id. It scored `meanScore 0.4514` with 43 findings —
  `distinctness 0.0`, `evidence_specificity 0.057`,
  `recommendation_fit 0.2`, and `1.0` for both grounding and overreach. Those
  are the correct verdicts on that fixture: it repeats one sentence and one
  recommendation title across all eight stones, and it makes no numeric claim.

### Failed

None.

### Blocked or not run

- No TypeScript check was run. No file outside `ai-analytics-service/` changed.
- No browser smoke. No UI surface.
- **The graders have never scored real provider output.** Everything above is
  hand-written payloads and one contract fixture. Until someone runs the
  corpus against the deployed prompts, this measures nothing about them.

### Environment

Local. Nothing deployed was touched or read. No provider was called.

### Residual risk

- Word overlap is a blunt instrument. `evidence_specificity` rewards a
  narrative that quotes the question back, which is not the same as insight,
  and the eventual answer to that is a human read of sampled output, not a
  cleverer regex.
- The lexicons are a first pass. `no_overreach` will miss clinical phrasing
  nobody thought to list; the corpus makes that discoverable, not impossible.
- The five scales are choices, not calibrations. They are comparable between
  runs, which is the property that matters, but a single absolute score should
  not be read as a grade.

## Failed approaches

- Matched the clinical and causal lexicons with `term in text`. Running the
  CLI against the shared V6 fixture reported an asserted cause on six stones:
  the causal `עקב` was matching inside `בעקביות` — "consistently". Replaced by
  word-boundary patterns that still see a term behind Hebrew's attached
  prefixes, so `משחיקה` is found but `עקביות` is not. The regression is pinned
  in `test_a_word_that_merely_contains_a_causal_term_is_not_a_finding`. This
  is why the first thing built was a way to run the graders against a payload
  nobody wrote for them.
- Mapped `כל` to eight in the cardinal table. "כל הממדים האדומים" is about
  however many are red, so the mapping would have invented findings on every
  case that is not uniform. Removed.

## Known risks

None beyond the residual risk above.

## Approval gates

None. No secrets, credentials, authentication configuration or deployment
alias is touched, and no provider is called.

## Questions requiring an owner decision

One, not blocking: whether to spend a provider run on the eight cases now and
keep the report as the first baseline. That is the step that turns this from a
tool into evidence, and it costs roughly eight rounds of generation.

## Next concrete step

Hand the push to the owner: `git push origin feat/offline-eval-corpus:main`.
