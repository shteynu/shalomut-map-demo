# The suggestion follows the questionnaire in hand

## Metadata

- Branch: `fix/the-suggestion-follows-the-questionnaire-in-hand`
- Base branch: `main`
- Base commit: `5904fc4`
- Current HEAD: `4c06351`
- Status: complete — on `origin/main`, verified, archived at session close
- Last updated: 2026-08-16
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close finding 4 of `docs/questionnaire-modularity-audit-2026-08-16.md` §3: the
question-suggestion prompt built its style examples out of a frozen published
contract instead of the questionnaire being written.

Withdraw finding 5 in the same document — the mechanism is real but the premise
is false, and the guard it names is correct design.

## User-visible outcome

- A manager asking the AI for another questionnaire item is shown a suggestion
  modelled on **their own draft's items in that dimension**, not on a copy of an
  older instrument.
- The model is no longer told the respondent answers "on a scale of six
  degrees". No shipped scale has six points, and the instrument that ships today
  is answered on three.
- The model is no longer told to write in the feminine "as in the examples". The
  examples are now the manager's own lines, in whatever register they wrote.

## Context

Two halves of the same button disagreed about what the instrument is. The
template fallback reads Core's living `surveyInstrument`; the AI half reached
into `contracts/ai-analytics-v2.json` — a published contract, frozen by design —
and told the model those were the items of "the original questionnaire".

Three things sharpen this beyond the audit's description, all established by
execution:

1. **The six-point claim was in the prompt body, not a docstring.** The rendered
   prompt contains `בסולם של שש דרגות`. The product ships four scales with 3, 5,
   5 and 7 points, and `likert-6-extent` is an id the definition parser refuses.
   The canonical 24 are answered on `wellbeing-colour` — three points — proved
   by running `createCanonicalSurveyDefinition()`:

   ```
   instrumentId : shalomut-organizational-diagnosis-v1
   questions    : 24
   scales       : [["wellbeing-colour",24]]
   ```

   So the number was wrong for the instrument shipping today, not only for the
   126-item one being adopted.

2. **The frozen manifest and the living instrument had already diverged in 13 of
   24 sentences** — `אני יכולה` against Core's `אני יכול/ה` — and the prompt said
   `בלשון נקבה כמו בדוגמאות`. It was teaching the model a wording the product had
   deliberately rewritten.

3. **Nothing pinned any of it.** Rebinding the manifest to eight fabricated items
   left the Python suite at 480 passed. The one test that looked like a pin
   compared the prompt against `canonical_statements_for_dimension()` — the
   function that built it.

And underneath all three: **`verify:core` ran no pytest**, while branch CI runs
`verify:core` alone. Established by execution — with the defect fully
reinstated, the entire old chain (eight fitness checks, `typecheck`, `npm test`,
`lint`, `build`) exited 0, and `verify:ai` exited 1.

## Scope

- The style examples travel from Core as `styleTexts`, alongside the existing
  `existingTexts` do-not-repeat list.
- `hebrew_prompts` stops importing the frozen manifest's question list.
- The prompt names no number of scale steps and points at the examples' register
  rather than describing it.
- `verify:ai` folded into `verify:core`.
- Finding 5 withdrawn in the audit document, with the latent item beside it
  named.

## Non-goals

- Any capability or contract-version gate on the endpoint. It sits outside the
  round-analytics versions deliberately, and the defect was that the prompt read
  a frozen artifact at all.
- Telling the model the round's actual scale. That is moot while
  `survey-builder.tsx` hardcodes `scaleId: "wellbeing-colour"` on a new question
  — a separate defect, recorded below rather than bundled.
- `templateSuggestionForDimension`, which already follows the living instrument.
- The v2 manifest and the `contracts.py:94-97` guard. See finding 5.
- The 126-item instrument itself.

## Acceptance criteria

- No sentence of `contracts/ai-analytics-v2.json` can appear in a suggestion
  prompt. — met, pinned by the rewritten prompt test, which reads the manifest
  with `json.load` rather than through the module under test.
