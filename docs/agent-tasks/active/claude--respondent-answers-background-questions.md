# The respondent can answer a background question

## Metadata

- Branch: `claude/respondent-answers-background-questions`
- Base branch: `claude/breakdown-by-background-question`
- Base commit: `20b0ac7`
- Status: complete, committed, on `origin`, not merged
- Last updated: 2026-08-15
- Last agent/tool: Claude Code (Opus 5)

## Objective

The demographic half of phase 3. A background question can be authored (phase 4)
and its answers can be read (the breakdown screen), but no respondent had ever
produced one by answering: the questionnaire screen rendered three colour stones
for every question whatever its kind. Give it the widgets the instrument needs.

## User-visible outcome

A respondent meets a single-choice question as a list of its own options, a
numeric question as a number field, and an allocation grid as one screen of rows
that must total 100. Optional questions can be skipped, and skipping no longer
blocks the submit button.

## Scope

- Answer values stop being the three colours, in the flow and in the draft.
- A step model, because an allocation grid is several questions on one screen.
- Four widgets: colour stones, an N-option radio group, a number field, an
  allocation grid.
- The submit gate counts required questions rather than all of them.

## Non-goals

- Block rendering of the 108 Likert items with anchors shown once per block.
  That is the analytic half and it waits on the methodologist's mapping.
- Re-deriving the time estimate for a 126-item instrument.
- The consent, intro and anonymity copy from the source document.

## What was built

**The step model** — `src/lib/survey/survey-steps.ts`. A step is either one
question or one allocation group, and this module is the only place that knows
the difference. It also answers three questions the screen used to answer for
itself: what the funnel is told (`questionIndexForStep`, still a *question*
index, so no stored `lastQuestionReached` changes meaning), when a step may be
left (`isStepComplete` — an optional question is complete on arrival, a grid is
all rows or none), and why sending is blocked (`submissionBlocker`).

**One rule for a valid answer** — `src/lib/survey/answer-validity.ts`. The
browser's draft restore and the server's submit route were about to hold two
copies of "is this a legal value for this question". `survey.service.ts` now
imports it and `validateAnswerValue` is a message wrapper over it.

**The widgets** — `src/components/survey/survey-answer-input.tsx`. Colour stones
are unchanged and still only serve `wellbeing-colour`; the others are a
radiogroup for a multi-point scale, a radiogroup plus a skip button for a
background choice, a number field, and the grid with a running total stated as
distance from 100.

**The flow** — `src/components/survey/survey-flow.tsx` walks steps, and its
draft expectation carries `isAnswerValid` rather than a colour list.

### One thing found by walking it

The review card said `הושלמו 6 מתוך 6 שלבים` under the heading
`נותרו שאלות ללא מענה` when the only problem was a grid at 97. Two true numbers
telling one wrong story, and the advice under it pointed at the wrong card.
`submissionBlocker` now separates the two reasons and the review card has a
sentence for each.

## Exact Git state

- HEAD: `f6e4d69` on `claude/respondent-answers-background-questions`
  (`6be8395` the product change, `f6e4d69` the seed and this file)
- Committed: everything below, in two commits.
- Unstaged and deliberately untouched: `.idea/shalomut-map-demo.iml`, which is
  the user's own change and belongs to nobody's task.
- Untracked: none.
- On `origin` at `408386f`, read from the remote itself. Seventh branch of the
  stack; the handoff reaches another checkout or machine. It is not merged —
  `origin/main` is `05a23bc`.

## Verification that actually ran

- `npm run verify:core` — exit 0. That is `lint:literals`, `lint:interpreter`,
  `lint:composition`, `lint:fixtures`, `lint:skills`, `lint:mutation-config`,
  `lint:contract-refusals`, `lint:fonts`, `typecheck`, `test`, `lint`, `build`.
- Unit tests: 0 failures across the suite; `survey-steps.test.ts` is 20 tests of
  its own, four of them about `submissionBlocker`.
- **Browser walk, production build on `localhost:3210`**, round `SHALOM-BACKGROUND`
  (14 questions → 12 steps). Consent read `14 שאלות, כ־3 דקות`; eight colour
  questions auto-advanced; the tenure question rendered as three radios with
  `מעדיף/ה לא לענות` under them, and going back to it showed the selection kept
  and the skip button relabelled `ביטול הבחירה ומעבר הלאה`; the role question was
  skipped and the step still advanced; the number field took `7.5` and did *not*
  auto-advance; the grid at 60/30/7 showed `97%` and `נותרו 3 אחוזים לחלוקה`, the
  review card refused with the grid sentence and the submit button was inert;
  raising the last row to 10 gave `100% הסכום מלא`, and the questionnaire was
  sent — `תודה, התשובות נקלטו`.
- **The stored response was read back** from the local database. It holds
  `background_tenure=veteran`, `background_hours=7.5`,
  `background_load_1..3=60/30/10`, and no entry for the skipped
  `background_role`. This is what closes the residual risk recorded on the
  previous branch: a background answer now exists that a person produced by
  answering, not a seed script by writing.
- A draft written mid-walk survived a server restart and restored the answers,
  the cursor and the grid rows.

## Decisions

- **The colour stones were not generalised.** Their three faces and their
  100/60/0 spacing say something specific about a wellbeing answer; stretching
  them over a seven-point frequency scale would invent anchors the instrument
  does not have. They serve `wellbeing-colour` and nothing else.
- **A background question carries a way out.** Without one, a teacher who will
  not state their tenure has to answer something untrue or abandon the round,
  and the second is what a demographic block costs if it has no exit.
- **The grid is one screen.** Its rows are compared against each other and must
  total 100; a running total nobody can see is a total nobody can reach.
- **The seed round needs eight analytic questions, not two.** The submit route
  parses the definition with the activation rules, which require every dimension
  to be covered — a shorter questionnaire is accepted all the way to the last
  screen and then refused with `DEFINITION_INVALID`. Found by walking it. The
  seed now takes the first question of each dimension.

## Risks and things left

- The analytic half of phase 3 and the question-count estimate were both closed
  later the same day on `claude/likert-blocks-for-respondent`; the two risks this
  file recorded about them no longer stand.
- The respondent page overflows horizontally at 375px. Pre-existing, measured on
  `/round/` too, and out of this diff — spawned as its own task.

## Next concrete step

Superseded: `claude/likert-blocks-for-respondent` builds on this branch and
carries the current step. Nothing above `main` is deployed, and landing the
stack is the owner's call.
