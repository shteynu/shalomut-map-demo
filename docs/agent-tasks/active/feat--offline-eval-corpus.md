# Measure whether the generated Hebrew is any good, offline

## Metadata

- Branch: `feat/offline-eval-corpus`
- Base branch: `main`
- Base commit: `005ca01`
- Current HEAD: `33b624b` plus this docs commit
- Status: tool complete and pushable; the provider run itself is blocked on quota
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
- `evals/run_corpus.py`, added after the owner asked to close the loop: the
  same graph the durable worker calls, driven over the corpus.

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
- 41 tests: corpus validity, each grader's positive and negative case, report
  stability, the unmatched-payload path, and the graders run against the shared
  V6 callback fixture — a payload nobody wrote to make them fire.
- `evals/README.md` and the pointer from `ai-analytics-service/README.md`.
- `evals/run_corpus.py`, with the two guards a real run turned out to need: the
  env file is loaded before anything from `src` is imported, and a run with no
  provider key is refused rather than quietly produced.
- The `מעקב` false positive in `no_overreach`, found on real provider output.

## In progress

None.

## Remaining

- The full provider run over the seven unlocked cases, and the first report
  kept as a comparison point. Blocked on quota, not on code.
- The push is the owner's: the agent cannot push here.

## Changed files

- `ai-analytics-service/evals/{__init__,corpus,graders,report,run_corpus}.py` (new)
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
- **One case was run against the real provider**, `contradictory`, in 342s.
  It came back `status: success`. Seven of its eight stones carry
  `outcome: deterministic_fallback` because the provider answered `429` on
  nearly every call; exactly one, `meaning`, carries `outcome: llm`. Scored
  after the grader fix: mean `0.8602` — `distinctness 0.677`,
  `evidence_specificity 0.625`, and `1.0` for overreach, grounding and
  recommendation fit. **That is a measurement of the deterministic fallback
  copy, not of the prompts**, and must not be recorded as a baseline.
- The earlier CLI run against the shared V6 callback fixture relabelled to
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
- **The full corpus run is blocked on provider quota, and this is the one
  thing the owner asked for that is not done.** The configured Gemini key is
  free tier: `GenerateRequestsPerDayPerProjectPerModel-FreeTier`, quota value
  **20 requests per day** for `gemini-flash-latest`. A full run needs roughly
  140. Probed directly after the pilot; the provider answered `429` with that
  quota id and `retryDelay: 51s`, but the violated quota is per **day**, so
  waiting inside a session does not help.
- Seven of the eight cases therefore have no real payload. Only
  `contradictory` was run, and `locked-below-threshold`, which calls no
  provider by design and correctly returned `locked_error`.

### Environment

Local. Nothing deployed was touched or read. The Gemini free-tier key from
the local `.env` was called for the `contradictory` case and for one direct
quota probe; no key, value or session URL is recorded anywhere.

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
- Matched a term behind Hebrew's attached prefixes regardless of the term's
  length. The first real provider payload reported an asserted cause on nearly
  every stone: the causal `עקב` was matching inside `מעקב` — "follow-up" —
  which the service's own deterministic templates use
  (`src/prompts/hebrew_prompts.py:306`), so it would have fired on almost every
  round. A prefix only attaches to a word, so terms shorter than four letters
  no longer accept one. `no_overreach` on the pilot went from `0.000` with 28
  findings to `1.000` with none.
- Imported `src` at the top of `run_corpus.py`. The first pilot returned
  "success in 0.0s" with `attempts: 0` and every stone
  `deterministic_fallback`: `src.config` had already built its settings
  singleton before the env file was loaded, so the run was keyless and did not
  say so. Both the lazy imports and the explicit refusal are pinned by tests.
- Mapped `כל` to eight in the cardinal table. "כל הממדים האדומים" is about
  however many are red, so the mapping would have invented findings on every
  case that is not uniform. Removed.

## Known risks

None beyond the residual risk above.

## Approval gates

None. No secrets, credentials, authentication configuration or deployment
alias is touched, and no provider is called.

## Questions requiring an owner decision

1. **How to pay for the run.** A key with paid quota finishes it in one
   sitting; a free-tier key can do roughly one case a day; or the corpus can
   be left as a tool with no first report. Only the first produces a
   measurement of the prompts.
2. **Whether contract 6.0 is meant to fall back on red.** Separate finding,
   raised by the pilot and not part of this slice.
   `generate_psychological_interpretation_result` (contracts ≤ 5.0) raises
   `ProviderUnavailableError` for yellow and red, with a comment saying so;
   `generate_structured_summary_result` (contract 6.0, the deployed one)
   returns `deterministic_fallback` for every status. The pilot's
   `management-support` — score 28, red — came back as fallback inside a
   `status: success` payload. The provenance label is honest and the V6
   fallback is aggregate-grounded, so this may be intended, but it reads
   against ADR-007's "yellow/red text is never fabricated".

## Next concrete step

Hand the push to the owner: `git push origin feat/offline-eval-corpus:main`,
then decide question 1 above before spending any more provider quota.
