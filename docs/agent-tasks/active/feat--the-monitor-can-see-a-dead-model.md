# Feat: the existing monitor can see a dead model

## Metadata

- Branch: feat/the-monitor-can-see-a-dead-model
- Base branch: main
- Base commit: `3b02f1c` (tip of `feat/the-service-remembers-its-last-provider-answer`,
  itself not yet on `main`)
- Current HEAD: `273eda5`, both halves committed and pushed. `main` is the same
  commit, and the deployed AI service reports it.
- Status: **done.** Code, documentation, deployment and the monitor itself.
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

- `ai-analytics-service/src/services/provider_health.py` — the docstring
  recording that `status` is a contract with something outside the repository,
  and `read_provider_status`.
- `ai-analytics-service/src/main.py` — the anonymous `GET
  /api/v1/provider-status`.
- `ai-analytics-service/tests/test_provider_health.py` — pin the three literals
  and the disclosure boundary.
- `ai-analytics-service/README.md` — its endpoint list.
- `docs/shalomut-tracker-handoff.md` — the monitor, its keyword logic and the
  plan change.
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

- **Owner decision, 2026-08-17: a second UptimeRobot monitor**, of four offered
  paths — that, an anonymous minimal endpoint, a real log collector via drains,
  or making only the manual read cheap. It was first taken as *with an
  `Authorization` header against the secret-gated endpoint*; that half was
  superseded hours later by the plan change below, when the header turned out to
  be a paid feature. The monitor itself is still the decision.
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
- **The header plan died on a verified fact, and the fallback was taken.**
  UptimeRobot's free plan locks `Request headers` to Solo/Team/Scale — read in
  the monitor form itself, signed in, on 2026-08-17, alongside locks on HTTP
  method, request body and `Up HTTP status codes`, and with no authentication
  field of any kind. So no free monitor can present a bearer token.
  **Owner decision the same day, of four:** publish an anonymous status word
  rather than pay for the header, add a second monitoring service, or keep no
  watchdog.
- **The anonymous endpoint carries the word and nothing else.**
  `GET /api/v1/provider-status` → `{"status":"answering"|"failing"|"unknown"}`.
  The reason, model, counts and timing stay behind the secret: they are what
  turns "the model is down" into "the account has no credit". It is its own path
  rather than a field on `/health`, because the keep-alive monitor keys on
  `"status":"online"` there and two watchdogs in one body break each other.
- **The projection is by explicit key**, `{"status": read_provider_health()["status"]}`,
  so a field added to the full reading later cannot leak anonymously by being
  forgotten — it has to be named to escape.

## Assumptions

- None outstanding. The one this task carried — that UptimeRobot's free plan
  allows a custom request header — was checked and is **false**, which changed
  the plan; see `Decisions made`.

## Completed

- The two constraining facts established by reading the handoff rather than
  assumed.
- The keyword consequence found and resolved before the monitor was configured
  rather than after it started crying wolf.
- `status` documented as an external contract at its source.
- `test_the_status_literals_are_a_contract_with_the_external_monitor` added,
  asserting all three literals and that `failing` appears in neither quiet
  state.
- Committed as `a8f3b40`. Everything below was done after it.
- UptimeRobot's monitor form read signed-in, which killed the header plan; the
  owner chose the anonymous word the same day.
- `read_provider_status` and `GET /api/v1/provider-status` added, with two tests
  holding the disclosure boundary, and the README endpoint list extended.
- Committed as `273eda5`, pushed by the owner, and on `main`.
- Deployed. Render had queued nothing after the push — a GitHub outage, confirmed
  on both dashboards — so `Manual Deploy → Deploy latest commit` built it:
  `dep-da1m9ougekts738b815g`, about four minutes.
- **Monitor `803761399` created**, 2026-08-17 at 22:46 GMT+3, with exactly the
  configuration this task specified and no credential of any kind.

## In progress

- Nothing in code.

## Remaining

Nothing in this task — both paths are observed. What is left is deliberately
outside it:

- **The monitor is red and stays red until the provider account is topped up.**
  That is the watchdog telling the truth, not a state to clear. The incident
  should not be resolved by hand.
- The metric lines are still uncollected; see `Non-goals`.

