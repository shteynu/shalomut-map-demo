# Prove the keep-alive fires on its own schedule

## Metadata

- Branch: `docs/keepalive-schedule-proof`
- Base branch: `main`
- Base commit: `3590aae`
- Current HEAD: `3590aae`
- Status: checked, and the proof is still owed — the schedule did not fire
- Last updated: 2026-08-05
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the one proof the previous session named as still owed: that
`.github/workflows/render-keepalive.yml` runs on its `*/10` cron, not only on a
manual dispatch. Refresh the deployed snapshot of both services while looking,
since the operational handoff's repository snapshot had gone stale.

## User-visible outcome

None directly. The outcome is operational: a queued analysis round is worked by
a service that is awake, instead of waiting for a visitor.

## Context

`chore/render-pace-and-wakeup` landed the workflow and the provider pacing. Its
close-out recorded a manual `workflow_dispatch` run finishing green, and stated
plainly that a manual run proves the step works, not that the schedule fires.

## Scope

- Read-only checks: workflow runs, workflow enabled state, both deployed
  services.
- Record the result in the operational handoff.

## Non-goals

- No change to the workflow, the cron period or the Render plan.
- No sign-in to deployed Core; its manager routes stay behind `/login`.

## Acceptance criteria

- A run with event `schedule` is observed, or the absence is recorded as an
  absence with the time it was checked.
- The handoff's repository snapshot names the actual `origin/main`.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-tracker/SKILL.md`,
`.agents/skills/shalomut-verification/SKILL.md`.

## Decisions made

- Nothing about the Render plan is decided here. Paying for an instance type
  that needs no workflow stays the owner's call.

## Assumptions

- The dashboard `GEMINI_API_KEY` is the billed key. Unchanged from the previous
  session, and no agent can read it.

## Completed

- Read the workflow file and confirmed the cron is `*/10 * * * *` with
  `workflow_dispatch` beside it.
- `gh api repos/:owner/:repo/actions/workflows` reports the workflow `active` —
  not disabled by GitHub's sixty-day idle rule, which the workflow's own comment
  names as the first thing to check.

- Watched `gh run list --workflow=render-keepalive.yml` every two minutes from
  14:31Z to 15:00Z. **No run with event `schedule` appeared.** The workflow
  reached `main` in `45b45b7` at 14:21Z, so three cron windows — 14:30, 14:40
  and 14:50 — passed with nothing in the list but the manual dispatch.
- Recorded the absence in `docs/shalomut-tracker-handoff.md` and corrected its
  stale repository snapshot and deployed reading.

## In progress

- Nothing. The observation window is closed and its result is written down.

## Remaining

- Re-read the run list in a later session. If the schedule has fired by then,
  the keep-alive is proven and this task closes. If it still has not, `*/10` is
  not doing the job and the choice is the owner's: the paid Render instance
  type, which needs no workflow at all, or a pinger that is not GitHub's
  best-effort scheduler.

## Changed files

- `docs/agent-tasks/active/docs--keepalive-schedule-proof.md` (new)
- `docs/shalomut-tracker-handoff.md` (pending)

## Verification evidence

### Passed

- **Python (Render), 2026-08-05 14:31Z:** `GET
  https://shalomut-ai-analytics.onrender.com/health` answers `status: online`,
  `commit: 3590aae` — the current `origin/main` — with `env: production`,
  `privacyThreshold: 10`, `supportedContractVersions` `1.0`–`6.0` and
  `jobPollingEnabled: true`.
- **Core (Vercel), 2026-08-05 14:31Z:** the Production alias
  `shalomut-map-demo.vercel.app` holds `dpl_3uaHSHXGvzZde94GiJxYeDaBGVgs`,
  `READY`/`PROMOTED`, `target: production`, built from `main` at `3590aae`;
  built 14:29:38Z, ready 14:30:17Z. Read from the projects API in the owner's
  own signed-in Chrome; every environment variable in that payload carries an
  empty `value`, so no secret was displayed, and nothing was clicked.
- `curl` on `https://shalomut-map-demo.vercel.app/` answers `307` to `/login`,
  which is the expected anonymous behaviour.
- Workflow is `active`; one `workflow_dispatch` run, `31014964314`, completed
  `success` in 9s at 14:23:40Z.

### Failed

- None.

### Blocked or not run

- `verify:core`, `verify:db`, `verify:ai` were **not** run: the diff is
  documentation only, with no code, schema, migration, route or Python change.
- Deployed Core's `GET /api/health` is behind the login redirect, so the
  deployed producer version and supported versions cannot be read anonymously.
  Reading them needs the owner's sign-in.

### Environment

Deployed: Vercel Core and Render Python. Local worktree
`shalomut-map-demo`, otherwise untouched.

### Residual risk

- **The service's staying awake still rests on the cron being registered rather
  than on it having fired.** Thirty-nine minutes after the workflow reached
  `main`, and across three cron windows, the only run in the list is the manual
  one. The instance is awake now because the manual run and these checks reached
  it; that is not the mechanism the workflow was written to provide.
- A `*/10` cron is the period GitHub throttles hardest, and it skips runs under
  load rather than queueing them. If the next reading still shows no scheduled
  run, treat the mechanism as unproven rather than merely late.

## Failed approaches

- None.

## Known risks

- GitHub's scheduler is best-effort and delays a newly registered cron; an
  absence read minutes after the push is weak evidence either way.

## Approval gates

- None touched. No credential, no alias, no authentication configuration.

## Questions requiring an owner decision

- None.

## Next concrete step

In a later session run `gh run list --workflow=render-keepalive.yml` once. A
`schedule` run in the list closes this task and the handoff's open proof; an
empty list hours later is the evidence that the cron does not fire here, and the
question then goes to the owner as stated under `Remaining`.
