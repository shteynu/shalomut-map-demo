# A 7.0 round's provider call count replaces the 6.0 figure in the living docs

## Metadata

- Branch: `docs/round-call-count-7-0`
- Base branch: `main`
- Base commit: `984ce37`
- Current HEAD: the commit carrying this archive move, second on top of
  `984ce37` — `5b76671` the correction, then this move. `origin/main` is
  `984ce37` and the branch fast-forwards onto it (`git merge-base
  --is-ancestor` after a fetch on 2026-09-17)
- Status: ready to land — archived 2026-09-17 as the branch goes to `main`.
  The push is the owner's
- Last updated: 2026-09-17
- Last agent/tool: Claude Code (Claude Opus 5)

## Objective

`docs/shalomut-tracker-handoff.md` said twice that a round is "about 28 calls",
a figure written on 2026-08-19 when the deployment spoke `6.0`; it produces
`7.0` since 2026-09-13. Confirm the `7.0` count from the code, state the
clean-pass minimum, the retry bound and that the `7.0` rate per minute is
unmeasured, and re-examine the two conclusions that rested on 28: whether the
free tier's 20 requests a day finish a round, and the `30/11` arithmetic behind
`AI_JOB_POOL_SIZE=3`.

## User-visible outcome

Nothing in the product changes. Four living documents stop presenting `6.0`'s
figures as current, and the owner's index gains the prepayment top-up.

## Context

- `contracts/capabilities.json`: `7.0` has `usesNarrativeMetrics: false`, so the
  eight metric-insight batches of a `6.0` round are not sent.
- The owner stated on 2026-09-17 that no `7.0` round had been analysed through
  the deployment, because the prepayment was depleted.

## Scope

- Both handoff passages, and the other living documents that repeated the same
  figure in other words.

## Non-goals

- No change to `AI_JOB_POOL_SIZE` or to any configured value, and no invented
  `7.0` rate.
- No paid provider call.
- Dated records stay as written: `docs/critical-audit-2026-08-21.md`, ADR-034
  and ADR-053 in `PROJECT_CONTEXT.md`, the 2026-08-22 milestone in `PROGRESS.md`,
  test docstrings about past incidents.
- Comments in code and deployment config (see *Remaining*).

## Acceptance criteria

- Both passages state 17, the retry bound and that the `7.0` rate is unmeasured,
  and each conclusion is written out.
- `npm run lint:doc-numbers` passes; the work is committed; the push is handed
  over.

## Relevant repository instructions

