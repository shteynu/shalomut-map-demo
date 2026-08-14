# Phase 4 — the builder learns the second kind of question

## Metadata

- Branch: `claude/builder-for-background-questions`
- Base branch: `claude/k-anonymity-for-demographics` (phase 2)
- Base commit: `a2a42df`
- Current HEAD: `b073796` when this file was written; the documentation commit
  that carries the file is its child.
- Status: implementation complete, verified, and walked in a signed-in browser
- Last updated: 2026-08-14
- Last agent/tool: Claude Code (Opus 5)

## Objective

Phase 4 of `docs/default-research-instrument-plan-2026-08-14.md`: answer-type
selection, option-set editing, section editing and polarity in the builder, in
place of the free-text `answerMode` that used to sit there; collapsible
sections, because 126 rows as a flat list is not a list anybody reads; and
per-kind reporting from `getBuilderQuestionnaireValidation`.

## User-visible outcome

A manager can write a demographic question, a numeric one, or a row of an
allocation grid, and can set the scale and the scoring direction of an analysed
one. A long questionnaire reads as named blocks rather than one column.

## Context

Phase 1 introduced the analytic/background union and deliberately narrowed
`BuilderQuestion` to the analytic half, because no control could edit the other
and typing the builder as if one could would have compiled every screen against
fields none of them rendered. That narrowing had a cost, and this phase is where
it comes due: the builder filtered its input to analytic on load, so a
background question was dropped on the way in and gone on the next save.

## Scope

- `BuilderQuestion` becomes the union; every screen the compiler named follows.
- Per-kind controls on the card and in the edit dialog.
- A background tab, section blocks, and section editing.
- Per-kind validation.

## Non-goals

- The respondent's side of any of this (phase 3, blocked on the mapping table).
- Reordering questions between sections by anything other than the existing
  move buttons, which step through the whole visible list and therefore cross a
  block boundary on their own.
- Any change to how a background answer is scored, aggregated or sent — all of
  that was settled in phases 1 and 2.

## Acceptance criteria

- Loading a questionnaire keeps every question it had.
- A background question saves with no dimension, no scale and no polarity, and
  with only the fields its answer mode owns.
- A demographic question is reachable from a tab of its own.
- A choice with fewer than two usable options, a grid of one row, and a row
  naming no grid are each reported before the save.
- Background questions do not count towards dimension coverage.

## Relevant repository instructions

- `.agents/skills/shalomut-verification/SKILL.md` — a signed-in browser walk is
  part of the evidence for a manager-facing change, and falsification before
  calling a test load-bearing.

## Relevant architecture and contracts

- ADR-004 as amended on 2026-08-14: background questions sit outside the
  eight-dimension coverage rule and outside the all-or-nothing unlock. The
  builder's coverage check now says the same thing in the same words.

## Decisions made

- **One "add question" button, with the kind chosen in the dialog.** A second
  button for demographics would put a rare choice next to a common one and make
  the manager decide before they have written anything.
- **The dialog rebuilds the question rather than spreading over the old one.**
  The two kinds hold different fields, and carrying a dimension onto a
  background question is exactly what `parseSurveyDefinition` refuses.
- **Changing answer mode drops what the old mode owned.** `options: []` on a
  numeric question is refused with a message about a field the manager cannot
  see, and an `allocationGroupId` on anything but a grid is refused outright.
- **A background tab, not a place in the "all" list.** Under every dimension tab
  a demographic question is invisible; without a tab of its own the only way to
  see one is to clear the filter.
- **Sections are `details` elements.** They collapse with no JavaScript, a
  screen reader already announces them as expandable, and find-in-page opens
  them. Blocks appear only once a questionnaire names a section — 24 questions
  read better as one list.
- **Sections keep first-appearance order.** Sorting them would show the manager
  a different questionnaire from the one a respondent reads.
- **A stored questionnaire is normalised at the repository.** See below; this
  was not in the plan and is the larger of the two defects the phase found.

## Assumptions

- A section is presentation only and stays a free-text field with a datalist of
  the names already in use, rather than becoming an entity. Nothing is scored or
  aggregated by section, so an entity would be a schema for a label.

## Completed

- `survey-builder/types.ts` — the union, `isBuilderAnalyticQuestion` /
  `isBuilderBackgroundQuestion`, `BACKGROUND_FILTER_ID`, the Hebrew labels for
  kinds, answer modes and polarity, per-kind validation, `toBuilderQuestions`
  and a per-kind `toSurveyDefinitionQuestion`.
- `survey-question-card.tsx` — per-kind fields, an options editor, the
  allocation-group field, `withAnswerMode`, and a neutral stone colour for a
  question that belongs to no dimension.
- `question-edit-dialog.tsx` — kind selection first, then the fields that kind
  has; a section field with a datalist; validation of options and grids before
  the dialog closes.
- `survey-builder-questions.tsx` — the background tab and the section blocks.
- `question-list-operations.ts` — `groupBySection`, `sectionNamesIn`, and a
  filter that understands a tab naming no dimension.
