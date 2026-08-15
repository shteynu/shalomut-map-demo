# A lost submit leaves a trace

## Metadata

- Branch: feat/a-lost-submit-leaves-a-trace
- Base branch: fix/the-first-submit-after-idle
- Base commit: `9f617f3`
- Current HEAD: `f18bfeb`, the second of two commits on this branch. Neither is
  on `origin`; the branch is not on the remote at all, asked of the remote
  itself rather than of a local tracking ref.
- Status: complete and verified locally. Waits on a push.
- Last updated: 2026-08-15
- Last agent/tool: Claude Code (Opus 5)

## Objective

Make the submit failure that `src/lib/survey-submission-retry.ts` mitigates
countable on the deployed endpoint, so the question "is this rare or common"
has an answer that does not depend on a respondent telling someone.

## User-visible outcome

None. A respondent sees exactly what they see today; the retry, its wording and
its timing are untouched.

## Context

The retry landed on 2026-08-15 (`ececa34`) and its own task file records the
standing consequence: *the retry hides the symptom — the next time the endpoint
loses a submit, nobody will see it.* The failure happens before any code in this
repository runs — the deployment's function logs hold no invocation for the lost
request — so the server cannot observe it. Only the client knows the first
attempt threw.

`src/lib/server/request-error-report.ts` and
`src/lib/server/ai-operational-metrics.ts` already give the product a structured
observability line with a marker key and a swappable sink. Nothing reaches
either from a request that died in transit.

## Scope

- A client report of submit *delivery*, fired only when the first attempt threw.
- A beacon route that records it and touches no repository.
- One operational metric family in the existing shape.
- `docs/openapi.yaml` plus the generated `public/openapi.json`.

## Non-goals

- No fix for the cause; it is upstream of the function and out of reach.
- No change to the retry policy, its waits, its wording or its screen.
- No persistence, no schema change, no new dependency, no third-party sink.
- No report on the happy path: a submit delivered on the first attempt stays
  exactly one request.

## Acceptance criteria

- A submit that succeeds on attempt 2 or 3 emits one structured line naming the
  attempt count; a submit lost after every attempt emits one too.
- A submit delivered on the first attempt emits nothing and makes no extra
  request.
- The report can never cost a respondent their submission: it is fired after
  the outcome is decided and every failure of it is swallowed.
- The route reads no repository, so it still answers when the database is the
  thing that is slow.
- The route cannot become a share-code oracle: it answers `204` to everything.

## Relevant repository instructions

- `AGENTS.md` — branch-scoped task state, documentation lifecycle.
- `.agents/skills/shalomut-map/SKILL.md` — canonical boundaries, composition
  root, `docs/openapi.yaml` as the only editable API source.
- `.agents/skills/shalomut-verification/SKILL.md` — `src/app/api` and
  `docs/openapi.yaml` rows of the matrix.

## Relevant architecture and contracts

- `src/lib/survey-submission-retry.ts` — `onRetry(attempt)` is the only place
  the attempt count is knowable.
- `src/components/survey/survey-flow.tsx:426` — `handleSubmit`.
- `src/app/api/survey/[shareCode]/attempt/route.ts` — the existing beacon this
  one is modelled on: unauthenticated, always `204`, never blocking.
- `src/lib/server/ai-operational-metrics.ts` — `OperationalMetricName` and the
  sink. It already carries `duplicate_submission_conflicts`, which is not an AI
  metric, so a survey delivery metric belongs there rather than in a new module.
- `src/lib/server/rate-limit.ts` — `RATE_LIMITS.surveySubmission`.

## Decisions made

- **Report only the anomaly, not every submit.** The denominator already exists
  server-side — every delivered submission is a stored response — so a beacon on
  the happy path would double the request count of the product's most important
  action to learn nothing.
- **The beacon reads no repository.** Resolving the round would make the report
  depend on the same database round-trip whose slowness is a candidate cause.
  The metric therefore carries no `roundId`, which is a deliberate loss of
  correlation: this measures the transport, not a round.

## Assumptions

- A client that has just completed a retry can reach the endpoint. For the
  recovered case this is not an assumption — the retry itself just succeeded.
  For the lost case it is one, and the report is best-effort by construction.

## Completed

- Session start: git state inspected against the remote itself, tracker and map
  skills read, branch created from `9f617f3`.
- `ee564e9` — the counter and the path that feeds it.
  - `recordSurveySubmissionDelivery` in
    `src/lib/server/ai-operational-metrics.ts`, emitting
    `survey_submission_recovered_by_retry` or
    `survey_submission_lost_after_retries` with the attempt count as a label.
    That file rather than a new one: it already carries
    `duplicate_submission_conflicts`, which is not an AI metric either, and it
    owns the sink both families share.
  - `POST /api/survey/{shareCode}/delivery` — reads no repository, answers
    `204` to everything including a share code that does not exist, and refuses
    `attempts < 2`, a non-integer, anything above 10 and any other outcome word.
  - `src/lib/survey-delivery-report.ts` — the client half, `keepalive: true`,
    every failure swallowed, and a no-op below two attempts.
  - `survey-flow.tsx` counts attempts through the `onRetry(attempt)` callback
    the retry module already had, and reports on both exits of `handleSubmit`.
  - `RATE_LIMITS.surveyDeliveryReport` — its own bucket, so a flood of reports
    can never refuse a real submission.
  - `docs/openapi.yaml` plus the generated `public/openapi.json`.
