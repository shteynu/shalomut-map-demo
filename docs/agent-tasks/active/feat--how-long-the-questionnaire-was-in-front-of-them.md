# How long the questionnaire was in front of them

## Metadata

- Branch: `feat/how-long-the-questionnaire-was-in-front-of-them`
- Base branch: `feat/the-round-says-how-it-was-filled` (task C), at `a3080fa`
- Base commit: `a3080fa`
- Current HEAD: `b326615` (the task file only; the work below is uncommitted)
- Status: implemented and verified locally, uncommitted
- Last updated: 2026-08-17
- Last agent/tool: Claude Code (Opus 5)

## Objective

Measure how long a respondent actually had the questionnaire in front of them,
store it as one aggregate on the response, and let the round's filling report use
it in place of the session lifetime it uses today.

## User-visible outcome

The round screen stops reporting an upper bound where it can report a
measurement. A questionnaire left open in a background tab no longer inflates
the round's middle value, and the fast count stops missing someone who answered
in ninety seconds spread over an afternoon.

## Context

Task D of
[`response-quality-plan-2026-08-17.md`](../../response-quality-plan-2026-08-17.md),
which recommends **not** building it, and says so as an owner decision rather
than an engineering one. The owner asked for it on 2026-08-17 after being told
the plan argues against it.

The plan's argument was that per-step timing is new personal data collected from
respondents whose only justification was exclusion — a feature that is not being
built. That argument holds against the shape the plan described and not against
the shape here; see Decisions made, 1.

Stacked on task C, which is pushed at `a3080fa` and not on `main`. `origin/main`
is still `8231490`; tasks A, B and C are all pushed branches that have not
landed.

## Scope

- A pure accumulator that measures visible time, with tests.
- The respondent client running it, pausing it, and persisting it across a
  restored draft.
- One aggregate field on `survey_responses`, its migration, and the schema
  comment at `prisma/schema.prisma:155` that currently promises no timing.
- Strict validation on the public submit endpoint, in the style already there.
- `RoundFillingService` preferring it, and counting how many responses had it.
- The panel saying which measure it used.
- The consent copy, and a note that the wording is the owner's to approve.
- `docs/openapi.yaml` and `npm run openapi:generate`.

## Non-goals

- **No per-step array leaves the browser and none is stored.** See Decisions
  made, 1.
- No exclusion, and nothing here changes what ADR-022 forbids.
- No re-scoring, no change to `score`, no AI contract change.
- No backfill. A response stored before this exists has no active time and is
  reported on the measure it does have.

## Acceptance criteria

- A questionnaire in a hidden tab does not accumulate time, and a test proves
  the accumulator ignores hidden intervals.
- A restored draft either carries its accumulated time or the attempt reports
  none — never a number that silently undercounts.
- The public endpoint refuses anything that is not a plausible duration, and a
  refusal costs the respondent nothing.
- The report says how many of its measured responses were measured precisely.
- `npm run verify:core` passes.

## Relevant repository instructions

- `AGENTS.md` — privacy is a product invariant; approval is required before
  changing credentials or aliases, which this does not touch.
- `.agents/skills/shalomut-map/SKILL.md` — the public respondent endpoint
  validates strictly and refuses rather than coerces.
