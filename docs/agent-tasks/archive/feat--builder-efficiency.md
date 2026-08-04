# Search, bulk actions and real reordering in the builder

## Metadata

- Branch: `feat/builder-efficiency`
- Base branch: `main`
- Base commit: `7b8a414`
- Current HEAD: the branch's own commits; not pushed
- Status: implementation complete, awaiting the owner's push
- Last updated: 2026-08-04
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close most of backlog `docs/product-behaviour-backlog.md` §3. A 24-question
instrument was navigable one dimension tab at a time, there was no way to act on
several questions at once, and the order badge carried a drag-handle icon that
did nothing.

## User-visible outcome

A search box above the list filters by question text, dimension label or
question id. Two buttons enable or hide everything currently on screen, naming
the count. Each question has move-up and move-down buttons where the fake drag
handle used to be.

## Context

The questionnaire's order is the order respondents see, so reordering is a
product behaviour rather than a convenience — and the icon implied it already
worked.

## Scope

- Search over the question list.
- Bulk enable/hide scoped to the visible list.
- Move up/down, replacing the drag-handle icon.

## Non-goals

- Drag-and-drop reordering. Two buttons reorder for real and work from the
  keyboard, which a drag handle never did.
- Keyboard accelerators for the per-question actions; left in §3.
- Draft recovery and the "last saved" timestamp, which are §1.

## Acceptance criteria

- Search and the dimension tab compose.
- A bulk action changes exactly the questions on screen and nothing else.
- Moving a question while a filter is on does not move anything the filter
  hides.
- The ends of the list cannot be moved past.
- Every new control is disabled on a frozen questionnaire.

## Relevant repository instructions

`AGENTS.md` skill routing; branch-scoped task state; `git push` is the owner's
action in this environment.

## Relevant architecture and contracts

`PROJECT_CONTEXT.md` ADR-004: the round's `surveyDefinition` snapshot is the
runtime questionnaire, and it freezes after the first response. All three new
controls respect `isFrozen`.

## Decisions made

- Bulk actions follow the visible list rather than the dimension. With a search
  running, "by dimension" would have changed questions that are not on screen.
- A move is measured in the current view: the two questions swap positions in
  the full list, so a filtered view never reshuffles what it hides.
- The operations live in `question-list-operations.ts` rather than the
  component; each one is a statement about the questionnaire the round freezes.
- Search includes the question id, which is what a manager debugging a
  definition actually has in hand.

## Assumptions

- Reordering is worth having before drag-and-drop is. The buttons are the whole
  feature, not a placeholder for a drag implementation.

## Completed

All of the scope above, with tests.

## In progress

Nothing.

## Remaining

Nothing on this branch. §3 keeps keyboard accelerators.

## Changed files

- `src/components/survey/survey-builder/question-list-operations.ts` — new:
  `matchesSearch`, `visibleQuestionsFor`, `setEnabledForKeys`,
  `moveQuestionWithinView`.
- `src/components/survey/survey-builder.tsx` — search state, the two new
  handlers, visible list built from the shared helper.
- `src/components/survey/survey-builder/survey-builder-questions.tsx` — search
  box, bulk buttons, move wiring, filter note now a `role="status"`.
- `src/components/survey/survey-builder/survey-question-card.tsx` — move
  buttons in place of the `GripVertical` icon.
- `src/app/globals.css` — order badge as a control, search box, bulk row.
- `src/components/survey/__tests__/question-list-operations.test.ts` — new,
  8 cases.
- `src/components/survey/__tests__/question-suggestions.test.tsx` and
  `src/components/dashboard/__tests__/dashboard-semantic-quality.test.tsx` —
  new required props at existing call sites.
- `PROGRESS.md`, `docs/product-behaviour-backlog.md` §3.

## Verification evidence

### Passed

- `npm run verify:core`: passed, 481 TypeScript tests.
- Browser, local dev server and the owner's authenticated session, on
  `/survey?round=25a163b5-…` (the active round, 24 questions, no responses so
  not frozen):
  - Moving the second card up swapped it with the first; the first card's
    move-up and the last card's move-down are disabled.
  - Searching "איזון" on the all-questions tab narrowed 24 to 3, and the filter
    note read `מוצגות 3 שאלות בכל השאלות התואמות לחיפוש "איזון"`.
  - Hiding the three matches, then clearing the search, left exactly 3 of 24
    hidden — the bulk action did not reach past the search.
  - Re-enabling brought the count back to 0 hidden. Screenshot taken.

### Failed

None.

### Blocked or not run

- The frozen questionnaire was not exercised in the browser; `isFrozen` is
  passed to the new controls the same way as to the existing ones, and that path
  is covered only by reading the code.
- Mobile viewport not checked, as in the previous slices.
- `npm run verify:db` and `npm run verify:ai`: not run, nothing they cover
  changed.

### Environment

Local: `next dev` on `:3000`, Docker PostgreSQL on `127.0.0.1:5433`. The
reordering done during verification was never saved, so the stored definition of
`סבב חורף 2027` is unchanged.

### Residual risk

Reordering a frozen round would be rejected by the server anyway
(`hasSameQuestionSnapshot` compares order), so the client-side `isFrozen` guard
is defence in depth rather than the only check.

## Failed approaches

None.

## Known risks

None.

## Approval gates

`git push` is blocked for the agent in this environment.

## Questions requiring an owner decision

None.

## Next concrete step

Owner runs:

```bash
git push origin feat/builder-efficiency:main
```
