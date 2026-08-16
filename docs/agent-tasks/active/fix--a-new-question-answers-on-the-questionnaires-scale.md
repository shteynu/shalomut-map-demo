# A new question answers on the questionnaire's own scale

## Metadata

- Branch: `fix/a-new-question-answers-on-the-questionnaires-scale`
- Base branch: `main`
- Base commit: `18a5cdb`
- Current HEAD: see `Next concrete step` — the fix is one commit on this branch.
- Status: implementation complete and verified locally
- Last updated: 2026-08-16
- Last agent/tool: Claude Code (Opus 5)

## Objective

The builder creates every new analytic question with `scaleId: "wellbeing-colour"`
written into the literal. Under the 126-item research instrument — 1–5 and 1–7
Likert blocks — that is the wrong default, and it is the loose end the previous
task recorded rather than bundled
(`docs/agent-tasks/archive/fix--the-suggestion-follows-the-questionnaire-in-hand.md`,
"Known risks").

Make a new question answer on the scale the questionnaire in hand actually uses.

## User-visible outcome

A manager writing a question into a Likert questionnaire gets that
questionnaire's own scale preselected in the edit dialog, instead of the three
colour stones. They can still change it there — the control is unchanged; what
changes is which value it opens on.

## Context

Same defect shape as the fix that just landed, one screen over. The suggestion
prompt read a frozen artifact instead of the questionnaire being written; the
new-question draft reads a hardcoded literal instead of the same thing. Both are
`docs/questionnaire-modularity-audit-2026-08-16.md` scenario (c): authoring on a
1–5 or 1–7 scale is supposed to cost zero, and the answer-scale registry
(`src/lib/survey/answer-scales.ts`) is genuinely built for it. The builder is the
place that does not read it.

Three sites write the literal today:

1. `survey-builder.tsx:66` — `buildSuggestedQuestion`, both suggestion paths.
2. `survey-builder.tsx:406` — `addQuestionManually`.
3. `question-edit-dialog.tsx:79` — the `useState` initial, which is what a
   question is left holding when the manager switches its kind from background
   to analytic inside the dialog. The kind-switch branch (`:108`) resets the
   background fields and leaves `scaleId` at whatever the previous question left
   in state, so it also leaks one question's scale onto the next.

## Scope

- One derivation of "the scale this questionnaire answers on", named and tested.
- The two builder creation sites read it.
- The dialog takes it as a prop and uses it for the `useState` initial and for
  the background→analytic branch.

## Non-goals

- **Polarity stays `positive`.** See `Decisions made`.
- The section of a new question. There is no "section in hand" — the builder
  filters by dimension, not by section — and the dialog already offers the names
  in use through a datalist.
- Anything in scenario (c)'s reporting half. `scoreDistribution` keeping three
  colour keys for a Likert answer is phase 5 and contract `7.0`.

## Acceptance criteria

- A draft whose analytic questions are on `likert-7-frequency` produces a new
  question on `likert-7-frequency`, from both the manual button and a suggestion.
- An empty draft still produces `wellbeing-colour`.
- A mixed draft answers with the scale of the target dimension's own items, not
  the draft-wide majority.
