# Feat: the existing monitor can see a dead model

## Metadata

- Branch: feat/the-monitor-can-see-a-dead-model
- Base branch: main
- Base commit: `3b02f1c` (tip of `feat/the-service-remembers-its-last-provider-answer`,
  itself not yet on `main`)
- Current HEAD: `3b02f1c`; this task's work is **uncommitted** in this worktree.
- Status: code and documentation complete and verified; the monitor itself is
  **not created yet** and cannot be until the endpoint is deployed.
- Last updated: 2026-08-17
- Last agent/tool: Claude Code (Opus 5)

## Objective

Make something ask on a schedule, so a dead model is noticed rather than merely
countable. Item 3 of three offered after the 2026-08-17 investigation; items 1
(`3a17333`) and 2 (`3b02f1c`) made the failure countable and readable.

## User-visible outcome

None in the product. The outcome is operational: an alert reaches the owner when
the provider stops answering.

## Context

Two facts already in this repository decided the shape of this, and both were
read before anything was proposed:

- **GitHub Actions cron does not run reliably here, and it was measured.**
  `render-keepalive.yml` carried `schedule: */10 * * * *` from 14:21Z on
  2026-08-05; ten cron windows passed with no scheduled run, while
  `workflow_dispatch` finished green in 9s. Owner decision that day: use an
  external pinger. So "let CI ask on a schedule" is a rejected hypothesis, not
  an option.
- **The external pinger already exists.** UptimeRobot, free plan, in the owner's
  account, keyword-matching `"status":"online"` on the service's anonymous
  `/health` every five minutes. The mechanism for "something asks and shouts" is
  already chosen and working; what it lacked was anything to read about the
  provider.

## Scope

- `ai-analytics-service/src/services/provider_health.py` — docstring recording
  that `status` is now a contract with something outside the repository.
- `ai-analytics-service/tests/test_provider_health.py` — pin the three literals.
- `docs/shalomut-tracker-handoff.md` — the monitor and its keyword logic.
- The UptimeRobot monitor itself, which is dashboard configuration and is the
  owner's to create.

## Non-goals

- **This does not collect the metric lines.** Item 3 was originally framed as
  collecting emitted observability somewhere durable; this closes the provider
  half of it and nothing else. `ai_question_suggestions_failed`,
  `survey_submission_lost_after_retries` and every other counter still land in a
  `console.info` line nobody reads. That decision stays open and is recorded as
  such.
- No log drain, no fifth subprocessor, no paid plan, no new code path.

## Acceptance criteria

- A rename of a `status` literal fails a test rather than silently silencing the
  alert.
- The monitor keys on the failing state only, so a restarted or unused process
  does not page anyone.
- The full Python suite passes.

## Relevant repository instructions

- `AGENTS.md` — approval gate for credentials configuration; documentation
  lifecycle.
- `.agents/skills/shalomut-verification/SKILL.md` — the `ai-analytics-service`
  row asks for the full pytest set.

## Relevant architecture and contracts

- `provider_health.py` `status` — now an external contract, see below.
- `docs/data-flow-and-subprocessors.md` — **not** edited, and deliberately: the
  monitor receives `answering`/`failing`/`unknown` and no respondent data of any
  kind, and UptimeRobot is already a party to this deployment through the
  existing `/health` monitor.

## Decisions made

- **Owner decision, 2026-08-17: a second UptimeRobot monitor with an
  `Authorization` header against the secret-gated endpoint**, of four offered
  paths — that, an anonymous minimal endpoint, a real log collector via drains,
  or making only the manual read cheap.
- **The keyword is `failing`, with the alert firing when it is present** — not
  the absence of `answering`. This was not part of the question and is the
  consequence that makes the choice work: `unknown` is the honest state of a
  process that has restarted or that nobody has used, and a monitor keyed on the
  absence of `answering` would alert on every quiet period and every redeploy.
  Keyed on `failing`, both quiet states stay silent and only a real refusal
  pages anyone.
- **The literals are pinned by a test.** A rename would not break anything
  visibly: the monitor would stop finding `failing`, report Up forever, and the
  alert would be gone without a single error anywhere. A watchdog that fails
  quiet is worse than no watchdog.

## Assumptions

- UptimeRobot's free plan allows a custom request header. **This is not yet
  verified** — see `Blocked or not run`. If it does not, the choice has to be
  revisited before the monitor exists, and the anonymous-minimal-endpoint option
  is the fallback the owner already saw.

