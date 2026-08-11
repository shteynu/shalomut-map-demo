# The time estimate follows the questionnaire

## Metadata

- Branch: `feat/the-time-estimate-follows-the-questionnaire`
- Base branch: `main`
- Base commit: `55e64ca`
- Current HEAD: `9d61916`, which is also `origin/main`
- Status: done and landed on `main`
- Last updated: 2026-08-11
- Last agent/tool: Claude Opus 5, Claude Code

## Objective

Cheap win 2 in `docs/product-strategy-axes-2026-08-10.md`: derive
`estimatedMinutes` from the question count instead of a typed number.

## User-visible outcome

The consent screen's `N שאלות, כ־M דקות` computes both numbers from the same
list of questions, so it cannot promise the minutes of a questionnaire this
respondent is not being given. In the builder the estimate is read-only and
follows the enabled questions, with a note saying so.

## Context

Half of this item was already done: `estimateMinutesForQuestions` exists and
`createCanonicalSurveyDefinition` uses it, so a canonical definition no longer
carries the hardcoded 15. What remained was every path that could still drift:
the builder let a manager type a number that then stopped following the
questions, and the respondent screen printed whatever the definition had stored
next to a question count it computed itself.

## Scope

- The builder's `estimatedMinutes` becomes derived state.
- The settings field becomes read-only, following the `קהל יעד` precedent in
  the same grid.
- `SurveyFlow` derives the estimate from the questions it was handed; the prop
  and the answer page's pass-through are gone.

## Non-goals

- `SurveyDefinition.estimatedMinutes` stays in the type, the validator and the
  persisted record. It is written by the builder from the derived value; what
  changed is that no screen depends on it being right.
- `SECONDS_PER_QUESTION` is unchanged at ten.

## Acceptance criteria

- The two numbers in the consent sentence come from one list.
- The builder's estimate cannot be typed over and says where it comes from.
- A shorter questionnaire shows a shorter estimate.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md`: respondent-facing copy is the
  product's word; reuse existing patterns and tokens.
- `.agents/skills/shalomut-verification/SKILL.md`: component changes need
  targeted tests, `npm run lint`, `npm run build`, browser smoke.

## Decisions made

- Read-only rather than a recompute-on-change default: an editable field that
  silently overwrites what the manager typed is worse than one that never
  invited typing.
- Derived inside `SurveyFlow` rather than at the page, so the component cannot
  be called with an estimate that disagrees with its own questions.

## Assumptions

- Ten seconds an item remains the right model; it is documented beside
  `SECONDS_PER_QUESTION` and unchanged here.

## Completed

- `src/components/survey/survey-builder.tsx` — derived state, no setter.
- `src/components/survey/survey-builder/survey-builder-settings.tsx` — the
  read-only field and its note.
- `src/components/survey/survey-flow.tsx` — derives, prop removed.
- `src/app/answer/[shareCode]/page.tsx` — stops passing the stored value.
- `src/components/survey/__tests__/builder-time-estimate.test.tsx` — new.
- `src/components/survey/__tests__/survey-flow-server-render.test.tsx` — the
  existing consent-size test now asserts the derived minute.

## In progress

Nothing.

## Remaining

Nothing.

## Changed files

- `src/components/survey/survey-builder.tsx`
- `src/components/survey/survey-builder/survey-builder-settings.tsx`
- `src/components/survey/survey-flow.tsx`
- `src/app/answer/[shareCode]/page.tsx`
- `src/components/survey/__tests__/builder-time-estimate.test.tsx` (new)
- `src/components/survey/__tests__/survey-flow-server-render.test.tsx`
- `docs/agent-tasks/active/feat--the-time-estimate-follows-the-questionnaire.md` (this file)

## Verification evidence

### Passed

- `npx tsx --test` on the new builder tests — 3/3.
- `npm test` — 872 pass, 0 fail.
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeded.
- Browser walk on a local production build (`next start` on port 3210, the
  `playwright.config.ts` throwaway fixtures, a temporary Playwright script
  since removed):
  - `/answer/SHALOM-LOCAL/` consent screen reads `24 שאלות, כ־4 דקות.`;
  - the builder's `זמן מילוי משוער` shows `4` and reports `readOnly: true`.

### Failed

None.

### Blocked or not run

- Watching the number move on screen as questions are enabled or disabled. The
  only local round has twelve answers, so its questionnaire is frozen and the
  bulk enable/disable buttons are disabled by design; an attempt to open a
  fresh round through the setup form did not go through in the script, and I
  stopped rather than spend more on it. The movement is covered by
  `builder-time-estimate.test.tsx` and by `estimateMinutesForQuestions`'s own
  tests, not by a screenshot.
- Deployed verification. Not run: no server or contract change.

### Environment

local

### Residual risk

Low, with one behaviour change worth naming: a legacy definition that stored a
hand-typed estimate now displays and re-saves the derived one. That is the
intended correction, and it is the only way a saved number changes without the
manager editing anything.

## Failed approaches

Driving the setup form to open a fresh round from Playwright: the submit click
produced no `/api/manager/setup` request, so no round was created. Not
diagnosed — the evidence it would have added was a screenshot of a number the
tests already assert.

## Known risks

None open.

## Approval gates

None.

## Questions requiring an owner decision

None.

## Next concrete step

None. The owner pushed `9d61916` onto `main` on 2026-08-11 and this file was
archived.