- `.agents/skills/shalomut-tracker/SKILL.md`, `.agents/skills/shalomut-map/SKILL.md`,
  `.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

- `ai-analytics-service/src/agents/psychologist_node.py` — one structured
  summary per dimension, the metric-insight phase gated on
  `usesNarrativeMetrics` (line 256), one overall summary.
- `ai-analytics-service/src/agents/intervention_nodes.py` — one adaptation
  batch per dimension.
- `ai-analytics-service/src/services/llm_transport.py:208` — up to
  `LLM_MAX_ATTEMPTS` requests per call; timeouts stop at two.
- `ai-analytics-service/src/config.py` — `LLM_MAX_ATTEMPTS` defaults to 3,
  clamped to 1–5; `render.yaml` does not set it.
- `ai-analytics-service/src/agents/graph.py` — replays go to the heavy tier.
  The safety-validator path allows two; a third comes only through the
  outgoing-payload check, and a refusal there that names no dimension replays
  the whole round.

## Decisions made

- 17 is written as the fewest requests a round written wholly by the model can
  send, not as a global minimum: a per-dimension re-run or a missing key sends
  fewer.
- 204 (four passes of 51) is written as a bound, not an estimate.
- The two live `6.0` rounds of 2026-08-19 (27 and 28 requests against a
  structural 25) are cited as `6.0` evidence, never as a `7.0` retry share.
- The pool arithmetic keeps its form and is declared to lack its divisor; three
  lanes stay as deployed. Dropping the metric phase shortened the round too, so
  fewer requests need not mean fewer a minute.
- The search went past "28 calls", "28 paid" and "~28", because "28 provider
  calls" and "about eleven a minute" slip through those patterns.
- `open-decisions.md` entry 4 was qualified in the same commit, because that
  index follows its source by its own rule.

## Assumptions

- The Render dashboard does not set `LLM_MAX_ATTEMPTS` either. `render.yaml`
  does not declare it; the dashboard was not read.
- The prepayment is still depleted on 2026-09-17; nothing in the repository can
  read the balance.

## Completed

- The count confirmed from the code above and by an offline run (evidence
  below).
- `5b76671`: the handoff's free-tier passage under *Provider account* and item 9
  of *External blockers and approval gates*; `docs/open-decisions.md` entry 4;
  the lanes section of `docs/ai-analysis-run-lifecycle.md`; the pace paragraph
  of `ai-analytics-service/README.md`.
- At close: `docs/open-decisions.md` item 26 — top up the prepayment, which the
  index had lacked since the depletion of 2026-09-12 — and this file.

## In progress

- (none)

## Remaining

Owner:

- Land the branch (*Next concrete step*).
- Rotate `GEMINI_API_KEY`, then top up the prepayment — `open-decisions.md`
  items 1 and 26.

Agent, once the branch is on `main` — offered as follow-up tasks on 2026-09-17,
not started:

- Reword the comments that still quote `6.0`'s figures as current, changing no
  value: `ai-analytics-service/src/config.py` (the `AI_JOB_POOL_SIZE` block and
  the `LLM_MAX_CONCURRENT_REQUESTS` block), `render.yaml` above
  `AI_JOB_POOL_SIZE`, and the root `.env.example`.
- The handoff's *Provider account* still says the prepayment "has depleted
  twice" (2026-08-17 and 2026-08-19), while *Last read* records it found
  depleted on 2026-09-12.

Agent, once a round has been analysed on `7.0` through the deployment:

- Time it: requests (one `outcome=usage` line per HTTP 200, plus attempts that
  never got a 200), retry share, and `ai_analysis_runs.started_at` to
  `completed_at`. Then re-derive the divisor in handoff item 9 and the free-tier
  margin under *Provider account*. The lane count stays the owner's.

## Changed files

- `docs/shalomut-tracker-handoff.md`, `docs/ai-analysis-run-lifecycle.md`,
  `ai-analytics-service/README.md` — `5b76671`
- `docs/open-decisions.md` — entry 4 in `5b76671`, item 26 in the archive commit
- `docs/agent-tasks/archive/docs--round-call-count-7-0.md` — new, in the archive
  commit

Everything is committed on this branch; nothing is staged, unstaged or
untracked for this task.

## Verification evidence

### Passed

- Offline count at `984ce37`, script kept outside the repository, run with the
  main checkout's `ai-analytics-service/.venv/bin/python` and `PYTHONPATH` at
  this worktree's service directory; the printed `graph.py` path confirmed which
  code ran. `urlopen` was replaced by a stub answering an empty completion,
  `GEMINI_API_KEY` was unset, `LLM_API_KEY` was a dummy, `LLM_BASE_URL` pointed at
  a dead local port and both paces were 0.
  - `7.0` test fixture at `LLM_MAX_ATTEMPTS=1`: 17 requests —
    `structured_summary` 8, `overall_summary` 1, `adaptation` 8 — all on the
    fast tier, one graph pass, `success` with eight stones.
  - `7.0` test fixture at the default 3: 51 requests (24, 3, 24), one pass, no
    replay, `success`.
  - `6.0` test fixture at `LLM_MAX_ATTEMPTS=1`: 25 (8, 8 `metric_insights`, 1,
    8).
- After the `5b76671` edits: `git diff --check` exit 0; `npm run
  lint:doc-numbers` exit 0 (26 claims across 4 documents); `npm run
  lint:python-deps` exit 0; `node scripts/generate-endpoint-surface.mjs --check`
  exit 0 (14 endpoints); the new relative link in the lifecycle document
  resolves.
- At close, with item 26 and this file staged: `git diff --cached --check` exit
  0; `npm run lint:doc-numbers` exit 0 (26 claims across 4 documents).

### Failed

- (none)

### Blocked or not run

- A run that triggers replays: not run. The replay count and the 204 bound are
  from reading `graph.py`.
- The Python suite and `verify:core` beyond the gates above: not run, because no
  code changed.
- Any deployed check: documentation only.

### Environment

- Local, macOS; the count at `984ce37`.

### Residual risk

- The `7.0` retry share, duration and rate per minute stay unmeasured until a
  deployed round runs.
- The comments in `config.py`, `render.yaml` and `.env.example` still quote
  `6.0`'s figures, and the one in `render.yaml` sits beside the value it sized.

## Failed approaches

- (none)

## Known risks

- A reader who divides 30 by 17 requests over the old three minutes gets about
  five lanes. The handoff now says why that divisor is invented; the
  `render.yaml` comment still says `~11`.

## Approval gates

- None for this branch: documentation only. `git push` is the owner's.

## Questions requiring an owner decision

- None new. Whether the provider tier allows more than 30 requests a minute
  stays `open-decisions.md` item 4.

## Next concrete step

Owner: `git push origin docs/round-call-count-7-0:main`, a fast-forward of
`origin/main` from `984ce37`. It is Markdown only: Vercel builds it, and nothing
a respondent or a manager sees changes.
