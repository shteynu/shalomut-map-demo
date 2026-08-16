# One construction of the default questionnaire

## Metadata

- Branch: refactor/one-construction-of-the-default
- Base branch: main
- Base commit: `651144a`
- Current HEAD: `15ce7c4` — the refactor; this file lands in the commit after it.
- Status: implemented, verified and committed locally. Not pushed — `git push`
  is the owner's action here.
- Last updated: 2026-08-16
- Last agent/tool: Claude Code (Opus 5)

## Objective

Build the default questionnaire in one place instead of three, so that the
questions a round is born with, the questions a manager loads from the template
button, and the questions a submission is checked against cannot disagree.

## User-visible outcome

None. The same twenty-four questions, the same scale, the same polarity. What
changes is that they now come from one function.

## Context

Finding of `docs/questionnaire-modularity-audit-2026-08-16.md` §2(a): the
default was constructed in three independent places, each re-typing
`scaleId: "wellbeing-colour"` and `polarity: "positive"` beside its own
`surveyInstrument.questions.map`. The audit priced scenario (a) — replacing the
default — at three edits for that reason, and named the builder copy as the
dangerous one, because it is the copy a manager actually loads.

## Scope

- `canonicalSurveyQuestions()` in `src/lib/survey-definition.ts` as the one
  construction.
- The three former sites derive from it.
- A test that fails when they drift.

## Non-goals

- **No template identity.** Stamping which instrument a snapshot came from
  means widening `SurveyDefinition` and the parser whitelist, and it is the
  other half of the audit's option B. Deliberately a separate change.
- No change to what the default asks.
- Nothing else from the audit: the dimension coupling, `bucketForAnswer`'s
  shape problem, and the `SurveyInstrument` type's missing fields are untouched.

## Acceptance criteria

- Exactly one production expression constructs a default questionnaire.
- A drift between the round's template and the submission's expected questions
  fails a test — demonstrated by simulating it.
- Nothing a respondent or manager sees changes.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md` — the persisted round snapshot is the
  source of a round's questions; the canonical 24 are a template, not a runtime
  requirement.
- `.agents/skills/shalomut-verification/SKILL.md` — `src/components` and
  services rows; `npm run typecheck` as the floor.

## Relevant architecture and contracts

- `src/lib/survey-definition.ts` — `canonicalSurveyQuestions`,
  `createCanonicalSurveyDefinition`.
- `src/lib/services/survey.service.ts` — `canonicalExpectedQuestions`, the
  default a submission is validated against when the caller brings no
  questionnaire.
- `src/components/survey/survey-builder.tsx` — `loadDefaultTemplate` and the
  confirmation that quotes the question count.

## Decisions made

- **The helper returns `AnalyticSurveyQuestion[]`, not the union.** The default
  is entirely analytic, and the narrower type is what lets
  `ExpectedQuestion` — a `Pick` of the same shape — be satisfied without a cast.
- **The confirmation dialog's count reads the template, not the instrument.**
  One line, and it removes the possibility of the dialog quoting a number the
  button does not deliver, which matters because the manager is being asked to
  discard a draft on the strength of that figure.
- **No lint gate.** A gate on `surveyInstrument.questions.map` outside this
  module would fire on the legacy `calculateRoundAnalytics` path and on tests,
  which read the same list for unrelated reasons. The guard is the test below.

## Assumptions

- `survey-definition.ts` is client-safe: it imports only `shalomut-source`,
  `survey/answer-scales`, `survey/survey-duration` and types. Confirmed by the
  builder — a client component — importing it, and by `npm run build`
  succeeding.

## Completed

- `canonicalSurveyQuestions()` added and exported.
- `createCanonicalSurveyDefinition` derives from it.
- `canonicalExpectedQuestions` delegates to it; the now-unused `surveyInstrument`
  import was removed from `survey.service.ts`.
- `loadDefaultTemplate` maps it and adds only a draft key; the now-unused
  `surveyInstrument` import was removed from the builder.
- `CANONICAL_QUESTION_COUNT` replaces the dialog's own count.
- One test added to `src/lib/__tests__/survey-definition.test.ts`.

## In progress

- Nothing.

## Remaining

- The owner's push: `git push origin refactor/one-construction-of-the-default`,
  or straight to `main` with
  `git push origin refactor/one-construction-of-the-default:main`.

## Changed files

Committed on this branch, local only — this branch does not exist on `origin`:

- `15ce7c4` — `src/lib/survey-definition.ts`,
  `src/lib/services/survey.service.ts`,
  `src/components/survey/survey-builder.tsx`,
  `src/lib/__tests__/survey-definition.test.ts`.
- the commit holding this file — this task file, and
  `docs/agent-tasks/archive/fix--a-likert-answer-is-not-a-colour.md` moved out
  of `active/` because that work is on `main` at `651144a`.

Pre-existing and untouched: `next-env.d.ts`, modified before this session.

## Verification evidence

### Passed

- **Falsification of the new test.** With `canonicalExpectedQuestions` returning
  `canonicalSurveyQuestions().slice(0, -1)` — the exact shape of drift the three
  copies allowed — the test reports `not ok 15`, `# pass 14 # fail 1`. Restored:
  `# pass 15 # fail 0`.
- `npm test` — 1047 pass, 0 fail, 18 suites.
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeded, which is also what proves the shared helper
  crosses the server/client boundary.
- Re-grepped after the change: the only production expression that constructs a
  default questionnaire is `survey-definition.ts:518`. The other reads of
  `surveyInstrument.questions` that remain are a suggestion lookup
  (`question-suggestions.ts:39`) and the legacy `calculateRoundAnalytics`
  aggregation path, which are different concerns.

### Failed

- None.

### Blocked or not run

- Browser walk of the template button: not run. The change is a delegation with
  identical output, pinned by a test that compares the template to what a
  submission is validated against; loading it in a browser would show the same
  twenty-four questions it showed before.
- Python suite: not run. Nothing under `ai-analytics-service/` changed.

### Environment

- Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`.

### Residual risk

- **The builder's copy is protected by construction, not by a test.**
  `loadDefaultTemplate` is an internal function of a React component and is not
  reachable from a test without exporting it. It now calls the shared helper, so
  it cannot drift while it stays that way — but nothing would fail if someone
  re-inlined it.
- **The button still loads *the* default, not *this round's* template.** That
  is latent rather than wrong today, because there is only one template. It
  becomes a defect the moment a choice exists, and it is recorded in the audit
  under option B rather than fixed here.

## Failed approaches

- None.

## Known risks

- None to any existing round: the output is identical, and the test pins it.

## Approval gates

- None triggered. No secrets, credentials, migrations or aliases touched.

## Questions requiring an owner decision

- Whether to add template identity to the persisted snapshot now or when a
  second template exists. The audit argues it is cheap to add early and records
  that the parser silently drops unknown fields today, so it cannot simply be
  written and read later without touching the whitelist.

## Next concrete step

Nothing is left to write. The branch is committed and waiting on the owner's
push; until that push exists, this work is visible only in this worktree.