- `f18bfeb` — the browser half. `e2e/submit-retry-is-recorded.spec.ts` aborts
  the first submit and walks the whole questionnaire to the thank-you screen;
  `e2e/respondent-answers.spec.ts` gained the opposite assertion, that an
  ordinary submission fires no beacon at all. The shared walk moved to
  `e2e/respondent-walk.ts`.

## In progress

- Nothing.

## Remaining

- The push. Nothing else on this branch.

## Changed files

Committed in the two commits above:

- `src/lib/server/ai-operational-metrics.ts`, `src/lib/server/rate-limit.ts`,
  `src/app/api/survey/[shareCode]/delivery/route.ts`,
  `src/lib/survey-delivery-report.ts`,
  `src/components/survey/survey-flow.tsx`.
- `src/lib/__tests__/survey-delivery-report.test.ts`,
  `src/app/api/__tests__/survey-delivery-report.test.ts`,
  `e2e/respondent-walk.ts`, `e2e/submit-retry-is-recorded.spec.ts`,
  `e2e/respondent-answers.spec.ts`.
- `docs/openapi.yaml`, `public/openapi.json`.

Unstaged and deliberately not committed: `next-env.d.ts`, whose single line
flips between `./.next/dev/types/routes.d.ts` and `./.next/types/routes.d.ts`
depending on whether `next dev` or `next build` ran last. This session ran
builds. It is a generated artifact of the toolchain, not part of this change.

No schema, no migration, no contract manifest and nothing across the Core/AI
boundary.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0, captured rather than inferred. 1044 tests
  pass, 0 fail, and every gate inside it green: `lint:literals`,
  `lint:interpreter`, `lint:composition`, `lint:fixtures`, `lint:skills`,
  `lint:mutation-config`, `lint:contract-refusals`, `lint:fonts`, `typecheck`,
  `npm test`, `lint`, `build`.
- `npx tsx --test src/app/api/__tests__/openapi.test.ts` — 8 pass after
  `npm run openapi:generate`, so `public/openapi.json` is the generated
  artifact of the edited YAML and not hand-written drift.
- `npm run test:e2e` — 19 passed, up from 18. Both halves of the new behaviour
  are in there: the aborted-first-submit walk and the ordinary walk that must
  fire no beacon, the latter under the phone project as well.
- **Falsification of the new spec.** With the `recovered` report removed from
  `survey-flow.tsx`, `e2e/submit-retry-is-recorded.spec.ts` fails on
  `page.waitForRequest` after 30s. The file was restored and the suite re-run
  green, so the test is known to be watching something.
- **The line was read, not assumed.** Against a production build on port 3210,
  four POSTs to `/api/survey/SHALOM-LOCAL/delivery` — `recovered/2`, `lost/3`,
  `recovered/1` and `bogus/2` — all answered `204`, and the server printed
  exactly two lines:
  `{"observability":"shalomut_operational_metric","name":"survey_submission_recovered_by_retry",...,"labels":{"attempts":"2"}}`
  and the `lost` one at `attempts: 3`. The first-attempt report and the
  malformed one emitted nothing, which is the refusal working rather than the
  route being silent.

### Failed

- None.

### Blocked or not run

- The deployed endpoint. Nothing here has been deployed, and this branch is not
  on `origin`.
- Python suite and mutation run: not run, and not selected by the matrix —
  nothing in the diff touches `ai-analytics-service/`, a versioned manifest or
  a mutated file.
- The real failure. The counter has never counted the defect it was built for,
  because that defect only happens on the deployed endpoint and only after an
  idle period. The aborted request in the e2e reproduces its *shape*, not its
  cause.

### Environment

- Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`,
  local Postgres in `shalomut-local-db`, production build on port 3210 and the
  Playwright server on 3100.
- The e2e run stored two more anonymous responses in the seeded local round, as
  `respondent-answers.spec.ts` already did every run. Local database, disposable
  by `AGENTS.md`.

### Residual risk

- The `lost` counter is a floor, not a count: its report travels over the
  connection that just failed three times. `recovered` has no such problem —
  the retry it reports on had just succeeded.
- Nothing collects these lines. They go to `console.info` like every other
  operational metric in the product, and where that log lands is an open owner
  decision that predates this branch.

## Failed approaches

- None.

## Known risks

- The lost-submit report travels over the same connection that just failed
  three times, so the counter reads as a floor rather than as a count.

## Approval gates

- None triggered. No secrets, credentials, aliases or migrations touched.

## Questions requiring an owner decision

- Where these lines land is already an open owner decision in the handoff: the
  product logs structured observability and nothing collects it. This branch
  adds a family to that log; it does not answer where the log goes.

## Next concrete step

Push this branch onto `main` — `git push origin
feat/a-lost-submit-leaves-a-trace:main` — which carries `9f617f3` under it, the
session-closing documentation commit of `fix/the-first-submit-after-idle` that
never reached the remote. The agent's `git push` is declined by the permission
layer here, so this is the owner's own command.