- The canonical 24-question round is unchanged in every respect.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-map/SKILL.md` (canonical boundaries: the
round's snapshot is the source of questions; the eight dimensions are stable),
`.agents/skills/shalomut-verification/SKILL.md` before claiming completion.

## Relevant architecture and contracts

Nothing crosses the AI boundary and no contract version is touched: this changes
which value a draft opens on in one client component. `parseSurveyDefinition`
already accepts every scale in the registry, and `answer-scales.ts` is already
the single source of the four.

## Decisions made

- **Polarity is not derived, and that is deliberate.** The scale is a property of
  the questionnaire — a block of items shares one, and a colour question inside a
  1–7 block is visibly wrong to the respondent and splits the block on screen.
  Polarity is a property of the individual item's wording: a reverse-scored item
  is a methodological choice about that sentence. Copying the neighbours' polarity
  would silently make the next item reverse-scored because the last one was, and
  a wrong polarity flips a dimension's score with nothing on screen to say so.
  `positive` stays the default, and the dialog shows the control.

## Assumptions

- Enabled questions are what "the questionnaire" means here, following the rest
  of the builder (`estimatedMinutes`, `activeDimensions` both read
  `enabledQuestions`). A draft with everything disabled falls back to all
  analytic questions rather than to the colour scale.

## Completed

- `src/components/survey/survey-builder/new-question-scale.ts` — `scaleForNewQuestion`,
  the one derivation, with the polarity decision written into its own docstring.
- The two builder creation sites read it, and the dialog takes it as a prop.
- The dialog's background branch now resets the scale and the polarity instead of
  leaving the previous question's in state.
- Unit tests for the rule, falsified; a dialog test; a signed-in browser walk of
  both creation paths.

## In progress

Nothing.

## Remaining

Nothing on this task.

## Changed files

- `src/components/survey/survey-builder/new-question-scale.ts` (new)
- `src/components/survey/__tests__/new-question-scale.test.ts` (new)
- `src/components/survey/survey-builder.tsx`
- `src/components/survey/survey-builder/question-edit-dialog.tsx`
- `src/components/survey/__tests__/manual-question.test.tsx`

## Verification evidence

### Passed

- `npx tsx --test` on both test files: 15 passed, 0 failed.
- **Falsified.** With `scaleForNewQuestion` forced to return the colour scale,
  6 of the 8 rule tests fail; restored, all 8 pass. The two that survive are the
  two that assert the colour fallback, which is what they are for.
- `npm run typecheck` clean. It caught one real thing on the way: `blankDraft()`
  in the existing dialog test was typed as the union, so a question carrying a
  scale did not compile until it was typed as the analytic half.
- `npm test` — 1080 passed, 0 failed.
- `npm run lint` clean, `npm run build` clean.
- **Signed-in browser walk, and it is what proves the wiring rather than the
  rule.** A production build on port 3210, a draft round opened through the
  setup screen so the builder was not frozen, and both creation paths read in
  the dialog:
  - Control, on the round's own canonical 24: "הוספת שאלה" opened on
    `סקאלת צבעים`. Unchanged, which is the point.
  - Three questions of `קול אישי` switched to `סולם 1–7 (תדירות)` in the draft.
    "הוספת שאלה" then opened on `סולם 1–7 (תדירות)`, and "הצעה מהתבנית" —
    the other creation path — opened on it too.
  - `כיוון הניקוד` stayed `רגיל` in both, which is the decision above, observed
    rather than assumed.
  - Nothing was saved: the round was read back from the database afterwards and
    still holds 24 questions, all `wellbeing-colour`. The throwaway round was
    then deleted, so the local database is as the walk found it.

### Failed

None.

### Blocked or not run

- No Playwright spec was added for this. Proving it in CI needs an *unfrozen*
  round, and every seeded local round has responses; a spec would have to create
  one, which would make the browser smoke write to the database — something
  every existing spec deliberately avoids. The walk above was done by hand
  instead, on a round created for it and deleted after.
- Nothing was checked on the deployed endpoint, and nothing needed to be: this
  changes a default in a client component, and the deployed database holds no
  round to open the builder on.

### Environment

Local only — a production build on port 3210 against the local database. No
deployed endpoint, no AI provider (`GEMINI_API_KEY` was never in the walk's
path: the AI suggestion button was not pressed).

### Residual risk

- The dialog's `defaultScaleId` prop is exercised by the walk only through the
  paths that pass a draft carrying the scale already. Its other job — a
  background question whose kind the manager switches to analytic inside the
  dialog — is verified by reading, not by execution. It cannot be reached by a
  static render, and it was previously a straight leak of the last analytic
  question's scale, so the change is strictly an improvement either way.

## Failed approaches

- The in-app browser pane rendered the builder as a blank screenshot while the
  DOM was intact, and clicks timed out with "the pane is currently hidden". The
  walk was completed through the Playwright MCP against the same server. Worth
  knowing before someone reads a blank pane as a rendering defect.

## Known risks

- The rule is a majority over the questionnaire, so a manager building a mixed
  instrument still meets a wrong default for the minority block. The scale
  control is in the dialog and on every question card, so it costs one click —
  and it is a better guess than the one scale this code named forever.

## Approval gates

None. No credentials, secrets, authentication configuration or deployment
aliases are involved.

## Questions requiring an owner decision

None raised by this change.

## Next concrete step

Nothing on this task. It is one commit on
`fix/a-new-question-answers-on-the-questionnaires-scale`, and the branch is
ready to land. `next-env.d.ts` is modified in the worktree and is not this
task's — it was there before and is deliberately left alone.

The audit's own list is unchanged by this: §3 findings 1–6 stay closed, and what
remains of `docs/questionnaire-modularity-audit-2026-08-16.md` is the reporting
half of scenario (c) — `scoreDistribution` still carrying three colour keys for a
Likert answer — which is phase 5 and contract `7.0`, and blocked on the
methodologist's answer to question 3.