- The prompt names no scale step count. — met, pinned.
- The register clause appears only when there are examples. — met, pinned.
- `styleTexts` is the target dimension's analytic items only. — met, pinned.
- A Python-only regression turns the branch gate red. — met, shown by
  falsification F.

## Relevant repository instructions

- `AGENTS.md`: current code outranks prose; a living document that disagrees is
  updated in the same task. That is what the audit edit is.
- `.agents/skills/shalomut-verification/SKILL.md`: every guarantee sabotaged;
  only checks that actually ran are recorded.
- No AI provider was called. The prompt tests drive a fake `urlopen`.

## Relevant architecture and contracts

- The suggestion endpoint is deliberately outside contract versions 1.0–6.0
  (`ai-analytics-service/src/schemas/question_suggestion.py`), so `styleTexts`
  bumps no contract and no consumer revalidates.
- `styleTexts` is optional on the Python side, so deploy order is safe in both
  directions: new Core with old Python ignores it (today's behaviour persists
  for one window), new Python with old Core shows no examples. Neither errors.
- `docs/openapi.yaml` is the editable source; `public/openapi.json` regenerated.

## Decisions made

- **The service never substitutes a questionnaire of its own.** An empty
  `styleTexts` produces no example section rather than a fallback to the frozen
  24 — a fallback would reinstate the defect during the deploy window.
- **Register is pointed at, not asserted.** With examples: "in the same register
  and form of address as the examples". Without: nothing.
- **`styleTextsForDimension` is exported and named** rather than written inline
  at the call site, because it is the rule this change exists to state.
- **`verify:ai` moved into `verify:core` rather than added to CI.** The workflow
  already builds the virtualenv, since `npm test` drives the real Python
  pipeline through it, so no CI file changed. `verify` is now
  `verify:core && verify:db`.

## Assumptions

- The manager's draft is a better style model than a published contract even
  when the draft is short. A dimension with one item sends one example.

## Completed

Everything in **Scope**, plus 8 new tests and 6 falsification runs.

## In progress

Nothing.

## Remaining

Nothing on this task. Both commits are on `origin/main`.

## Changed files

- `ai-analytics-service/src/services/hebrew_prompts.py` — `style_texts`
  parameter; `canonical_statements_for_dimension` deleted; the manifest import
  dropped; no step count; conditional register clause.
- `ai-analytics-service/src/schemas/question_suggestion.py` — `styleTexts` and
  `bounded_style_texts()`, sharing one bound with `existingTexts`.
- `ai-analytics-service/src/main.py` — forwards the style list.
- `ai-analytics-service/src/services/llm_provider.py` — threads it to the prompt.
- `ai-analytics-service/tests/test_question_suggestion.py` — the tautological
  test replaced; four new tests.
- `src/components/survey/survey-builder.tsx` — sends the style list.
- `src/components/survey/survey-builder/question-suggestions.ts` —
  `styleTextsForDimension`, and the third argument.
- `src/lib/server/request-question-suggestion.ts`,
  `src/app/api/manager/question-suggestion/route.ts` — thread it through.
- `src/components/survey/__tests__/question-suggestions.test.tsx`,
  `src/app/api/__tests__/question-suggestion.test.ts` — pins on both lists.
- `docs/openapi.yaml`, `public/openapi.json` — `styleTexts` documented.
- `package.json` — `verify:ai` inside `verify:core`.
- `docs/questionnaire-modularity-audit-2026-08-16.md` — finding 4 confirmed and
  sharpened, finding 5 withdrawn, finding 6 added and fixed here.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0. **1071** TypeScript tests (1068 before) and
  **484** pytest tests (480 before), plus the eight fitness checks, `typecheck`,
  `lint` and `build`. Re-run at session close against the final tree, with the
  same result.
- Execution proof that the canonical 24 answer on a three-point scale — the
  transcript is quoted under **Context**.
- Falsification A — the prompt reaches for the frozen contract again: three
  tests fail, including the one that reads the manifest directly.
- Falsification B — `שש דרגות` restored: the step-count test fails.
- Falsification C — `בלשון נקבה כמו בדוגמאות` restored: the register test fails.
- Falsification D — `styleTextsForDimension` widened back to the whole draft:
  the builder test fails on the demographic item.
