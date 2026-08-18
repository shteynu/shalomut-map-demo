# The monitor can see a half-written map

## Metadata

- Branch: feat/the-monitor-can-see-a-half-written-map
- Base branch: main
- Base commit: `d47a59c`
- Current HEAD: see the commit on this branch; base is `d47a59c`
- Status: implemented and verified locally; not deployed, and the monitor does not exist
- Last updated: 2026-08-18
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the one remaining half of Tier 0 §5 and Tier 1 §8 of
`docs/product-strategy-axes-2026-08-10.md`: **one alert on the
deterministic-fallback ratio.** The detector has existed since the metric was
added and its sink is `console.info` with nothing on the other end, so the
2026-08-09 incident — all eight stones out of the deterministic fallback while
the round reported success — would happen again unwitnessed.

## User-visible outcome

None for a manager or a respondent. One new anonymous operational endpoint on
the AI service, for a free uptime monitor to read.

## Context

`ai_deterministic_summary_ratio_sample` is computed in Core
(`src/lib/server/ai-operational-metrics.ts`) from each stone's
`generationProvenance.outcome` and written to `console.info`. Core runs on
Vercel, where in-memory state does not survive between requests, and the free
UptimeRobot tier cannot send a request header — the constraint the provider
watchdog already hit and recorded on 2026-08-17.

The AI service is the other candidate and the better one: it is a long-lived
Render process, it already keeps an in-memory provider reading with exactly this
shape (`provider_health.py`), and every provider conversation passes through one
recording point in `llm_transport.complete_with_retries`.

## Scope

- `ai-analytics-service/src/services/provider_health.py` — a bounded window over
  the same recording, plus two readers.
- `ai-analytics-service/src/main.py` — one anonymous endpoint.
- `ai-analytics-service/tests/test_provider_health.py` — tests beside the
  provider watchdog's own.
- `ai-analytics-service/README.md`, `PROGRESS.md`, this file and the handoff.

## Non-goals

- No change to Core's metric, which stays the per-round provenance record.
- No second alerting service, no paid monitor tier, no metrics backend.
- Creating the UptimeRobot monitor itself — that needs the owner's dashboard.

## Acceptance criteria

- A window that is mostly fallback reads one word an anonymous monitor can match.
- A quiet or freshly restarted process reads `unknown`, never the healthy word.
- A recovered model clears the reading without anyone touching it.
- A green dimension the service deliberately never asked does not move it.
- The two watchdogs' keywords never appear in one another's body.

## Relevant repository instructions

- `AGENTS.md` — branch-scoped task state, documentation lifecycle.
- `.agents/skills/shalomut-tracker/SKILL.md` — session start, save progress.
- `.agents/skills/shalomut-map/SKILL.md` — boundaries and invariants.
- `.agents/skills/shalomut-verification/SKILL.md` — evidence.

## Relevant architecture and contracts

- No contract version is touched. This adds an operational endpoint and reads
  state the service already holds; `contracts/capabilities.json` is unaffected.
- The Core ↔ AI service boundary is unchanged: nothing new crosses it.

## Decisions made

- **The window is fed by the transport, not by stone outcomes.** That excludes
  the `ONLY_LLM_FOR_PROBLEMATIC` green skip, where no conversation happens and
  the stone is still labelled `deterministic_fallback`. Core's ratio counts it,
  correctly, as provenance; counting it here would page a human for a token
  optimization working as designed.
- **Bounded window of 20, minimum sample 5, degraded strictly above 0.5.** A
  since-start ratio cannot clear itself, and an alert that cannot clear is one
  nobody keeps. The threshold is a product judgement, stated so the owner can
  move it in one line.
- **Its own path, its own three literals.** `main.py` already records why two
  watchdogs must not share a body.
- **`writing` / `degraded` / `unknown`.** The fault word is an adjective where
  the provider's is a participle, because it arrives in an alert e-mail with no
  context and has to read as a fault on its own.

## Assumptions

- The service keeps running as one long-lived Render process, which is what
  makes an in-memory window meaningful. Same assumption `provider_health.py`
  already rests on, and it says so.

## Completed

