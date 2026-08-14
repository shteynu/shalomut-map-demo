# Phase 1 — an answer model that can hold the research instrument

## Metadata

- Branch: `claude/answer-model-for-research-instrument`
- Base branch: `main`
- Base commit: `eeb8a82` (the plan commit, on `claude/default-research-instrument-plan`)
- Current HEAD: `18be004`
- Status: implementation complete and verified; one commit landed, the rest staged for commit in this session
- Last updated: 2026-08-14
- Last agent/tool: Claude Code (Opus 5)

## Objective

Phase 1 of `docs/default-research-instrument-plan-2026-08-14.md`: make the
answer model able to carry the research instrument's answers — five- and
seven-point Likert steps, reverse-scored items, demographic choices and
allocation grids — **without changing what any existing round means**.

This phase moves no questionnaire and shows the respondent nothing new. It
widens the shapes the rest of the phases need.

## User-visible outcome

None, deliberately. Every existing round validates, scores and aggregates
exactly as before; the same answers produce the same dimension scores and the
same AI snapshot hash.

## Context

The canonical 24 questions all share one answer scale (the three-colour
wellbeing scale, 100/60/0) and all carry a dimension. The research instrument
has 126 items: 16 demographic, 2 allocation grids, 108 Likert on two different
step counts, some of them reverse-scored. Three things in the existing model
made that impossible to store:

1. the scale was a property of the product, not of the question;
2. every question was assumed to have a `dimensionId`, and every answer a
   `score` — both `NOT NULL` in the database;
3. `SurveyQuestion` was one flat interface, so nothing forced a caller to say
   which kind of question it was holding.

## Scope

- Answer scales as data, with normalisation to 0–100 and polarity.
- A discriminated union over question kind (`analytic` | `background`).
- Per-kind parsing, validation and scoring.
- Nullable `dimension_id` and `score` on `question_answers`.
- A backfill that writes the implicit canonical snapshot onto rounds that
  have none.

## Non-goals

- The respondent UI for the new answer types (phase 3).
- The builder UI for background questions (phase 4).
- k-anonymity over demographics (phase 2).
- AI contract `7.0` (phase 5).
- Removing the `surveyInstrument.questions` default parameter — see
  *Remaining*.

## Acceptance criteria

- A legacy definition, parsed, is indistinguishable in behaviour from before.
- A Likert answer in either polarity normalises to the documented 0–100 step.
- An allocation grid that does not total exactly 100 is refused; a grid left
  entirely unanswered is allowed.
- A background answer stores and reads back with **no** dimension and **no**
  score — `undefined`, not `null`.
- Background questions never change the AI-visible snapshot hash.

## Relevant repository instructions

- `AGENTS.md` — branch-scoped task state, mandatory progress handoff.
- `.agents/skills/shalomut-verification/SKILL.md` — the schema changed, so
  `verify:db` is in scope, not only `npm test`.

## Relevant architecture and contracts

- ADR-004 (`PROJECT_CONTEXT.md`) — dynamic questionnaire, fixed eight-dimension
  taxonomy. Background questions sit outside the taxonomy by construction: they
  are filtered out before any dimension aggregation.
- `contracts/ai-analytics-v6.json` — `metricCoverage: "exactly every input
  question aggregate"`. Unchanged here, because the AI still sees only analytic
  questions.

## Decisions made

- **A scale is a property of the question.** `src/lib/survey/answer-scales.ts`
  holds the four scales as data; the colour scale is derived from the existing
  `responseScale` so 100/60/0 keeps one home.
- **Polarity, not a second scale.** A reverse-scored item uses the same scale
  and scores as `100 - point.score`. Two scales that differ only in direction
  would drift.
- **An allocation grid is N questions sharing an `allocationGroupId`**, not one
  question with N answers. This keeps one stored row per question and leaves the
  `(response_id, question_id)` uniqueness key untouched.