## Changed files

Committed in `a8f3b40`: the `provider_health.py` docstring, the literal-pinning
test, the first handoff entry and this file.

Uncommitted in the working tree:

- `ai-analytics-service/src/services/provider_health.py` — `read_provider_status`
  and one corrected docstring sentence.
- `ai-analytics-service/src/main.py` — the anonymous endpoint and its import.
- `ai-analytics-service/tests/test_provider_health.py` — two tests.
- `ai-analytics-service/README.md`, `docs/shalomut-tracker-handoff.md` and this
  file.

No contract, schema, migration or deployment configuration is touched, and
`docs/data-flow-and-subprocessors.md` deliberately is not: the monitor receives
one word and no respondent data.

Pre-existing unrelated modification, left untouched and unstaged:
`next-env.d.ts`.

## Verification evidence

Context: local.

### Passed

- Full Python suite: `.venv/bin/python -m pytest -q` — **496 passed**, 0 failed,
  after the anonymous endpoint (494 at the first commit of this branch).
- Targeted: `pytest tests/test_provider_health.py -q` — 12 passed.
- **The pin was falsified.** Renaming the `failing` literal to `down` in
  `provider_health.py` failed three tests, including the new one; restoring it
  returned the suite to 494 passed. So the test fails for the rename it exists to
  catch, rather than passing by construction.

### Failed

- None.

- **The anonymous endpoint's two states were read from the running app**, with
  the service configured as `production` and a secret set:
  `{"status":"unknown"}` before any provider call and `{"status":"failing"}`
  after a refused one, both without any credential — while
  `GET /api/v1/provider-health` answered `401` to the same unauthenticated
  caller. So the split is observed, not intended.
- **The disclosure boundary was falsified.** Returning the full reading from
  `read_provider_status` failed exactly the two anonymous tests and nothing else;
  restoring the projection returned the suite to 496 passed.

- **Deployed, and read from the outside.** Before the deploy the path answered
  `404 {"detail":"Not Found"}` and `/health` reported `commit: 4c06351`; after it,
  `/api/v1/provider-status` answered `{"status":"unknown"}` and `/health` reported
  `commit: 273eda5`. So the endpoint that is being monitored is the one this
  branch added, checked by its absence beforehand rather than only its presence
  after.

- **The alert fired, end to end, at the owner's request.** One real question
  suggestion on the deployed Core (`503 upstream_error`, 5.2s, 23:00:45) moved the
  anonymous status to `{"status":"failing"}`. UptimeRobot confirmed the keyword
  from three locations — Ohio 23:02:39, N. Virginia 23:02:53, Dallas 23:03:10 —
  opened incident `347832752932025400` with root cause *Keyword has been found*,
  stored the response body as evidence, and logged `Email sent to Maksim
  Berenshteyn / SUCCESS` at 23:03:12. Two minutes twenty-seven seconds from a
  refused model to an e-mail.

### Blocked or not run

- **`verify:core`** was run on this branch after the anonymous endpoint landed;
  see `Passed`.

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
- **This paragraph predicted the first deployed reading would be `failing`,
  because the provider account is depleted. It was wrong, and the reason is worth
  keeping.** The state lives in process memory; a deploy restarts the process;
  nothing has called the provider since. The real first reading was `unknown`,
  and the monitor started green. The depleted account only becomes visible on the
  next real suggestion or round analysis — which is the residual limit above,
  observed rather than argued.

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

- **None outstanding, and the one that was approved is no longer needed.** The
  owner approved pasting `AI_WEBHOOK_SECRET` into one UptimeRobot monitor on
  2026-08-17; the free plan's lack of headers made that impossible, and the
  anonymous path means no secret leaves this repository's two deployments. The
  approval is recorded as spent-unused rather than deleted, so nobody re-derives
  it as permission later.

## Questions requiring an owner decision

- None outstanding. The placement question was answered; the keyword question was
  a consequence resolved in the answer's own terms.

## Next concrete step

Archive this task file — the work is delivered and deployed. The one open
question it leaves behind belongs to the owner, not to a next agent: whether to
fire one real provider call to prove the alert reaches the inbox, accepting that
it arrives as a genuine Down e-mail.
