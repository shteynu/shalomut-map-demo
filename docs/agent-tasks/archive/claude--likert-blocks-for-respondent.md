# A Likert block is one screen, and its anchors are read once

## Metadata

- Branch: `claude/likert-blocks-for-respondent`
- Base branch: `claude/respondent-answers-background-questions`
- Base commit: `408386f`
- Status: complete, merged to `main` (`25ee069`), deployed and archived
- Last updated: 2026-08-15
- Last agent/tool: Claude Code (Opus 5)

## Objective

The analytic half of phase 3 of
`docs/default-research-instrument-plan-2026-08-14.md`. The demographic half
landed on the previous branch, so a respondent can now answer a background
question. What was still one-question-per-screen is the part that makes the
instrument long: 108 Likert statements in 13 blocks, each screen repeating the
same five or seven anchors under a single sentence.

## User-visible outcome

A block of statements sharing a section and a scale is one screen. Its anchors
are stated once, at the top, and each statement is a compact row of numbered
choices. The estimate a respondent reads before starting is derived from what
the questionnaire actually asks rather than from a question count.

## What was built

**A third step kind** — `src/lib/survey/survey-steps.ts`. `block` joins
`question` and `allocation`, and the grouping loop that already gathered a grid
now gathers a block through the same key. Two rules make it:

- the key is `section + scale`, not the section alone, because a block states
  one set of anchors and a section mixing 1–5 with 1–7 is two blocks;
- `wellbeing-colour` is never blocked. Its stones *are* its anchors, so there is
  nothing to hoist above them — and every questionnaire persisted before
  sections existed keeps rendering exactly as it did.

Completeness is per statement rather than all-or-none: a block shares a screen
and a scale, not a constraint, so an optional row inside it stays optional. That
is the one place a block deliberately behaves unlike an allocation grid.

**The widget** — `StatementBlock` in
`src/components/survey/survey-answer-input.tsx`. A legend of the scale, sticky
to the top of the card, then one row per statement carrying only the digits. The
digit is what is on screen and the anchor is what a screen reader says, through
`aria-label` on each radio; the legend is `aria-hidden`, because read aloud it
would be seven anchors repeated before every statement, which is the thing the
layout exists to stop.

**The estimate** — `src/lib/survey/survey-duration.ts`. The old rule was ten
seconds an item and its stated reason was that the anchors are the same three
sentences every time and the answer is one tap that auto-advances. Every clause
of that is false for the new instrument, so the cost is now per step kind. The
twenty-four that are actually running still come out at four minutes; the
126-item instrument comes out at 23, inside the 20–30 the owner read the source
document as.

**`lastQuestionReached`** keeps its meaning and now states its resolution in
`types/backend.ts`: it is still a question index and still a lower bound, but a
screen can hold a whole block, so an attempt abandoned at the twentieth
statement reports the block's first. Making it a screen index would have
rescaled every number already stored.

## Exact Git state

- Commits: `7dfffa0` the block layout, `6a22539` the estimate, `5575177` the
  seed and documentation, `0b3e0af` the correction below about where the stack
  actually is.
- Unstaged and deliberately untouched: `.idea/shalomut-map-demo.iml`, the user's
  own change.
- Merged. `origin/main` is `25ee069`, this branch's tip, read from the remote:
  the whole stack went across as one fast-forward of twenty-six commits.
- Two later documentation commits are **local to this worktree** and on no
  remote: `4c25cf4` and the one carrying this closing update. `origin` still has
  this branch at `5575177`, which is an ancestor of `main`, so nothing of
  substance is unpublished — but the closing record is not portable until the
  owner pushes it.

## The deployment was read, and the two deployed-side gaps are closed

Done on 2026-08-15 as the step this file left open.

- **The deployment serves this stack.** The stylesheet `/login/` links,
  `/_next/static/chunks/3i8jb3r94-7yz.css`, is **byte-identical** to the one a
  local production build of this tree produces — same content hash, same 116 583
  bytes, `cmp` clean — and it carries the eight `.survey-block*` rules this
  branch added. The dashboard's `gitSource.sha` was not read: it needs the
  owner's signed-in Chrome, and this reading answers the same question without
  it. What it cannot separate is `5575177`, `0b3e0af` and `25ee069` from one
  another — they are documentation-only and build the same bytes.
