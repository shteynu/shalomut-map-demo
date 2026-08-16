# A Likert answer is not a colour

## Metadata

- Branch: fix/a-likert-answer-is-not-a-colour
- Base branch: feat/a-lost-submit-leaves-a-trace
- Base commit: `1f95cc4`
- Current HEAD: `1f95cc4` — nothing committed on this branch yet.
- Status: implemented and verified locally; not committed.
- Last updated: 2026-08-16
- Last agent/tool: Claude Code (Opus 5)

## Objective

Stop a question's answer distribution being computed against the colour scale
when the question is not answered on the colour scale. Report it through
`contracts/scoring-bands.json` instead, so a question and the stone above it
cannot disagree about where yellow starts.

## User-visible outcome

None for any round that exists. The colour scale is untouched, so every round
the product has ever held reports exactly as before. What changes is what a
Likert round would report — and a Likert round is buildable today from the
manager's own builder (`survey-question-card.tsx:465` renders a scale `select`
per question), which is why this is a fix rather than preparation.

## Context

Found by the modularity audit,
`docs/questionnaire-modularity-audit-2026-08-16.md` §2(c). The audit's own
example was weaker than it read and is corrected here — see `Failed
approaches`.

## Scope

- `bucketForAnswer` takes the question's scale and delegates to the shared
  bands for every scale that is not the colour one.
- A named constant for the colour scale id.
- The two tests that were missing.

## Non-goals

- The distribution stays three colour buckets. Whether a 1–7 question should
  report seven buckets is contract semantics and belongs to phase 5 of
  `docs/default-research-instrument-plan-2026-08-14.md`, which replaces
  `scoreDistribution` anyway.
- Nothing else from the audit: the dimension-set coupling, the template
  identity and the three constructions of the default are untouched.

## Acceptance criteria

- A Likert answer is bucketed by the score bands.
- A colour answer still reports the colour the respondent picked.
- A test that fails without the fix — demonstrated, not assumed.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md` — scoring thresholds live in one
  source; do not return threshold literals to code.
- `.agents/skills/shalomut-verification/SKILL.md` — `src/lib` services row, and
  `npm run typecheck` as the floor for any `.ts` change.

## Relevant architecture and contracts

- `src/lib/services/analytics.service.ts:77` — `bucketForAnswer`.
- `src/lib/scoring-bands.ts` / `contracts/scoring-bands.json` — the shared
  bands, read by both runtimes.
- `src/lib/survey/answer-scales.ts` — the scale registry; the colour scale is
  the only one whose points are statuses.

## Decisions made

- **The scale is passed in rather than inferred from the value.** Inferring
  worked only because no shipped Likert scale uses `green` as a point value; a
  scale added later would have broken it silently.
- **Three buckets stay.** The cheap fix does not touch the wire, so phase 5 can
  replace the shape without this being wasted work.
- **A colour question keeps reporting the pick, not the band.** Its points are
  statuses; the respondent chose one.

## Assumptions

- `readAnalyticAnswers` yields the question alongside the answer, so the call
  site needs no new lookup. Verified — `AnalyticAnswer` carries `question`, and
  `AnalyticSurveyQuestion.scaleId` is required rather than optional.

## Completed

- `bucketForAnswer(value, score, scaleId)` delegates to `statusForScore` for
  every non-colour scale.
- `COLOUR_SCALE_ID` added to `src/lib/survey/answer-scales.ts`.
- Two tests appended to `src/lib/services/__tests__/analytics.service.test.ts`.

## In progress

- Nothing.

## Remaining

- Commit. Then the owner's push, as always here.

## Changed files

Unstaged, uncommitted, this worktree only:

- `src/lib/services/analytics.service.ts`
- `src/lib/survey/answer-scales.ts`
- `src/lib/services/__tests__/analytics.service.test.ts`
- `docs/agent-tasks/active/fix--a-likert-answer-is-not-a-colour.md` (this file,
  untracked)

Pre-existing and untouched: `next-env.d.ts`.

## Verification evidence

### Passed

- **Falsification, which is the evidence that matters.** With the two source
  files reverted and the tests kept, `npx tsx --test
  src/lib/services/__tests__/analytics.service.test.ts` reports `not ok 13 - a
  Likert answer is bucketed by the shared score bands, not by the nearest
  colour`, `# pass 13 # fail 1`. With the fix restored: `# pass 14 # fail 0`.
- `npm test` — 1046 pass, 0 fail, 18 suites.
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeded.
- The disagreement between the two rules was enumerated over every score the
  shipped scales can produce rather than argued: they differ on exactly two,
  `75` (5-point, point 4) and `33` (7-point, point 3), and agree on the other
  eight including the midpoint.

### Failed

- None.

### Blocked or not run

- Browser walk: not run. No round on a Likert scale exists in the local
  database, and building one through the manager UI to observe a distribution
  would prove what the unit test already proves against the same method.
- Python suite: not run. Nothing under `ai-analytics-service/` changed and no
  wire shape changed — the payload still carries `{green, yellow, red}`.

### Environment

- Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`.

### Residual risk

- **The shape problem is untouched and is the larger one.** A 1–7 answer is
  still reported in three colour buckets; this change only makes those buckets
  agree with the bands. A manager reading a Likert round still sees a
  green/yellow/red distribution for a question that offered neither.
- No round anywhere currently uses a Likert scale, so nothing observable
  changes until one does.

## Failed approaches

- **The first test passed against the unfixed code and had to be rewritten.**
  It asserted the audit's own example — twelve respondents on the exact
  midpoint of a 1–7 scale, score `50`, reported as twelve yellow. That is a true
  description of the output and proves nothing about this fix: nearest-anchor
  and the shared bands both call `50` yellow. The audit's example illustrates
  that a Likert answer is reported in colours at all, which is the shape problem
  this change deliberately does not fix. The rewrite uses the two scores where
  the rules actually diverge.

## Known risks

- None to any existing round: the colour path is unchanged and covered by its
  own test.

## Approval gates

- None triggered. No secrets, credentials, migrations or aliases touched.

## Questions requiring an owner decision

- Whether a Likert question should report a distribution shaped like its own
  scale rather than three colours. That is phase 5 work and is recorded in the
  audit, not here.

## Next concrete step

Commit the three source files and this task file, then hand the push over.
