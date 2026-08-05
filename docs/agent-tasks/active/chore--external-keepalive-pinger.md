# Move the keep-alive off GitHub's scheduler

## Metadata

- Branch: `chore/external-keepalive-pinger`
- Base branch: `main`
- Base commit: `45f38c2`
- Current HEAD: `45f38c2` plus this slice
- Status: done — the workflow's cron is gone and the monitor exists
- Last updated: 2026-08-05
- Last agent/tool: Claude Code (Opus 5)

## Objective

Stop claiming a keep-alive the repository does not have, and put the real one
where it can work.

## User-visible outcome

None directly. Operationally: a queued analysis round is worked by a service
that is awake, rather than waiting for a visitor to wake it.

## Context

`.github/workflows/render-keepalive.yml` carried `schedule: */10 * * * *` from
14:21Z on 2026-08-05. The run list was read every two minutes until 16:05Z — ten
cron windows, no scheduled run, while `workflow_dispatch` finished green in 9s.
The workflow was `active` throughout, so this was not GitHub's sixty-day idle
rule. GitHub's scheduler is best-effort, skips runs under load rather than
queueing them, and throttles short periods hardest.

Owner decision 2026-08-05: an external pinger, not the paid Render instance.

## Scope

- Remove `schedule` from the workflow; keep `workflow_dispatch` as a manual
  wake and say in the file why the cron is gone.
- Rewrite the keep-alive entry in `docs/shalomut-tracker-handoff.md`.
- Archive the two task files whose work reached `main`.

## Non-goals

- Creating an account. The owner already had one and was signed in; the monitor
  was created in their own browser, with the settings confirmed before saving.
  An agent does not sign up or hold credentials.
- Changing the Render plan or `render.yaml`.

## Acceptance criteria

- No document or workflow claims a scheduled keep-alive.
- The handoff names the monitor that actually exists — service, type, URL and
  interval — so a later reader can check it rather than assume it.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-tracker/SKILL.md`,
`.agents/skills/shalomut-verification/SKILL.md`.

## Decisions made

- The workflow stays, without its cron. A one-click wake before a demo or a
  round is worth keeping, and it is the cheapest proof that `/health` is
  reachable from outside the owner's network.
- Five minutes for the monitor, not ten: three times the rate the fifteen-minute
  sleep timer needs, so a skipped check does not cost the service its uptime.
- Keyword type rather than plain HTTP, which the free plan turned out to allow:
  it fails unless the body contains `"status":"online"`, so a `200` from an edge
  in front of an unhealthy container does not read as alive.
- `/health` is the target. It is public, returns no respondent data, and its
  body already carries the deployed commit — so the monitor doubles as a
  deployment reading.

## Assumptions

- None left. UptimeRobot's free plan gave both the five-minute interval and the
  keyword type, which was read off the form rather than assumed.

## Completed

- `.github/workflows/render-keepalive.yml`: `schedule` removed, renamed to
  "Wake the Render AI service", and the measurement written into the header
  comment so the next reader does not re-add the cron.
- `docs/shalomut-tracker-handoff.md`: the keep-alive entry rewritten, the
  repository snapshot moved to `45f38c2`.
- `docs/agent-tasks/archive/`: `docs--keepalive-schedule-proof.md` closed out,
  `feat--archived-rounds-out-of-switcher.md` archived.
- The monitor itself, in the owner's UptimeRobot account.

## In progress

- Nothing.

## Remaining

- Nothing in this task. Worth a look in a later session: whether the monitor is
  still `Up` after a day, which is the first real evidence that Render stops
  sleeping rather than that the checks are being made.

## Changed files

- `.github/workflows/render-keepalive.yml`
- `docs/shalomut-tracker-handoff.md`
- `docs/agent-tasks/archive/docs--keepalive-schedule-proof.md` (moved, closed)
- `docs/agent-tasks/archive/feat--archived-rounds-out-of-switcher.md` (moved)
- `docs/agent-tasks/active/chore--external-keepalive-pinger.md` (new)

## Verification evidence

### Passed

- `gh run list --workflow=render-keepalive.yml` read at 14:31Z, 14:34Z, 15:00Z,
  15:03Z, 15:33Z and 16:05Z on 2026-08-05: one run in the list every time, the
  `workflow_dispatch` of 14:23:40Z. That is the finding this slice rests on.
- `gh api repos/:owner/:repo/actions/workflows` reported the workflow `active`,
  ruling out the sixty-day idle rule.
- The monitor was created and then read back in the dashboard: `KW`, `5 min`,
  state `Up`, 100% uptime at its first checks. Because it is a keyword monitor,
  `Up` is itself the evidence that `/health` answered with `"status":"online"`.

### Failed

- None.

### Blocked or not run

- No test suite was run: the diff is one workflow file and documentation, with
  no TypeScript, Python, schema or route change.
- Whether the monitor keeps the instance awake over hours is **not** verified.
  Two minutes of `Up` proves the check runs, not that the sleep timer never
  wins.

### Environment

Deployed reads and GitHub API; no local suite involved.

### Residual risk

- The monitor is a dependency nobody in the repository can see or test. The
  handoff names it so the next agent checks it first if the service starts
  sleeping again.

## Failed approaches

- `schedule: */10 * * * *` on GitHub Actions. Registered, active, never fired in
  104 minutes.

## Known risks

- An external monitor is a dependency nobody in the repository can see. If the
  service starts sleeping again, the monitor is the first thing to check, and
  the handoff has to name it for that to be possible.

## Approval gates

- None. No credential, alias or authentication configuration is touched;
  `/health` is public.

## Questions requiring an owner decision

- None. UptimeRobot holds it, and the handoff says so.

## Next concrete step

Hand the push over: `git push origin chore/external-keepalive-pinger:main`.
