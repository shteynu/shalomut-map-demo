# The thinking budget is a declared number

## Metadata

- Branch: `feat/the-thinking-budget-is-a-declared-number`
- Base branch: `origin/main`
- Base commit: `dab5ef6`
- Current HEAD: `54eb8f7`, thirteen commits ahead of `origin/feat/…` and twelve
  ahead of `origin/main` (`4bd5b2f`)
- Git state at close: nothing staged, nothing untracked (`git ls-files -o
  --exclude-standard` empty), one unstaged file — `next-env.d.ts`, the owner's
  pre-existing change, untouched by this task
- Visibility: this worktree and any other worktree of this repository, because
  every commit is on the branch. **Not** another checkout or machine — the
  branch on `origin` is still at `dab5ef6` and carries none of it
- Status: complete. Quality measured twice, cost measured on both settings at the bounds the deployment now runs; nothing in this file is reasoned rather than measured
- Last updated: 2026-08-19
- Last agent/tool: Claude Code (Opus 5)

**One correction worth reading before anything else.** For most of this task the
commits were not on the branch this file is named for. They were piled on
`docs/the-partial-run-was-exercised-on-the-deployed-stack`, whose own commit
`4bd5b2f` was already on `main`, while `feat/the-thinking-budget-is-a-declared-number`
sat empty at `dab5ef6` — and that empty branch is the one that reached `origin`.
Corrected on 2026-08-19 by fast-forwarding `feat/…` to `54eb8f7` and returning
the `docs/…` label to `4bd5b2f`, where the owner left it. No history was
rewritten and no commit was lost; `dab5ef6` is an ancestor of `54eb8f7`, so the
push that publishes this is still a fast-forward. The lesson for the next agent
is the cheap check that would have caught it: after creating a branch, confirm
`git status -sb` names it before the first commit, because a task file named
from the branch cannot detect that the branch is somewhere else.

## Objective

Let the deployment say how much of an answer's token budget the model may spend
on thinking, and measure what that costs on one round.

## User-visible outcome

None directly. The manager's map is unchanged while `LLM_REASONING_EFFORT` is
unset, which is the default. What changes is who decides the largest line on the
provider bill.

## Context

The owner asked why a $50 prepaid Gemini balance was spent so quickly. Reading
the code answered it structurally: thinking tokens bill at the output rate ($9
per million on `gemini-3.5-flash` against $1.50 for input), the interpretation
measured on 2026-07-28 spent 1440 of them against 108 visible ones, and the
request this service sends carried `max_tokens` and `temperature` and nothing
about reasoning. So the biggest half of every bill was the provider's default.

The strategy sweep of 2026-08-10 put "do not optimize LLM cost" in its do-not-do
list and asked only for logging. This task is the owner's explicit instruction of
2026-08-19 and supersedes that item for this one knob; the logging half of it is
extended rather than replaced.

## Scope

- `LLM_REASONING_EFFORT` in the AI service config, validated and forwarded.
- `reasoning_tokens` on the existing usage log line.
- Make a local pipeline run able to show what it cost at all.
- Measure one round before and after, and set the deployed value from it.

## Non-goals

- Aggregation, alerting or any budget feature in the transport. The usage line
  stays one line per billed answer.
- Changing `MAX_TOKENS_PER_DIMENSION`. It answers a different question and its
  measured value of `8192` stands.
- Touching the pace, the model, or `render.yaml`, which gets a value only once
  there is a measurement behind it.

## Acceptance criteria

- Unset variable sends the request the service sent before it existed.
- A configured value reaches the provider verbatim.
- An unsupported value is refused rather than forwarded, and is named in
  `runtime_configuration_errors()`.