- `.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

- `SurveyDraftV1` is versioned and `parseSurveyDraft` rejects an unknown
  version, so a bump discards every draft a respondent is mid-way through.
- The attempt beacon endpoint is the model for validating an unauthenticated
  body: refuse rather than coerce, and answer the same way either way.
- `RoundFillingService` and `filling-duration.ts` from task B own what may be
  published; this task changes the input to them, not the rules.

## Decisions made

1. **One clock, not per-step durations.** The plan asked for per-step timing and
   for an aggregate to be stored from it — which means the per-step values would
   be collected and then discarded server-side. Collecting data in order to
   throw it away is the worst version of this feature, so the client accumulates
   a single number and no per-step value ever leaves the browser. This is
   strictly less respondent data than the plan's shape and answers the plan's own
   objection to it.
2. **Visible time, not elapsed time.** The clock runs only while the document is
   visible and the respondent is in the questions phase. That is the whole point:
   the session lifetime task B measures is already the elapsed version.
3. **A restored draft that carries no accumulated time voids the measurement for
   that attempt.** Resuming from zero would undercount, and undercounting is the
   dangerous direction — it makes an attentive respondent look fast. The field is
   optional inside schema version 1 rather than a version bump, because bumping
   throws away the answers of everyone currently mid-questionnaire.
4. **Mixing the two measures in one report is sound for the fast count and
   stated for the median.** Session lifetime is always at least the active time,
   so a response flagged fast on the lifetime is fast on either measure — the
   count never over-reports. The median mixes two quantities, so the panel says
   how many were measured precisely.

## Assumptions

- The consent copy needs the owner's approval. This task drafts it and flags it;
  it does not treat a drafted sentence as an approved one.

## Completed

Everything in Scope.

- **The accumulator.** `src/lib/survey/visible-time.ts` — `createVisibleTimeClock`
  banks closed intervals and reports `elapsed` for an open one, caps a single
  interval at two hours and the total at twelve, and refuses a sub-second total
  at the submission boundary rather than reporting it as the fastest filling in
  the round. Fourteen tests.
- **The client.** `survey-flow.tsx` builds the clock while the restored draft is
  read, drives it from `visibilitychange` and `pagehide`, banks on cleanup, writes
  the running total into the draft on every flush, and computes `visibleSeconds`
  once before the first send so a retry cannot report a longer filling than the
  first attempt did.
- **The store.** `visibleMs` is optional inside `SurveyDraftV1` — not a version
  bump, which would discard every draft a respondent is mid-way through — and is
  read but never repaired.
- **The column.** `visible_seconds INTEGER NULL` on `survey_responses` with
  `survey_responses_visible_seconds_check`, plus the repository mapping, the two
  backend types, and the service carrying it without validating.
- **The endpoint.** `readVisibleSeconds` drops rather than refuses, and never
  coerces. The answers are what the respondent came to send.
- **The report.** `RoundFillingService` reads the response's own measurement
  first — it needs no attempt row and no token — and publishes
  `measuredPrecisely` beside the median.
- **The panel.** The head describes both measures and calls them upper bounds; a
  note appears only when the mix is not pure, in two forms for "none of them" and
  "some of them".
- **The disclosure.** A second promise on the consent screen states the
  measurement and the limit that makes it bearable. **Drafted, not approved — see
  Approval gates.**
- `docs/openapi.yaml` and the generated `public/openapi.json`.

## In progress

Nothing.

## Remaining

Push, which is the owner's. Then land the four stacked branches in order.

## Changed files

Committed on this branch:

- `docs/agent-tasks/active/feat--how-long-the-questionnaire-was-in-front-of-them.md`
  at `b326615`

Modified, uncommitted:

- `PROGRESS.md`, `PROJECT_CONTEXT.md` (ADR-022 amended),
  `docs/source-of-truth.md`, `docs/data-flow-and-subprocessors.md`,
  `docs/openapi.yaml`, `public/openapi.json`
- `prisma/schema.prisma`
- `src/app/api/survey/[shareCode]/submit/route.ts`
- `src/components/round/round-filling.tsx` and its test
- `src/components/survey/survey-consent-step.tsx` and
  `src/components/survey/__tests__/consent-promises.test.tsx`
- `src/components/survey/survey-flow.tsx`
- `src/lib/repositories/prisma/prisma-survey.repository.ts`
- `src/lib/services/round-filling.service.ts` and its test
- `src/lib/services/survey.service.ts`
- `src/lib/survey-draft-storage.ts`
- `src/lib/types/backend.ts`

Untracked:

- `prisma/migrations/20260817170000_a_response_may_carry_its_visible_seconds/migration.sql`
- `src/lib/survey/visible-time.ts` and `src/lib/survey/__tests__/visible-time.test.ts`

`next-env.d.ts` carries a pre-existing unstaged modification that predates this
branch and is not part of this task. It is left alone.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0. 1142 Node tests pass, 484 Python tests pass,
  ESLint clean, `next build` completes.
- New tests: 14 in `visible-time.test.ts`, 4 added to
  `round-filling.service.test.ts` (17 total), 3 added to `round-filling.test.tsx`
  (17 total), 2 added to `consent-promises.test.tsx` (5 total).
- **The migration was applied to the local database** with `npx prisma migrate
  deploy`, and the constraint was then probed directly with `pg`:
  `NULL`, `1` and `43200` are accepted; `0`, `-5` and `43201` are refused by
  `survey_responses_visible_seconds_check`. The database refuses exactly what the
  route drops.
- **Browser evidence.** The panel was rendered in isolation against the built
  stylesheet, RTL at 800px, in three states — 8 of 20 measured precisely, all 20
  measured with a withheld fast count, and none measured with three unmeasured
  responses. All three read correctly; `פחות מ־3` does not invert, and the mixed
  note appears only where it should. The consent screen was rendered the same way
  and the timing line sits second, below the "no identifying detail" promise.

### Failed

None outstanding. Two lint refusals were hit and fixed — see Failed approaches.

### Blocked or not run

- Playwright e2e. Not part of `verify:core`, and nothing here changes a route
  contract an e2e asserts on.
- A signed-in walk of `/round` in a real browser. The manager screens are behind
  `/login`, and typing a password is prohibited; the isolated render above is the
  substitute, and it is what found the RTL defects on task C.
- Anything deployed. The migration is applied locally only.

### Environment

Local worktree, local Docker PostgreSQL on `127.0.0.1:5433`. Nothing deployed,
nothing on Supabase, no AI provider call.

### Residual risk

- **The deployed database does not have this column.** The migration is applied
  locally only, and it must be applied before this code runs anywhere else — a
  Prisma client writing `visible_seconds` against a schema without it fails the
  write, which is the respondent's submission.
- The clock trusts `performance.now()` and the visibility events. A browser that
  fires neither reports the whole phase as visible, which is the same upper bound
  the session lifetime already was.
- The two-hour interval cap silently truncates a genuinely long single sitting.
  That is the deliberate direction: it can only shorten a reported filling, and
  the report only claims the short side.

## Failed approaches

- **Creating the clock in an effect.** `react-hooks/set-state-in-effect` refuses
  the `setVisibleTimeVoid` that has to accompany it.
- **Creating it during render into a `useRef`.** `react-hooks/refs` refuses
  writing `.current` during render, even under the lazy-initialisation guard.
- What works is holding the clock in state and setting it inside the existing
  render-phase seeding block, which is already where the draft is read. It is
  also more correct than the ref was: the visibility effect now depends on the
  clock, so it attaches on the commit that produces it rather than on whichever
  commit happens to follow.

## Known risks

- **This branch and task A's both edit `src/app/api/survey/[shareCode]/submit/route.ts`.**
  Task A removes the analytics enqueue from it; this task adds a validated field
  to the same handler. Whichever lands second will conflict there, and the
  resolution is mechanical but must not resurrect the enqueue.
- The consent screen is what a respondent reads before agreeing. A drafted
  sentence that ships unapproved is a promise the product made without its owner.

## Approval gates

- **The consent copy is the owner's to approve** before this reaches a real
  respondent. Nothing else here touches secrets, credentials, authentication
  configuration or a deployment alias.

## Questions requiring an owner decision

- The consent wording.

## Next concrete step

Push this branch — `git push origin feat/how-long-the-questionnaire-was-in-front-of-them`
— which is the owner's to run, and get the consent wording approved before any
of the four stacked branches reaches a respondent.