- **A missing `kind` parses as `analytic`.** `parseQuestionKind` defaults
  `kind` to `"analytic"`, `scaleId` to `"wellbeing-colour"` and `polarity` to
  `"positive"`. This is what makes the change need no definition migration: no
  round mid-collection changes meaning.
- **`answerMode` left the analytic shape entirely.** It was hardcoded to
  `"סקאלת צבעים"` at all three builder sites and editable at none, so no manager
  data is lost.
- **A discriminated union, on purpose.** Introducing it produced 109 type
  errors — every place that had assumed a question has a dimension. That was the
  point: each one is a site phase 3 or 4 would otherwise have found at runtime.

## Assumptions

- The mapping of the 108 Likert items to the eight dimensions, and which are
  reverse-scored, comes from the owner/methodologist (owner decision,
  2026-08-14). Phase 1 needs only that *polarity exists*, not the table itself,
  which is why it could proceed while the table is outstanding.

## Completed

- `src/lib/survey/answer-scales.ts` — four scales as data, `scoreForAnswer`
  with polarity. Five-point steps `[0,25,50,75,100]`, seven-point
  `[0,17,33,50,67,83,100]`.
- `src/lib/types/backend.ts` — `AnalyticSurveyQuestion` |
  `BackgroundSurveyQuestion`, `isAnalyticQuestion`, and `score`/`dimensionId`
  made optional on the answer records.
- `src/lib/survey-definition.ts` — per-kind parsing with the legacy default,
  `parseOptions`, `validateAllocationGroups` (a grid of one row is refused),
  per-kind snapshot comparison, `isActivatableSurveyDefinition` filtered to
  analytic.
- `src/lib/services/survey.service.ts` — `validateAnswerValue`,
  `validateAllocationTotals`, `scoreForQuestionAnswer`. `valueToScore` kept for
  the legacy 2.0 path.
- `src/lib/services/analytics.service.ts` and
  `src/lib/survey-definition-hash.ts` — analytic-only filtering, so a
  background question cannot change an aggregate or a snapshot identity.
- `src/components/survey/survey-flow.tsx` — a latent defect removed: an answer
  with no dimension was being labelled `"self-expression"`.
- `prisma/schema.prisma` + migration
  `20260814120000_answers_may_have_no_dimension_or_score` — two `DROP NOT NULL`
  statements. Widening only; nothing existing becomes invalid.
- `scripts/backfill-round-definitions.ts` — idempotent, dry-run by default.
- `docs/openapi.yaml` and the regenerated `public/openapi.json` —
  `QuestionAnswerInput.value` widened from the `WellbeingStatus` enum to a
  described string; `dimensionId` no longer required.

### Two real defects the new tests found

- **`prisma-survey.repository.ts`**: `mapToDomain` passed a database `NULL`
  through as JavaScript `null` while the domain type says the field is absent. A
  `null` compares unequal to `undefined` and arithmetic reads it as zero — it
  would have appeared as a `0` inside a dimension average. Fixed by spreading
  the two fields conditionally; `postgres-answer-shapes.test.ts` pins it.
- **`scripts/backfill-round-definitions.ts`**, found by running it: on a
  nullable `Json` column, `{ equals: null }` matches nothing — Prisma needs
  `Prisma.DbNull`. The script had printed "✅ Every round already carries a
  questionnaire snapshot" while a round with a NULL column sat in front of it.

## In progress

Nothing. The working tree holds finished, verified work awaiting its commit.

## Remaining

- **Deferred out of this phase:** removing the `surveyInstrument.questions`
  default parameter in `SurveyService` and `AnalyticsService`. It is only safe
  once the backfill has actually run against **both** databases, and the
  deployed run is an owner action. Until then the fallback stays and is
  harmless.
- Phases 2–6 per `docs/default-research-instrument-plan-2026-08-14.md`.
  Phases 3 and 5 are blocked on the mapping table.

## Changed files

Committed as `18be004`:

- `src/lib/survey/answer-scales.ts` (new)
- `src/lib/survey/__tests__/answer-scales.test.ts` (new, 15 tests)

