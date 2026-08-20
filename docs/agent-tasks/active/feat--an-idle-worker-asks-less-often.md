# An idle worker asks less often

## Metadata

- Branch: `feat/an-idle-worker-asks-less-often`
- Base branch: `main` (`origin/main` = `e2b70ce`)
- Base commit: `e2b70ce0df463256815f6342661b28e640a06806`
- Current HEAD: see `## Exact Git state`
- Status: implementation complete, unpushed
- Last updated: 2026-08-20
- Last agent/tool: Claude Code (Opus 5)

## Objective

Back the AI job worker's poll off while the queue is empty, so an idle queue
stops costing Core a request every two seconds.

## User-visible outcome

None for a manager. The change is operational: far fewer Core invocations, and
up to one idle ceiling (30 s) of extra delay before the first round of a quiet
stretch is claimed.

## Context

The owner asked whether polling Core every two seconds is too much for the
database and for the app. Measured answer: the database is not the constraint.
One idle poll is two indexed queries — the `lease_exhausted` sweep and the
candidate `findFirst` in `claimNext` — against a table that gains one row per
analysis run (one row in the local database today), and the deployed
`DATABASE_URL` goes through a pooler, so there is no connection storm either.

The cost sits on Core's side: ~43 000 requests a day, each a serverless
invocation, to answer `204`. It multiplies by `AI_JOB_POOL_SIZE`, because every
lane runs its own poll loop (`ai-analytics-service/src/main.py`).

Ruled out as an interaction: Render's fifteen-minute sleep timer is reset by the
external monitor's inbound `GET /health`, never by the worker's outbound polling
(`docs/platform-handbook.md`, `docs/shalomut-tracker-handoff.md` deployed
state). Slowing the poll cannot put the service to sleep.

## Scope

- `ai-analytics-service/src/services/ai_job_worker.py` — idle backoff in
  `run_forever`, plus `wait_between_polls` as the one place a poll waits.
- `ai-analytics-service/src/config.py` — `ai_job_poll_max_interval_seconds`.
- `ai-analytics-service/src/main.py` — pass it to every pool slot; the startup
  line now reports both intervals.
- Tests, both `.env.example` files, service README, run-lifecycle doc.

## Non-goals

- A shared poll loop for the whole pool — each lane still polls on its own, so
  the saving is per slot rather than per process.
- A push hint from Core on enqueue.
- Jitter between lanes (they can align; at one poll per 30 s it does not
  matter).

## Decisions made

- Doubling from the base rather than a flat larger interval: a busy worker keeps
  its two-second reflex, and only silence widens the wait.
- The wait grows *after* the sleep, so the first quiet poll still happens one
  base interval later — 2, 4, 8, 16, 30, 30 …
- A failed poll widens the wait too. A Core that cannot answer is the last thing
  to ask twice as often.
- The ceiling is clamped to at least the poll interval, so a misconfigured
  ceiling can never read as a shorter interval.
- `max_poll_interval_seconds` defaults to `None` = the old flat cadence, so the
  existing callers and tests keep their behaviour.

## Assumptions

- Up to 30 s of extra start delay is acceptable: an analysis takes about three
  minutes and nothing notifies the manager when it finishes.

## Completed

- Backoff, config setting, wiring, startup log line.
- Four tests in `ai-analytics-service/tests/test_ai_job_worker.py`: widening to
  the ceiling, reset after a claim, flat cadence without a ceiling, and the
  config clamp.
- Documentation: both `.env.example` files, `ai-analytics-service/README.md`,
  `docs/ai-analysis-run-lifecycle.md` (numbers table, sequence diagram label,
  and a paragraph on why the loop is not a metronome).

## Remaining

- Owner push. Nothing else in this scope.

## Changed files

`.env.example`, `ai-analytics-service/.env.example`,
`ai-analytics-service/README.md`, `ai-analytics-service/src/config.py`,
`ai-analytics-service/src/main.py`,
`ai-analytics-service/src/services/ai_job_worker.py`,
`ai-analytics-service/tests/test_ai_job_worker.py`,
`docs/ai-analysis-run-lifecycle.md`, this file.

## Verification evidence

### Passed

- `.venv/bin/python -m pytest` from `ai-analytics-service` — 568 passed.
- Wall-clock check of the real (unpatched) wait path, scratch script: with a
  0.05 s base and a 0.4 s ceiling the gaps between claims were
  `0.051, 0.101, 0.201, 0.401, 0.406`, and setting the stop event mid-wait
  returned the loop immediately.
- `.venv/bin/python -c "import src.main; …"` — settings resolve to poll 2.0,
  ceiling 30.0.
- `git diff --check` — clean.

### Failed

- None.

### Blocked or not run

- No TypeScript check run: the diff touches no `.ts`/`.tsx` file.
- Not exercised against a running Core or the deployed service.

### Environment

- local and test.

### Residual risk

- The unit tests patch `wait_between_polls`, so the loop's sequence and the real
  sleep are proven separately (the wall-clock check above covers the second, and
  `test_stopping_the_pool_cancels_every_slot` still runs the unpatched path).
- Deployed behaviour changes only when Render rebuilds after this lands. No
  deployed environment variable has to be set: the default is the ceiling.

## Known risks

- With `AI_JOB_POOL_SIZE > 1`, a second queued round can wait for an idle lane's
  current sleep — up to 30 s — because only the lane that claimed resets. The
  lane that just finished polls at the base interval, so a queue drains at full
  speed once it is moving.

## Approval gates

- None. No secrets, credentials, auth configuration or alias changes.

## Exact Git state

- Committed on this branch, ahead of `origin/main` by the commits listed by
  `git log --oneline origin/main..HEAD`.
- Unstaged and unrelated: `next-env.d.ts` (Next.js regenerated the routes-type
  import path; pre-existing, left alone).
- Untracked: none (`git ls-files -o --exclude-standard`).
- Visibility: this branch has not been pushed. The handoff is worktree-local
  until `git push origin feat/an-idle-worker-asks-less-often` (or
  `…:main`) runs, which is an owner action here.

## Next concrete step

Owner pushes the branch — `git push origin feat/an-idle-worker-asks-less-often:main`
— after which Render rebuilds the service and the startup line reports the two
intervals.
