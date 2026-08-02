# Hebrew-only validation parity between Core and the AI service

## Metadata

- Branch: `fix/hebrew-only-parity`
- Base branch: `origin/main`
- Base commit: `ae3c3c4`
- Current HEAD: tip of `fix/hebrew-only-parity`, one commit past `ae3c3c4`
- Status: complete and verified, committed on the branch, not pushed
- Last updated: 2026-08-02
- Last agent/tool: Claude Code

## Objective

Close the P1 defect "TS/Python Hebrew-only drift" from the v3 architecture
refactoring plan, and give the rule the shared cross-language corpus that
section 9.3 of that plan asked for.

## User-visible outcome

A manager cannot be shown a dimension summary, recommendation or metric
narrative written in a script other than Hebrew. Core now refuses such a
callback payload instead of persisting it.

## Context

The v3 plan listed the drift as P1 with the solution "shared golden fixtures".
Python tightened `is_hebrew_only_copy` on 2026-07-30 so that every letter must
be Hebrew; Core kept the older rule, which asked only whether some Hebrew was
present and whether Latin was absent. Core is the side that decides what
reaches persistence and the Dashboard, so the looser rule was the one that
counted.

Measured before the fix, on the same four strings:

| Text | Core accepted | Python accepted |
| --- | --- | --- |
| ordinary Hebrew sentence | yes | yes |
| Cyrillic sentence plus one Hebrew letter | yes | no |
| Hebrew sentence with an Arabic waw | yes | no |
| Latin sentence plus one Hebrew letter | no | no |

The shared `contracts/fixtures/golden_corpus.json` could not catch this: it
covers only the analytics input direction (Core to AI), one positive and one
negative payload per version, and nothing in the callback direction.

## Scope

- Align Core's Hebrew-only predicate with the Python rule, including the
  Hebrew presentation forms `יִ-ﭏ` that Python already counts.
- Add `contracts/fixtures/hebrew_text_corpus.json` as a shared semantic corpus
  for the rule, executed by both runtimes.
- Add callback-level regressions proving a foreign-script stone summary and an
  unrepaired Arabic confusable are refused.

## Non-goals

- Extending the shared corpus to the whole callback payload shape. That is the
  larger section 9.3 gap and belongs to its own task.
- The other open v3 items (canonical models, ports, dormant auth bypass).
- Changing the Python rule, which is already correct.

## Acceptance criteria

- Both runtimes answer every corpus case identically.
- A V6 payload whose stone summary is Cyrillic with one Hebrew letter is
  refused by `validateStoneMapResult`.
- The new tests fail against the previous predicate and pass against the new
  one.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-map/SKILL.md` (contract boundaries,
Hebrew RTL copy), `.agents/skills/shalomut-verification/SKILL.md` (AI
TypeScript contract row of the selection matrix).

## Relevant architecture and contracts

Immutable contracts `1.0`–`6.0` are untouched: this changes how Core judges
copy inside a payload, not the wire schema. No contract version, capability or
manifest changed, so no consumer-first rollout applies.

## Decisions made

- Core adopts the Python rule rather than the reverse. Python's is the stricter
  and the more recently reviewed one, and the incident it was written for is
  recorded in its docstring.
- The corpus tests the predicate directly rather than through whole payloads.
  A payload-level corpus would pin eight unrelated rules at the same time and
  hide which one a future change broke.
- `createValidV6Payload` moved from `ai-contract-v6.test.ts` into
  `src/lib/__tests__/fixtures/v6-payload.ts`. Importing a builder from a test
  module re-runs that module's tests in every suite that borrows it.

## Assumptions

- Digits and punctuation stay out of the rule: the per-version limits that
  forbid numbers in narrative copy are separate checks and already exist.
- A payload arriving at the callback with an Arabic confusable is a defect
  rather than something Core should repair. The generation pipeline repairs
  confusables before it validates, so Core refusing them adds no false
  negatives to the real path.

## Completed

- `isHebrewOnlyUserText` in `src/lib/ai-contract.ts` now requires every letter
  to be Hebrew and at least one letter to be present, over the Hebrew block
  plus the presentation forms. It is exported so the corpus can address it.
- `contracts/fixtures/hebrew_text_corpus.json`: twelve cases covering plain
  Hebrew, digits, punctuation, Hebrew points, a presentation form, Latin,
  Cyrillic, an Arabic confusable, Greek, Latin-only, digits-only and empty.
- `src/lib/__tests__/hebrew-only-corpus.test.ts` and
  `ai-analytics-service/tests/test_hebrew_only_corpus.py` run the same corpus.
- Two callback-level regressions in the TypeScript suite.
- `createValidV6Payload` extracted to a shared fixture module.

## In progress

None.

## Remaining

Nothing in this task's scope.

## Changed files

Committed as the single commit on `fix/hebrew-only-parity`. The branch is not pushed,
so another worktree in this clone can consume it and another checkout or
machine cannot.

- Modified: `src/lib/ai-contract.ts`, `src/lib/__tests__/ai-contract-v6.test.ts`
- Added: `contracts/fixtures/hebrew_text_corpus.json`,
  `src/lib/__tests__/hebrew-only-corpus.test.ts`,
  `src/lib/__tests__/fixtures/v6-payload.ts`,
  `ai-analytics-service/tests/test_hebrew_only_corpus.py`
- Unrelated, still unstaged and preserved: `.idea/shalomut-map-demo.iml`,
  `next-env.d.ts`

## Verification evidence

### Passed

- `npm run verify:core`, exit code `0`: version-literal fitness check, prisma
  generate, `next typegen && tsc --noEmit`, 328 TypeScript tests, ESLint and
  the production build. The boundary Core to AI to callback E2E runs inside
  that suite.
- `.venv/bin/python -m pytest -q` from `ai-analytics-service`, exit code `0`,
  302 passed.
- Red-before-green: with the previous predicate restored, the two corpus tests
  and both callback regressions failed (3 failures); with the new predicate all
  10 tests in the file pass.

### Failed

None.

### Blocked or not run

- `npm run verify:db`: not run. The diff touches no Prisma schema, migration or
  repository.
- Browser smoke: not run. No component or route changed; the only user-visible
  effect is a refusal that already had a rendered error state.

### Environment

Local. `origin/main` at `ae3c3c4`.

### Residual risk

- Core is now stricter than the deployed producer needs it to be. If a
  deployed round ever produced copy with a foreign letter that the pipeline's
  confusable repair missed, that round would now fail validation instead of
  persisting broken copy. That is the intended trade, but it is a behavior
  change on the deployed path and has not been exercised against the deployed
  service.
- The shared corpus still covers only this one semantic rule. Sentence counts,
  status consistency and narrative length remain implemented twice without a
  shared fixture.

## Failed approaches

The first version of the Cyrillic callback regression used a sentence with no
Hebrew letter at all. It passed against the old predicate too, because the old
rule already refused text containing no Hebrew — so it proved nothing about the
drift. The case now carries one Hebrew letter, which is what used to make the
old rule accept a foreign-script paragraph.

## Known risks

None beyond the residual risk above.

## Approval gates

None. No secrets, credentials, authentication configuration or deployment
alias is touched.

## Questions requiring an owner decision

None.

## Next concrete step

Nothing here. The branch is ready for review or merge as it stands; the agreed
follow-up is a separate branch for the dormant repository path in
`src/lib/auth/manager-auth-service.ts:233-247`, which returns `ok: true`
without verifying a password.
