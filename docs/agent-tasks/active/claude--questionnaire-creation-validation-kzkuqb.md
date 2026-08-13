# Questionnaire and round creation: clearer actions and validation

## Metadata

- Branch: `claude/questionnaire-creation-validation-kzkuqb`
- Base branch: `main`
- Base commit: `9815e3b`
- Current HEAD: see `git log -1` on this branch
- Status: implementation complete, verified locally, awaiting review
- Last updated: 2026-08-13
- Last agent/tool: Claude Code (claude-opus-5)

## Objective

Four user-reported problems in the manager flows: no way to write a question by
hand, a second-attempt button on the respondent thank-you screen, a privacy
tooltip that could not be read where it opened, and a create/edit boundary
between schools and rounds that nobody could tell apart — including a real
double-creation defect when opening a round.

## User-visible outcome

- The builder offers `הוספת שאלה`: an empty question opened in the same dialog
  every other question is edited in. It carries no source label and no rewrite
  requirement, because the wording is already the manager's.
- The respondent thank-you screen no longer offers `מילוי שאלון נוסף`.
- The privacy tooltip stays on top of the panels below it and survives the
  pointer travelling from the trigger to the explanation.
- Opening a school and opening a round are dialogs that say what the save will
  do, ask only for the fields that differ, and name the reason under each field
  they refuse. Editing a round stays a screen, with the save button and the
  save state pinned to the bottom of the viewport.
- `window.confirm` is gone from the manager screens: archive, reset, clear
  questionnaire, load template and delete question ask in Hebrew dialogs that
  say what will happen.

## Context