- Falsification E — the endpoint stops forwarding the style list: the endpoint
  test fails.
- Falsification F — the defect fully reinstated, then the **old** `verify:core`
  chain run in full: `exit=0`. `npm run verify:ai` on the same tree: `exit=1`.
  This is the evidence for the gate change; without it A–E pin nothing on a
  branch.

Each sabotage was reverted from a scratch copy and the suite re-run clean.

### Failed

None.

### Blocked or not run

- **No provider run.** Whether the new prompt produces better suggestions is not
  established. The only automatic grader, `is_valid_question_suggestion`, is
  scale-blind and register-blind, so it cannot answer this; measuring it needs a
  paid provider call that was not made.
- **No browser walk.** The builder is behind `/login`, and the rule this change
  states is a pure function pinned directly.
- **Deployed environment not checked.** If `AI_SERVICE_URL` is unset on Vercel,
  `request-question-suggestion.ts` falls back to `localhost:8000` and every
  deployed suggestion silently takes the template path — which would make the
  defect currently inert in the deployed environment. Not established either
  way; the fix is correct regardless.

### Environment

Local only. No database, no deployed endpoint, no AI provider.

### Residual risk

- Deploy ordering: for one window after Core ships, an older Python ignores
  `styleTexts` and the old prompt persists. Honest, not an error.
- A manager whose draft has no items in the target dimension now gets a prompt
  with no style examples at all. Rare — a new round is seeded from the canonical
  definition — and the shape constraints remain in the prompt.
- Folding `verify:ai` into `verify:core` makes the branch gate depend on the
  service virtualenv. CI already builds it; a developer without it now fails the
  gate earlier and by name.

## Failed approaches

- Restoring a sabotage with `git checkout -- <file>` discarded the uncommitted
  work in that same file. Caught immediately, edits redone, and the remaining
  falsifications ran against a scratch copy instead. No other file was touched
  and nothing was lost beyond the redo.

## Known risks

- `src/components/survey/survey-builder.tsx` creates every new question with
  `scaleId: "wellbeing-colour"` and `polarity: "positive"` hardcoded. Under the
  126-item instrument that is a wrong default, and it is why telling the model
  the round's real scale is not yet worth doing. Separate defect, not bundled.

## Approval gates

None. No credentials, secrets, authentication configuration or deployment
aliases are involved.

## Questions requiring an owner decision

- Is `AI_SERVICE_URL` set on Vercel? If not, the deployed suggestion button has
  been silently serving templates, which changes how urgent this fix was — not
  whether it was right.

## Git state, at session close 2026-08-16

Asked of the remote itself, not of a tracking ref: `refs/heads/main` is
`4c06351`, which is this branch's HEAD. `git log origin/main..HEAD` is empty.

- Committed and pushed: `4039106` (the fix, its tests, the gate change) and
  `4c06351` (the audit correction and the task files).
- Staged: nothing.
- Unstaged: `next-env.d.ts` only — a pre-existing modification that is not this
  task's and was deliberately left alone.
- Untracked: nothing. Confirmed with `git ls-files -o --exclude-standard`,
  because `git status` has under-reported untracked files in this worktree
  before.
- `docs/agent-tasks/active/fix--one-lock-decision-and-one-list-of-dimensions.md`
  was archived in `4c06351`, its commits being on `main`.

**Visibility.** Both commits are on the published branch, so this handoff is
portable to another checkout or machine — not only to this worktree. The one
uncommitted thing, `next-env.d.ts`, is visible here alone and belongs to nobody's
task.

## Next concrete step

Nothing on this task — it is closed. The walk down
`docs/questionnaire-modularity-audit-2026-08-16.md` §3 continues at **finding 6
in that document's own numbering is already closed here**, so the next
unaddressed item is whichever the owner picks next; findings 1–5 are now
confirmed-and-fixed, fixed, fixed, fixed and withdrawn respectively.

The two things this task deliberately left for someone else, both recorded above
in full: the hardcoded `scaleId: "wellbeing-colour"` on a new builder question,
and the unanswered question of whether `AI_SERVICE_URL` is set on Vercel.