- `globals.css` — the section blocks and the options editor.
- `survey-builder.tsx` — both load paths go through `toBuilderQuestions`.

### Two defects the phase found

- **`prisma-round.repository.ts` handed back raw JSON typed as a
  `SurveyDefinition`.** A questionnaire written before `kind` existed reached
  the builder with no `kind` on any question, so the screen showed eight empty
  dimension tabs above twenty-four questions. Seen in the browser, not in a
  test — every server-side consumer parses, so nothing else had ever noticed.
  It now reads through `parseSurveyDefinition`, which is where those defaults
  already live.
- **`suggestionDimensionId` read any non-`"all"` tab as a dimension**, so the
  new background tab produced "a suggestion for the `background` dimension" on
  screen. It now checks the value against the eight.

Also fixed in passing: the respondent preview in the edit dialog named a 1–6
scale that no scale in this product has. It reads the anchors off the chosen
scale now.

## In progress

Nothing.

## Remaining

- Phase 3 (the respondent experience) and phase 5 (contract `7.0`), both blocked
  on the methodologist's item-to-dimension mapping.
- Phase 6, the swap itself.
- A manager-facing cross-tab screen, which is what will finally call the
  suppression module built in phase 2.

## Changed files

New: `src/components/survey/__tests__/builder-background-questions.test.ts`,
`src/lib/repositories/__tests__/legacy-definition-shape.test.ts`, this file.

Modified: `src/components/survey/survey-builder.tsx`, the five files under
`src/components/survey/survey-builder/`, `src/app/globals.css`,
`src/lib/repositories/prisma/prisma-round.repository.ts`, and the three test
files whose fixtures the union touched.

`.idea/shalomut-map-demo.iml` is a pre-existing user modification and stays
unstaged.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0. **980 tests pass, 0 fail** — 961 before this
  branch, 19 added.
- **Falsification, two breaks, each restored:**
  - the analytic-only filter restored on load → `loading a questionnaire keeps
    every question it had` fails;
  - the repository handing back raw JSON again → `a question stored without a
    kind reads back as analytic` fails.
- **Signed-in browser walk**, `next start` on port 3210 against the local
  database, in the connected Chrome:
  - the pre-existing round `dfgdfg`, whose questionnaire predates `kind`, went
    from "0 מרכיבי שלומות" with all eight dimensions reported missing, to
    "8 מרכיבי שלומות" and no warning — the repository fix, seen;
  - a draft round carrying 24 analytic and 4 background questions in three
    sections rendered its background tab (4), its section blocks with counts,
    a choice card with its option rows, a numeric card, and both rows of an
    allocation grid with the grid-id field;
  - the edit dialog swapped its fields when the kind select changed —
    dimension, scale and polarity out, answer mode and option rows in;
  - saving through the manager's own button and reading the row back gave 28
    questions, `{"analytic":24,"background":4}`, all three section names, and
    every background question with exactly the fields its mode owns.

### Failed

None.

### Blocked or not run

- `npm run verify:db` — not run, and not applicable: no schema, migration or
  query changed. The repository change is a pure mapping, covered by the new
  unit test with a stubbed client.
- The respondent screens still ignore background questions. That is phase 3,
  and nothing here claims otherwise.

### Environment

Local only. The walk used a throwaway draft round created for it; the round was
deleted afterwards and the previously active round restored, leaving the three
rounds the database started with. No deployed action of any kind.

### Residual risk

Low for the builder, which is now type-checked per kind and walked. The
repository change is the one with reach: every screen that reads a round now
gets a parsed definition rather than raw JSON. That is strictly closer to what
the type says, and a definition that will not parse is still passed through
unchanged, so no round can stop rendering because of it.

## Failed approaches

- Falsifying the analytic-only filter in the coverage check did **not** fail any
  test, and the filter is kept anyway. A background question carries no
  `dimensionId` — the parser refuses one and the builder never writes one — so
  the set of covered dimensions is the same with or without it. It narrows the
  type and states the intent; it is not load-bearing, and this file says so
  rather than listing it as pinned.
- `?roundId=` in the URL does nothing: the builder page selects its round
  through the switcher's form. The walk used the switcher.

## Known risks

- `next-env.d.ts` churns between `.next/dev/types` and `.next/types` depending
  on whether `typecheck` or `build` ran last. Revert it rather than commit it.

## Approval gates

- `git push` is an owner action. Three branches are now waiting, in order:
  `claude/answer-model-for-research-instrument`,
  `claude/k-anonymity-for-demographics`, and this one.

## Questions requiring an owner decision

- Unchanged: the methodologist's item-to-dimension mapping, with reverse-scoring
  marked. It blocks phases 3 and 5, which are all that is left before phase 6.

## Next concrete step

Owner: push the three branches in order, then supply the mapping table. With
phases 1, 2 and 4 done, the mapping is the only thing standing between here and
the rest of the plan.
