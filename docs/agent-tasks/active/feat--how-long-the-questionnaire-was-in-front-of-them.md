# How long the questionnaire was in front of them

## Metadata

- Branch: `feat/how-long-the-questionnaire-was-in-front-of-them`
- Base branch: `feat/the-round-says-how-it-was-filled` (task C), at `a3080fa`
- Base commit: `a3080fa`
- Current HEAD: `a3080fa`
- Status: opened and scoped, not started
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

Nothing yet.

## In progress

Nothing.

## Remaining

Everything in Scope.

## Changed files

- `docs/agent-tasks/active/feat--how-long-the-questionnaire-was-in-front-of-them.md`
  (new, this file)

`next-env.d.ts` carries a pre-existing unstaged modification that predates this
branch and is not part of this task.

## Verification evidence

### Passed

None for this branch yet.

### Failed

None.

### Blocked or not run

Everything. No code has changed.

### Environment

Local worktree only. Nothing deployed, no database read or written.

### Residual risk

None yet — no code has changed.

## Failed approaches

None yet.

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

Write the visible-time accumulator with its tests, before anything that stores
its output, so that the one thing this task adds to a respondent's record is the
first thing that has to be right.
