# The end date stops claiming to close the round

## Metadata

- Branch: `feat/the-end-date-stops-claiming-to-close-the-round`
- Base branch: `main`
- Base commit: `3e08530`
- Current HEAD: one commit on top of `3e08530`
- Status: implementation complete, verified locally, waiting on the owner's push
- Last updated: 2026-08-11
- Last agent/tool: Claude Opus 5, Claude Code

## Objective

Axis 4 in `docs/product-strategy-axes-2026-08-10.md`: `endDate` is collected,
stored and displayed as `סגירה / סיום איסוף מתוכנן`, and is read by no rule —
nothing closes, nothing warns, and the round keeps accepting answers while the
screen says collection ended. The owner's decision for this task was to stop
the screen lying, not to make the date close anything.

## User-visible outcome

The round screen's second card is labelled `סיום מתוכנן` rather than `סגירה`,
and its helper says what the date actually is:

- no date — `לא נקבע תאריך יעד. הסבב נסגר ידנית ממסך זה.`
- a future date — `תאריך יעד בלבד — הסבב אינו נסגר מעצמו כשהוא מגיע.`
- a date that has passed on a round still collecting —
  `התאריך עבר והסבב עדיין אוסף תשובות. הסגירה היא ידנית.`
- a round no longer collecting — `תאריך היעד שנקבע לסבב.`

The setup screen's field is `תאריך סיום מתוכנן` and carries a note saying the
date does not close the round, and why closing is manual.

## Scope

- `describePlannedEnd` and its tests.
- The round screen's card, the setup screen's label and note.

## Non-goals

- Making the date close a round. That is a product decision with consequences
  for a respondent mid-questionnaire, and the owner explicitly scoped this task
  to the claim rather than the behaviour.
- Any reminder, warning or automation attached to the date.
- The stored field, the API and the form payload, all unchanged.

## Acceptance criteria

- No screen calls the date a closing.
- A passed date on a collecting round says so out loud.
- "Passed" is judged in the school's own day, not the server's.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md`: RTL-first, WCAG AA, the product's
  words are its terms.
- `.agents/skills/shalomut-verification/SKILL.md`: component and page changes
  need targeted tests, `npm run lint`, `npm run build` and a browser smoke.

## Decisions made

- The judgement lives in a pure function taking `now`, so the boundary case is
  testable rather than dependent on when the suite runs.
- `Asia/Jerusalem` for the comparison, following `save-status.tsx`: a round
  ending today would otherwise read as overdue from 2am local time.
- A `draft` round counts as collecting for this purpose — it has not finished,
  so a passed date is still a date that passed.

## Assumptions

- Manual closing from the round screen remains the only way a round closes;
  the helper points at the button that is on the same screen.

## Completed

- `src/lib/rounds/planned-end.ts` — new.
- `src/lib/rounds/__tests__/planned-end.test.ts` — new, 6 tests.
- `src/app/round/page.tsx` — the card takes its label and helper from it.
- `src/components/round/setup-form.tsx` — renamed field and its note.

## In progress

Nothing.

## Remaining

The push. `git push origin feat/the-end-date-stops-claiming-to-close-the-round:main`
is the owner's command.

## Changed files

- `src/lib/rounds/planned-end.ts` (new)
- `src/lib/rounds/__tests__/planned-end.test.ts` (new)
- `src/app/round/page.tsx`
- `src/components/round/setup-form.tsx`
- `docs/agent-tasks/active/feat--the-end-date-stops-claiming-to-close-the-round.md` (this file)

## Verification evidence

### Passed

- `npx tsx --test src/lib/rounds/__tests__/planned-end.test.ts` — 6/6.
- `npm test` — 878 pass, 0 fail.
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeded.
- Browser walk on a local production build (`next start` on port 3210, the
  `playwright.config.ts` throwaway fixtures, a temporary Playwright script
  since removed). All three states reached by editing the date through the
  setup screen itself:
  - no date — `לא נקבע | סיום מתוכנן | לא נקבע תאריך יעד. הסבב נסגר ידנית ממסך זה.`
  - `04.08.2026` on an active round — `התאריך עבר והסבב עדיין אוסף תשובות. הסגירה היא ידנית.`
  - `31.12.2026` — `תאריך יעד בלבד — הסבב אינו נסגר מעצמו כשהוא מגיע.`
  - the setup note renders and the field is described by it.
  The screenshot also shows the helper's claim is checkable on the same screen:
  `סגירת סבב אבחון ידנית` sits directly below the card.

### Failed

None.

### Blocked or not run

- The `closed` and `archived` wording was covered by tests, not by the browser:
  reaching it would mean closing the only local round.
- Deployed verification. Not run: no server or contract change, and the
  deployed database has no round.

### Environment

local. The walk left the seeded round with `endDate = 2026-12-31`, which the
seed does not set. Disposable; `npx tsx scripts/seed-local.ts --reset` clears it.

### Residual risk

Low. The change is copy plus one pure function; the stored data, the API and
the form payload are untouched.

## Failed approaches

None.

## Known risks

None open.

## Approval gates

None.

## Questions requiring an owner decision

Still open, and deliberately not answered here: whether the date should ever
*do* something — close the round, warn the manager, or remind the staff. This
task only stopped the screen from implying it already does.

## Next concrete step

Owner pushes the branch onto `main`:
`git push origin feat/the-end-date-stops-claiming-to-close-the-round:main`.