- `provider_health.py`: `_recent` deque, `read_fallback_health`,
  `read_fallback_status`, `_recent_reading`, reset extended, module docstring.
- `main.py`: `GET /api/v1/fallback-status`.
- `README.md`: the endpoint list.
- Ten tests appended to `tests/test_provider_health.py`.

## In progress

- Nothing.

## Remaining

- The owner pushes this branch to `main`, Render builds it, and the endpoint is
  then read once on the deployed service.
- The owner creates the UptimeRobot keyword monitor on `degraded`.

## Changed files

- `ai-analytics-service/src/services/provider_health.py`
- `ai-analytics-service/src/main.py`
- `ai-analytics-service/tests/test_provider_health.py`
- `ai-analytics-service/README.md`
- `PROGRESS.md`
- `docs/shalomut-tracker-handoff.md`
- this file

## Verification evidence

### Passed

- `.venv/bin/python -m pytest tests/test_provider_health.py` — 22 passed,
  including the ten added here.
- `.venv/bin/python -m pytest` from `ai-analytics-service` — **506 passed**,
  17.66s. The whole Python suite, which the verification matrix requires for any
  change under `ai-analytics-service`.

### Failed

- One test failed on the way and the failure was the point:
  `test_the_fallback_literals_are_a_contract_with_the_external_monitor` caught
  the reading's own threshold field, then named `degradedAbove`, putting the
  alert word into every healthy body. Renamed to `alertsAbove`; the test now
  passes and pins the absence.

- **Deployed, 2026-08-18.** The owner pushed the stack; `/health` reports
  `commit: a39ca09`, which is `refs/heads/main`. Anonymously:
  `/api/v1/fallback-status` → `{"status":"unknown"}`,
  `/api/v1/provider-status` → `{"status":"unknown"}`,
  `/api/v1/provider-health` → `401`. Fresh process, nothing observed, both words
  honest and the detail still behind the secret.

### Blocked or not run

- The divergence the two words exist for — `answering` beside `degraded` — needs
  a real round's provider traffic and cannot be provoked read-only.
- Creating the UptimeRobot monitor: the owner's dashboard.

### Environment

- Local, `ai-analytics-service/.venv`.

### Residual risk

- The window lives in one process. Render runs one instance of this service, so
  a reading is a reading of the whole product; that stops being true the day it
  scales out, and the reading would then be per-instance.

## Failed approaches

- **Driving the transport in a loop to build a window.** The first version of
  these tests called `complete_with_retries` twenty times. The process paces its
  own sends, so every conversation after the first waits the model's interval —
  six seconds on the fast tier — and the suite hung rather than failed, which is
  why it took a per-test timeout to find. The window tests now record through
  `record_provider_attempt` directly; one test still drives the real transport so
  the tie to real work is not lost, and the recording point itself was already
  pinned by the tests above it. Worth knowing generally: a test in this service
  that makes two successful provider calls pays for the second one — **fixed on
  2026-08-18** on `fix/the-unpaced-fixture-unpaces-both-tiers`, where the root
  fixture learned to zero the tier it was missing. The tests here still record
  directly, for the reason that outlives the pacing.

## Known risks

- A monitor keyword and a code literal are one contract across two systems. The
  tests pin the literals; nothing in this repository can pin the monitor.

## Approval gates

- **Publishing a second status word anonymously.** The owner decided on
  2026-08-17 to publish the provider word rather than pay for header support,
  and this applies the same reasoning to a strictly less sensitive fact — a
  state of the product, not of the account. Worth naming out loud rather than
  assuming, because it widens what an anonymous caller can see.

## Questions requiring an owner decision

- Is `> 0.5` the right line, and is 20 conversations the right window? Both are
  one-line changes and both are product judgements.

## Next concrete step

Hand the push over: `git push origin feat/the-monitor-can-see-a-half-written-map:main`
is the owner's to run. Once Render has built it, read
`GET /api/v1/fallback-status` once anonymously on the deployed service — it
should answer `unknown` on a fresh process — and then create the UptimeRobot
keyword monitor on `degraded`, five-minute interval, beside the existing one on
`failing`. Record the monitor id here and in the handoff, as the provider
watchdog's entry does.