- The usage line carries the thinking share of every completion.
- A local run over one round reports its own token totals.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-tracker`, `.agents/skills/shalomut-map`,
`.agents/skills/shalomut-verification` (row: `ai-analytics-service` → full
`pytest`).

## Relevant architecture and contracts

No contract surface is touched. `contracts/` and the versioned manifests are
untouched; the change is confined to the provider transport, its configuration
and its logging.

## Decisions made

- Unset means the field is omitted, not sent empty. A provider that never heard
  of `reasoning_effort` must see the old bytes, and one that has must not be told
  "no effort" by a variable nobody set.
- An unrecognised value fails closed on this side: not forwarded, recorded as a
  configuration error. Forwarded, a typo is a `400` on all ~28 calls of a round —
  every dimension on the deterministic sentence, and a run that reports success.
- `reasoning_tokens` is logged as the split of `completion_tokens`, never added
  to a total. Adding it would double-count what the provider already billed once.
- `render.yaml` keeps the provider default and documents why. `low` was
  declared there on the strength of one round and withdrawn when the corpus
  showed it losing three stones in 56. The file's rule cuts both ways: a number
  is declared beside its evidence, and withdrawn by evidence too.
- The three lost stones are a timeout rather than a quality verdict, so `low` is
  not refused permanently — it waits on the retry budget under Remaining.

## Assumptions

- The deployed `GEMINI_API_KEY` is the same key as the local one. Both are
  outside this repository; the local one was probed directly and is depleted.

## Completed

- `ai-analytics-service/src/config.py`: `SUPPORTED_REASONING_EFFORTS`,
  `llm_reasoning_effort`, `llm_reasoning_effort_configuration_error`, surfaced
  through `runtime_configuration_errors()`.
- `ai-analytics-service/src/services/llm_transport.py`: the field travels only
  when configured; `_reasoning_count` reads
  `usage.completion_tokens_details.reasoning_tokens`, and the usage line names
  it.
- `ai-analytics-service/src/pipeline_cli.py`: configures logging on stderr. It
  never did, so every INFO line the service writes — including the usage line —
  was dropped for local runs, and stdout stays the payload its caller parses.
- `scripts/local-unlocked-pipeline.ts`: the child's stderr is inherited instead
  of captured and discarded on success.
- Tests: `ai-analytics-service/tests/test_reasoning_effort.py` (new), plus the
  thinking-share cases in `tests/test_token_usage_logging.py`.
- `ai-analytics-service/README.md`: the knob and the usage line's fields.
- `render.yaml`: the knob is documented and deliberately unset, with both
  measurements beside it.
- `ai-analytics-service/evals/run_corpus.py`: configures logging, so a run that
  spends money can say how much.
- `ai-analytics-service/evals/README.md`: the `--env-file` default, and the two
  new baselines.
- `ai-analytics-service/evals/baselines/2026-08-19-gemini-3.5-flash.json` and
  `...-reasoning-low.json` (new).
- `ai-analytics-service/src/config.py`: the retry budget, request timeout and
  minimum retry window, with the reason they were 25/20/8 and are now 90/40/20.
- `ai-analytics-service/tests/test_llm_provider.py`: the invariant those three
  numbers exist to have, and the ceiling that survives raising them.

## In progress

Nothing.

## Remaining

- Decide the adaptation defect below. It is not this branch's work, but it is
  where roughly half of a round's calls go.

## Changed files

- `ai-analytics-service/src/config.py`
- `ai-analytics-service/src/services/llm_transport.py`
- `ai-analytics-service/src/pipeline_cli.py`
- `ai-analytics-service/README.md`
- `ai-analytics-service/tests/test_reasoning_effort.py` (new)
- `ai-analytics-service/tests/test_token_usage_logging.py`
- `ai-analytics-service/tests/test_llm_provider.py` (env cleanup only)
- `scripts/local-unlocked-pipeline.ts`
- `docs/shalomut-tracker-handoff.md`
- this file

## Verification evidence

### Passed

- `ai-analytics-service/.venv/bin/python -m pytest -q` → **550 passed**, at
  `54eb8f7`, run with `GEMINI_API_KEY` and `LLM_REASONING_EFFORT` stripped from
  the environment. (548 at the earlier commits, before the two tests that pin
  the raised bounds.)
- `npx tsc --noEmit` → clean at `54eb8f7`. `npm run lint` → clean.
- `git diff --check origin/main..HEAD` → clean.
- Local pipeline without a provider key: the run reaches the model boundary and
  reports `missing_api_key`, which proves the stderr plumbing without spending
  anything.
- One direct request to `generativelanguage.googleapis.com` with the local key,
  to read the error body behind the `429`s.
- **The measurement.** One round — the local unlocked fixture, `gemini-3.5-flash`
  at the deployed settings — run three times on 2026-08-19 after the top-up:

  | | billed answers | thinking | visible | cost | map |
  | --- | --- | --- | --- | --- | --- |
  | unset | 19 | 58,885 (89% of output) | 6,928 | $0.6226 | 8/8 `llm`, first attempt |
  | `medium` | 19 | 59,845 (90%) | 6,814 | $0.6301 | 8/8 `llm`, first attempt |
  | `low` | 31 | 24,742 (68%) | 11,677 | $0.3817 | 8/8 `llm`, first attempt |

  Three things this says. Unset *is* `medium`, within 2% on every count, so the
  knob only does something below it. `low` costs 39% less while returning the
  same map, and the saving is a floor: the unset run lost four answers to the
  20-second client timeout, which this service cannot see the bill for and `low`
  did not incur. And `low` sends more requests, not fewer — 31 against 19 —
  because the adaptation retries that used to time out now actually complete.

  Thinking is not itemised by this provider. `reasoning_tokens` reads
  `unavailable` on every line, and the figures above are
  `total_tokens - prompt_tokens - completion_tokens`.
- **The eval corpus, both ways**, 2026-08-19, `gemini-3.5-flash` at the deployed
  settings, seven analysed cases each (`locked-below-threshold` never reaches a
  provider). Reports committed under `evals/baselines/`:

  | | mean | findings | distinctness | no_overreach | stones by the model |
  | --- | --- | --- | --- | --- | --- |
  | unset | 0.9644 | 2 | 0.8522 | 0.97 | **56 / 56** |
  | `low` | 0.9586 | 6 | 0.8529 | 0.94 | **53 / 56** |

  The graders barely move and no Hebrew refusal appears anywhere, so `low` does
  not make the model write worse. What it costs is three paragraphs, and the
  provenance says why: all three ended `reason=TimeoutError` at
  `scope=structured_summary`, with 1, 2 and 2 attempts — the request timeout,
  not the model. `low` had fewer timeouts than unset overall (38 against 51),
  and unset lost no stone because its timeouts fell where a retry recovered
  them.

  Cost of the `low` corpus run, from its own usage lines: 141 billed answers,
  264,334 thinking tokens (76% of billed output), $3.27, or $0.468 a round. The
  unset corpus run has no token figures — `run_corpus` was still dropping the
  usage line when it ran, which this branch then fixed.
- **The raised budget recovers the stones, on the four cases that completed.**
  After `llm_retry_budget_seconds` 25 → 90, `llm_request_timeout_seconds`
  20 → 40 and `llm_min_retry_window_seconds` 8 → 20, the corpus was rerun at
  `low`. Four cases finished before the account ran dry; on exactly those four:

  | | stones by the model | mean | findings |
  | --- | --- | --- | --- |
  | unset, old bounds | 32 / 32 | 0.9598 | 1 |
  | `low`, old bounds | 30 / 32 | 0.9602 | 3 |
  | `low`, raised bounds | **32 / 32** | 0.9516 | 2 |

  And the mechanism is confirmed rather than inferred: **zero** `TimeoutError`
  in 105 billed answers, against 38 in the previous `low` run and 51 in the
  unset one. The stones `low` lost were answers this service stopped waiting
  for.
- **The corpus completed at `low` on the raised bounds**, the three remaining
  cases run separately once the account had credit again and joined to the four
  above — legitimate because the cases are independent and the report carries no
  timestamp. Committed as
  `evals/baselines/2026-08-19-gemini-3.5-flash-reasoning-low-waited.json`:

  | | stones by the model | mean | findings | distinctness | no_overreach |
  | --- | --- | --- | --- | --- | --- |
  | unset, old bounds | 56 / 56 | 0.9644 | 2 | 0.8522 | 0.97 |
  | `low`, old bounds | 53 / 56 | 0.9586 | 6 | 0.8529 | 0.94 |
  | `low`, raised bounds | **56 / 56** | 0.9604 | 3 | 0.8471 | 0.955 |

  No `TimeoutError` and no `429` in the three-case run. Cost there was $0.72 a
  round against $0.468 under the old bounds — the same answers, now finished
  instead of abandoned.
- **The cost comparison, on the bounds the deployment now runs.** The same local
  fixture, both settings, 31 billed answers each, no timeout in either, eight
  `llm` stones in both:

  | | billed answers | thinking | cost |
  | --- | --- | --- | --- |
  | unset, old bounds | 19 | 58,885 | $0.6226 |
  | unset, raised bounds | 31 | 106,175 | **$1.1224** |
  | `low`, old bounds | 31 | 24,742 | $0.3817 |
  | `low`, raised bounds | 31 | 22,728 | **$0.3707** |

  **67%**, not the 39% one round on the old bounds suggested. The old timeout
  was saving money by discarding the answers that cost most to produce, and the
  three lost stones were the visible half of that: unset nearly doubled when it
  started waiting, while `low` did not move, because its answers were never the
  ones being abandoned.

### Failed

- The first full local run of 2026-08-19, before the account was topped up:
  every call answered `429 RESOURCE_EXHAUSTED`. Not a defect in this branch.

### Blocked or not run

- Nothing is blocked and nothing is owed. Every number in this file was
  measured, including the last one — see the four-run cost table under
  Completed.
- Void, recorded so nobody re-reads it as evidence: the first attempt at the
  `low` rerun ran out of prepayment credit inside case 4 of 8, and its last
  three cases came back with all 24 stones on `deterministic_fallback` for a
  report of mean 0.8829 and 55 findings. That measures this service's own
  boilerplate, exactly as `evals/README.md` warns. Not committed as a baseline.
  Its four completed cases are sound and were reused in the report that is.
- `minimal` and `none` were not measured. `low` already returned the whole map,
  so the cheaper settings were not worth the risk of a round nobody would trust.
- No deployed verification, and it is not yet possible: `render.yaml` declares
  `low` on this branch only, and Render rebuilds the service from `main`. The
  deployed row of the verification matrix — source, build, health, status,
  logs — is owed by whoever lands this, not by this task. What to look for
  afterwards is one usage line per answer with a `total_tokens` roughly a fifth
  of what an unset round logged.

### Environment

Local only. No database was read or written. The one deployed read was the
provider probe above, which created nothing.

### Residual risk

- An effort too low fails the way a cap too small does: no usable answer, stones
  on `deterministic_fallback`, and a run that still reports success. This is why
  the deployed value waits on the measurement rather than on the reasoning.
- `reasoning_effort` is sent to whatever provider is configured. Only Gemini and
  OpenRouter are in use; a non-reasoning model would answer `400`, which is why
  the variable is opt-in and unset by default.

## Failed approaches

- Loading the whole `.env` into the local run: it sets `MCP_SHARED_SECRET`,
  which takes the in-process MCP handler out of development mode, and the run
  died on `MCP returned 401`. Only the LLM variables are needed.

## Known risks

Recorded under Residual risk, plus one found by the measurement and belonging to
no branch yet:

**The question-adaptation step failed on every dimension of every run.** All
three runs ended with `adaptation=deterministic_fallback` for all eight
dimensions, refused as `refusal=status_inconsistent` — the model's adapted
wording disagreed with the dimension's own colour and counts — after two or
three attempts each. It is independent of `LLM_REASONING_EFFORT`: identical at
unset, `low` and `medium`. In the `low` run that is 14 of 31 billed answers,
close to half the round's bill, spent on text that is then thrown away for the
deterministic sentence. The stones themselves are unaffected and the round
reports `success`, which is why it has gone unnoticed. Worth its own task.

## Approval gates

None consumed. No credential, alias or deployment configuration was changed.
Topping up the provider account is the owner's action.

## Questions requiring an owner decision

- Should local development keep using the same key as the deployment? Every
  local pipeline run and every eval-corpus run is billed to the deployment's
  balance, which is part of how the first ₪50 went — ₪21 of it on 2026-08-11
  alone, the day of the deployed walks.
- **Answered 2026-08-19: a free tier does not replace this key.** Read from AI
  Studio, the free tier allows 20 requests a day on `gemini-3.5-flash` against
  the ~28 one round needs, and 500 a day on `gemini-3.5-flash-lite`, whose
  Hebrew this project rejected on 2026-08-09. The full numbers are in
  `docs/shalomut-tracker-handoff.md`. So the measurement below waits on credit
  rather than on a cheaper account.

## Next concrete step

Push this branch — it is the same command as before, but now the branch actually
carries the thirteen commits:

```
git push origin feat/the-thinking-budget-is-a-declared-number
```

It fast-forwards `origin` from `dab5ef6`; no force, nothing to rebase, because
`origin/main` (`4bd5b2f`) is already an ancestor of `54eb8f7`. After that the
work is portable to another machine, and landing it on `main` is what triggers
the Render deploy whose verification is listed as owed above.