- **The phase 1 migration is applied to the deployed database.**
  `20260814120000_answers_may_have_no_dimension_or_score` was the one pending
  migration there; `prisma migrate deploy` applied it and `migrate status` now
  reads `Database schema is up to date!` with thirteen migrations. Read back
  from `information_schema`: `question_answers.dimension_id` and `.score` are
  both nullable on the deployed database. A deployed round can now store a
  background answer.
- **The backfill is a no-op there, which is not the same as having run.**
  `scripts/backfill-round-definitions.ts` reports every round carrying a
  snapshot — and the deployed database holds **0 organizations, 0 rounds, 0
  responses, 0 answers**, so that sentence is vacuous rather than earned. It
  costs nothing now and must be re-run before the
  `surveyInstrument.questions` fallback is removed, because any round created
  there in the meantime is what the script exists for.

## Verification that actually ran

- `npm run verify:core` — exit 0, 0 test failures.
- New tests: five in `survey/__tests__/survey-duration.test.ts` and five block
  cases in `survey/__tests__/survey-steps.test.ts`.
- **Browser walk, production build on `localhost:3210`**, round
  `SHALOM-BACKGROUND` reseeded with two blocks — eight statements on
  `likert-5-extent` under `משאבים בעבודה` and three on `likert-7-frequency` under
  `שאלון שחיקה`. 25 questions became 14 steps and the consent screen read
  «25 שאלות, כ־5 דקות».
- Both blocks rendered their own legend and their own number of columns. The
  step's heading was the section name, not the first statement. Two optional
  rows left blank did not hold the step, and the six required ones did until
  answered.
- **Phone viewports.** At 400px and again at 320px the row becomes two lines —
  the statement, then its scale — with no horizontal overflow
  (`documentElement.scrollWidth` equal to the viewport at both). At 320px a
  target measures 24.7×44 CSS px, above the WCAG 2.2 AA floor of 24×24. The
  first attempt did overflow, because `min-width: 2.5rem` on seven choices was
  wider than the row containing them; the fix is a seven-column grid of whatever
  is left.
- A draft written mid-block survived a server restart with its block answers,
  its cursor and the rest of the attempt.
- **The stored response was read back.** Block answers carry the right scores on
  both scales — `4→75`, `3→50`, `2→25`, `5→100`, `1→0` on the five-point — and
  the negative-polarity block reverses as designed: on 1–7, `7→0`, `6→17`,
  `5→33` for `balance`. The two skipped optional statements are absent rather
  than blank, and the untouched grid and empty number field wrote nothing. This
  is the first time mixed polarity has been produced by a person answering.

## Decisions

- **The colour scale is not blockable.** Blocking is for scales whose anchors
  are words above the choices. The stones carry their own.
- **Gathering, not consecutiveness.** A block collects every question with its
  section and scale wherever they sit in the list, as an allocation grid already
  does — and as the builder already displays them, so a manager sees the group
  they arranged.
- **Per-statement optionality inside a block**, unlike a grid, because the rows
  of a block share no constraint.
- **The estimate constants are judgement, not measurement.** They are named
  constants with a comment saying so, checked against the two numbers that can
  be checked: the four minutes already on the live consent screen, and the
  owner's 20–30 for the full instrument.

## Risks and things left

- **Owner decision 3 is still outstanding**: which of the eight dimensions each
  of the 108 items belongs to, and which are reverse-scored. Without it the
  instrument's own content cannot be authored — only its machinery exists.
- **Consent, intro and anonymity copy** from the source document is not done.
  The document is not readable from this environment; the seeded copy is the
  existing text.
- A block of thirty statements is one long screen with no progress inside it.
  Nothing in the plan asks for pagination within a block and nothing here adds
  it; if a real sitting finds it too long, the step model is where a page break
  would go.

## Next concrete step

Nothing on this branch. It is closed and this file is archived; what phase 3
still owes is owner decision 3 — the item-to-dimension mapping and the
reverse-scored list — which no agent can supply. The live queue is
`docs/default-research-instrument-plan-2026-08-14.md` §7.