Reported from the running app with screenshots. The fourth item was raised as a
design question ("maybe move creation, editing, deletion and archiving into
dialogs — think about it"), answered by the user in-session.

## Scope

`src/components/{round,school,survey,ui}`, `src/lib/manager`,
`src/lib/rounds/grade-labels.ts`, `src/app/globals.css`, and tests.

## Non-goals

- Deletion of schools or rounds. The user chose to keep archiving only, so no
  DELETE route, service rule or UI was added.
- Any change to persistence, contracts, privacy semantics or the API surface.
  `PUT /api/manager/setup` is called exactly as the setup screen already called
  it; `docs/openapi.yaml` and `public/openapi.json` are untouched.

## Acceptance criteria

- A question can be written by hand and joins the questionnaire on save.
- The completion screen offers no second attempt.
- An open tooltip is not painted over by later page content.
- Saving a new round twice edits it rather than opening two rounds.
- Creating a school or a round states its own validation per field.

## Relevant repository instructions

`AGENTS.md` skill routing; `shalomut-map` for product/UI; `shalomut-verification`
for the check matrix (`src/components`, page TSX, CSS → targeted tests, lint,
build, browser smoke; plus `npm run typecheck` for any `.ts`/`.tsx`).

## Relevant architecture and contracts

- The privacy threshold minimum and the staff-floor refusal stay in their single
  sources (`survey-definition`, `lib/rounds/staff-floor`); the dialogs call the
  same functions the API answers with, so a refusal cannot be worded two ways.
- Eight dimensions, scoring bands, contract versions and the privacy threshold
  are untouched.

## Decisions made

- **Hybrid over full-modal** (user's choice): creation and confirmation are
  dialogs; editing a round with ~40 fields stays a screen, because a modal is a
  worse place to read one.
- **The `?round=new` / `?school=new` screens stay.** They are the no-JavaScript
  path and still work; the entry points are anchors whose click opens a dialog
  when scripting is on, and a modifier-click still opens the URL in a new tab.
- **Dialogs do not navigate.** They report the created id through `onCreated`
  and the caller decides where to go, which also makes them renderable — and so
  testable — outside a router.
- **Validation is enabled-button-plus-reason**, not a disabled button: the
  reported confusion was a control that refused without saying why. Issues are
  computed on every keystroke but shown only after the first submit.
- **One `ModalDialog`.** The question editor's backdrop, focus trap, Escape
  handling and focus restore were extracted rather than copied four times;
  `QuestionEditDialog` was ported onto it.
- One rule is new and has no server counterpart: an end date before the start
  date is refused in the create dialogs. The API accepts it; this is UI
  guidance, not a contract change.

## Assumptions

- A new round inherits the previous round's background numbers (staff,
  students, classes, audience) rather than asking for them again; the note in
  the dialog says so and the setup screen still edits them.

## Completed

All four reported items, plus the double-creation defect found while reading
the flow.

## In progress

None.

## Remaining

None in scope. Worth a later look, not done here: the round title is editable
in two places (setup screen `תקופת מדידה`, builder `שם השאלון`) and both write
the same column, which is a second thing a manager can be surprised by.

## Changed files

New: `src/components/ui/{modal-dialog,confirm-dialog,field-issue}.tsx`,
`src/components/round/new-round-dialog.tsx`,
`src/components/school/new-school-dialog.tsx`,
`src/lib/manager/{setup-draft,setup-request}.ts`,
`src/lib/rounds/grade-labels.ts`, three test files.

Modified: `setup-form.tsx`, `round-controls.tsx`, `survey-builder.tsx`,
`survey-builder-questions.tsx`, `question-edit-dialog.tsx`, `survey-flow.tsx`,
`globals.css`, three barrel files.

## Verification evidence

### Passed

- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — production build succeeded.
- `npm test` — 900/903. The three failures are the AI cross-service boundary
  tests, which refuse to run without `ai-analytics-service/.venv`; that
  interpreter does not exist in this container and the diff touches no Python,
  contract or AI code.
- `npm run lint:skills` — passed (no skill files changed; run because the task
  file is repository documentation).
- `npx tsx --test src/lib/__tests__/setup-draft.test.ts` — 9/9.
- `npx tsx --test src/components/survey/__tests__/manual-question.test.tsx` — 6/6.
- `npx tsx --test src/components/round/__tests__/manager-create-dialogs.test.tsx` — 10/10.
- Browser smoke, Chromium against `next start` on a local Postgres seeded with
  `db:seed:local`, 20/20 assertions: sticky save bar in the viewport from the
  top of the form; new-round dialog opens without navigating and states the
  one-questionnaire rule; an empty title is refused with a reason and the dialog
  stays open; opening a round lands in that round's own builder; the builder
  offers a hand-written question and it joins the list; clearing asks through a
  product dialog with no browser `confirm` and cancelling changes nothing;
  saving a new round twice leaves one round carrying the edited title (also
  confirmed directly in `survey_rounds`); the open tooltip is the topmost
  element at its own bottom edge; the respondent screen has no second-attempt
  button.

### Failed

None attributable to this diff.

### Blocked or not run

- AI cross-service E2E (`src/app/api/__tests__/ai-e2e.test.ts`): no
  `ai-analytics-service/.venv` in this container. Not created — the diff touches
  no AI, contract or Python code, so the matrix row is not triggered.
- `npm run verify:db` and `verify:ai`: not run, same reason.
- `npm run test:e2e` (Playwright smoke spec): not run; the equivalent paths were
  driven manually in the browser smoke above.

### Environment

Local. Postgres 16 started inside this container for the smoke run and stopped
afterwards; the app ran from `next start` on port 3100. No deployed environment
was touched.

### Residual risk

- The smoke ran at one viewport (1280×860). The save bar and the dialogs have
  mobile rules in CSS that were not exercised in a browser.
- The dialogs' submit paths were driven through the happy path and one refusal
  each; server-side failures (503, 422) render through `managerSetupError` but
  were not provoked.

## Failed approaches

- The create dialogs first called `useRouter` themselves, which made them
  impossible to render in a test ("invariant expected app router to be
  mounted"). Navigation moved to the caller.

## Known risks

None affecting privacy, contracts or persistence: no route, schema or contract
changed.

## Approval gates

None. No secrets, credentials, authentication configuration or deployment alias
was touched.

## Questions requiring an owner decision

None outstanding. Two were asked and answered in-session: hybrid dialogs over a
full-modal rebuild, and no deletion.

## Next concrete step

Review the diff and try the flows in the running app — in particular opening a
round for a school that already has one, and the same two screens on a phone
viewport, which the smoke did not cover.