## Completed

- The two constraining facts established by reading the handoff rather than
  assumed.
- The keyword consequence found and resolved before the monitor was configured
  rather than after it started crying wolf.
- `status` documented as an external contract at its source.
- `test_the_status_literals_are_a_contract_with_the_external_monitor` added,
  asserting all three literals and that `failing` appears in neither quiet
  state.

## In progress

- Nothing in code.

## Remaining

1. Commit this branch.
2. Push the three-branch stack so the endpoint is deployed: `3a17333`,
   `3b02f1c` and this one.
3. Confirm Render redeployed the service, then create the monitor:
   `GET https://shalomut-ai-analytics.onrender.com/api/v1/provider-health`,
   header `Authorization: Bearer <AI_WEBHOOK_SECRET>`, keyword type, alert when
   `failing` **exists**. The secret is pasted by the owner; no agent enters it.
4. Record the monitor's id and first reading in the handoff, the way the
   `/health` monitor is recorded.

## Changed files

Uncommitted in the working tree:

- `ai-analytics-service/src/services/provider_health.py` — docstring only, no
  behaviour change.
- `ai-analytics-service/tests/test_provider_health.py` — one test.
- `docs/shalomut-tracker-handoff.md`.
- `docs/agent-tasks/active/feat--the-monitor-can-see-a-dead-model.md` (this file).

Pre-existing unrelated modification, left untouched and unstaged:
`next-env.d.ts`.

## Verification evidence

Context: local.

### Passed

- Full Python suite: `.venv/bin/python -m pytest -q` — **494 passed**, 0 failed.
- Targeted: `pytest tests/test_provider_health.py -q` — 10 passed.
- **The pin was falsified.** Renaming the `failing` literal to `down` in
  `provider_health.py` failed three tests, including the new one; restoring it
  returned the suite to 494 passed. So the test fails for the rename it exists to
  catch, rather than passing by construction.

### Failed

- None.

### Blocked or not run

- **Whether UptimeRobot's free plan supports a custom request header.** The
  dashboard requires a sign-in that no agent performs, and the check is one look
  at the monitor form. This gates the chosen option.
- **The monitor itself.** It cannot be created before the endpoint is deployed —
  pointing a monitor at a path that does not exist yet would report Down
  immediately and teach the owner to ignore it.
- **`verify:core`.** Not re-run for this diff: it is a docstring, a test and
  Markdown, and the Python suite that covers them ran whole. It was run and
  exited 0 on the parent commit `3b02f1c`.

### Environment

- Local worktree, service virtualenv `ai-analytics-service/.venv` (Python 3.14).
  `GEMINI_API_KEY` stripped from every run; no provider call was spent.

### Residual risk

- **The alert can only fire while something is exercising the provider.** The
  state moves on a real suggestion or a round's analysis, so on a deployment
  nobody is using, a dead provider reads as `unknown` and the monitor stays
  quiet. This watches for a provider that fails *in use*; it does not discover a
  provider that fails while unused. Naming this is the point — the alternative
  reading, that a silent monitor means a healthy model, is exactly the belief
  this whole line of work exists to prevent.
- The account behind the key is currently depleted, so the first reading after
  deployment should be `failing`. A monitor that goes red immediately is correct
  here and must not be read as a misconfiguration.

## Failed approaches

- None in this task. The two approaches that would have been proposed —
  GitHub Actions cron, and a metric sink pushed to a new collector — were ruled
  out by evidence already in the repository and by cost, before code.

## Known risks

- One more place holding `AI_WEBHOOK_SECRET`. It is an inbound service secret,
  not a user credential, and it protects a read that returns no respondent data;
  the owner accepted this in choosing the option. Rotating it now means updating
  Render, Vercel and UptimeRobot.

## Approval gates

- **Credentials configuration: approved by the owner on 2026-08-17**, bounded to
  pasting `AI_WEBHOOK_SECRET` into one UptimeRobot monitor. No agent enters the
  value.

## Questions requiring an owner decision

- None outstanding. The placement question was answered; the keyword question was
  a consequence resolved in the answer's own terms.

## Next concrete step

Commit this branch, then push the three-branch stack so the endpoint exists in
the deployed service. The monitor is created after that, not before. Suggested
message:
`feat(ai): the provider status is a contract with the monitor, and a test says so`.