Uncommitted at the time of writing — modified: `prisma/schema.prisma`,
`docs/openapi.yaml`, `public/openapi.json`, `scripts/verify-db.mjs`,
`src/lib/types/backend.ts`, `src/lib/survey-definition.ts`,
`src/lib/survey-definition-hash.ts`, `src/lib/survey-draft-storage.ts`,
`src/lib/services/survey.service.ts`, `src/lib/services/analytics.service.ts`,
`src/lib/repositories/prisma/prisma-survey.repository.ts`,
`src/lib/server/verify-ai-result.ts`, `src/components/survey/survey-flow.tsx`,
`src/components/survey/survey-builder.tsx`,
`src/components/survey/survey-builder/types.ts`,
`src/components/survey/survey-builder/survey-question-card.tsx`, plus the test
files those shapes touch. New: the migration directory,
`scripts/backfill-round-definitions.ts`,
`src/lib/survey/__tests__/question-kinds.test.ts` (20 tests),
`src/lib/repositories/__dbtests__/postgres-answer-shapes.test.ts` (4 tests).

`.idea/shalomut-map-demo.iml` is a pre-existing user modification and stays
unstaged.

## Verification evidence

### Passed

- `npm run typecheck` — exit 0.
- `npm test` — 942 pass, 0 fail, 8 suites.
- `npm run lint` — clean.
- `npm run build` — succeeded, 42 static pages.
- `npm run verify:db` — 36 pass, 0 fail, against the local PostgreSQL
  container after `npm run db:migrate:deploy`.
- `npm run openapi:check`, `lint:skills`, `lint:literals`, `lint:fixtures`,
  `lint:composition`, `lint:contract-refusals` — all OK.
- **Backfill proven end to end** on a real local round with a NULL snapshot:
  the dry run listed it, `--confirm` reported `Wrote a snapshot onto 1 of 1
  rounds`, a re-run changed nothing, and the stored snapshot read back as
  `title: סבב ללא שאלון | threshold: 12 | questions: 24` — the round's *own*
  title and threshold, not the defaults.
- **Falsification**: two load-bearing tests were deliberately broken in the
  source — the legacy polarity default, and the polarity complement — and each
  test failed as it should before the code was restored.

### Failed

None.

### Blocked or not run

- The backfill against the deployed database: an owner action. Nothing in this
  phase depends on it; the fallback removal in a later phase does.
- No browser walkthrough: this phase changes no rendered screen.

### Environment

Local only. PostgreSQL container `shalomut-local-db` on `127.0.0.1:5433`
(`docs/local-environment.md`). No deployed write of any kind.

### Residual risk

Low. Every widening is backward-compatible by construction: the schema change
only drops `NOT NULL`, and the parser defaults a missing `kind` to the legacy
shape. The one place a mistake would be silent — a `null` reaching a dimension
average — is the defect found above, and it is now pinned by a database test.

## Failed approaches

- A compound predicate `(q) => q.enabled && isAnalyticQuestion(q)` does not
  narrow the resulting array type. Chained `.filter((q) => q.enabled)
  .filter(isAnalyticQuestion)` does.
- `isAnalyticQuestion` imported with `import type` fails as TS1361 — a type
  guard is a value.

## Known risks

- `next-env.d.ts` churns between `.next/dev/types` and `.next/types` depending
  on whether `typecheck` or `build` ran last. Revert it rather than commit it.

## Approval gates

- `git push` is an owner action.
- Running the backfill against the deployed database is an owner action.

## Questions requiring an owner decision

- The mapping table: the 108 Likert items → the eight dimensions, and which are
  reverse-scored. Recorded as an external blocker in
  `docs/shalomut-tracker-handoff.md`. Phases 3 and 5 cannot start without it.

## Next concrete step

Owner: `git push origin claude/answer-model-for-research-instrument`. Then
either supply the mapping table to unblock phases 3 and 5, or say to start
phase 2 (k-anonymity over demographics), which depends only on phase 1.
