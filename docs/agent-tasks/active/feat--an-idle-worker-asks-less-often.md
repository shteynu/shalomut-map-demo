# An idle worker asks less often

## Metadata

- Branch: `feat/an-idle-worker-asks-less-often`
- Base branch: `main`
- Base commit: `e2b70ce0df463256815f6342661b28e640a06806`
- Current HEAD: `e2b70ce0df463256815f6342661b28e640a06806`
- Status: in progress
- Last updated: 2026-08-20
- Last agent/tool: Claude Code (Opus 5)

## Objective

Back the AI job worker's poll off while the queue is empty, so an idle queue
stops costing Core a request every two seconds.

## User-visible outcome

None for a manager. The change is operational: fewer Core invocations, and up
to one backoff ceiling of extra delay before the first round of a quiet stretch
is claimed.

## Context

The owner asked whether polling Core every two seconds is too much for the
database and for the app. Measured answer: the database is not the constraint —
one idle poll is two indexed queries against a table that gains one row per
analysis run (1 row locally), and the deployed `DATABASE_URL` goes through a
pooler, so there is no connection storm either. The cost is on Core's side:
~43 000 requests a day, each a serverless invocation, answering `204`. It
multiplies by `AI_JOB_POOL_SIZE`, because every lane runs its own poll loop
(`src/main.py`).

## Scope

- `ai-analytics-service/src/services/ai_job_worker.py` — idle backoff in
  `run_forever`.
- `ai-analytics-service/src/config.py` — the ceiling as a setting.
- `ai-analytics-service/src/main.py` — pass it to every pool slot.
- Tests, `.env.example` files, service README, run-lifecycle doc.

## Non-goals

- A shared poll loop for the whole pool (each lane still polls on its own).
- A push hint from Core on enqueue.
- Jitter between lanes.

## Acceptance criteria

- An empty poll widens the next wait; a claimed job resets it to the base.
- The ceiling is configurable and can never fall below the base interval.
- Omitting the ceiling keeps the old constant-interval behaviour.
- Full Python suite green.

## Next concrete step

Implement the backoff in `run_forever`.
