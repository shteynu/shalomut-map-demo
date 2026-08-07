# The 6.0 rules a shorter payload could not reach

## Metadata

- Branch: test/v6-contract-refusals
- Base branch: test/v5-contract-refusals (not yet on `main`)
- Base commit: b24d6ae
- Current HEAD: see `Remaining`
- Status: complete and verified, committed locally, unpushed
- Last updated: 2026-08-07
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the last block of survivors in the AI-contract validator: the `6.0` stone
rules and the paragraph rules of its structured overview.

## User-visible outcome

None. Test-only; `src/lib/ai-contract.ts` is unchanged.

## Context

`6.0` was the first version to get a refusal suite, on 2026-08-03. What that
suite could not reach was found only after `1.0`–`3.0` and `5.0` got theirs and
the report's remaining survivors concentrated in `isValidV6Stone` (9) and
`hasExactlyThreeHebrewParagraphs` (8).

Two causes, both about the fixture rather than the rules:

- The valid payload carries **one metric and five distinct recommendations**,
  so no case could tell `every` from `some`, or the "exactly five" rule from
  the "five distinct" rule. A mutant weakening either survived the whole suite.
- The **paragraph rules had no negative half at all**: a summary paragraph
  could be a number, carry digits or Latin script, or trail off without a full
  stop, and nothing refused it.

The 2026-08-03 decision to leave the *sentence-segmentation* helpers alone
still holds and is honoured here: `hasExactlyTwoCompleteSentences`,
`hasTwoToFourCompleteSentences` and `hasTwoToFiveCompleteSentences` pin a regex
rather than a product rule. `hasExactlyThreeHebrewParagraphs` is a different
thing — three paragraphs, Hebrew only, no numbers, no Latin, each ending where
its last sentence ends — and those are contract rules worth holding.

## Scope

Refusal and boundary cases appended to the existing `6.0` suite,
`ai-contract-payload-refusals.test.ts`, which is that version's home. No new
test file, no new fixture module: the cases that need a second metric or a
sixth recommendation build them from the valid payload in place.

## Non-goals

- No change to `src/lib/ai-contract.ts`.
- No tests pinning sentence segmentation, per the 2026-08-03 decision.
- No assertions on full error-message prose. Five of the remaining survivors
  are message string literals, deliberately: asserting whole messages makes a
  suite brittle, and the tests match the fragment that distinguishes one rule
  from another.
- No second mutation target and no CI threshold.

## Acceptance criteria

All met:

- Every `6.0` rule that a payload can reach has a refusing test.
- The narrative length rule has both of its ends.
- What is left alive is either message prose or provably unreachable, and is
  named below.

## Decisions made

- **The cases live in the existing `6.0` suite** rather than a fourth refusal
  file. One home per contract version keeps a failure readable.
- **The unreachable survivors are documented, not chased.** No payload can
  reach them through `validateStoneMapResult`:
  - `typeof value.score !== 'number'` in `isValidV6Stone` — `Number.isFinite`
    already refuses everything it would.
  - the metric-ID uniqueness check in `isValidV6Stone` — provenance requires
    as many distinct source IDs as there are metrics, so it refuses first.
  - `paragraph.trim().length > 0` in `hasExactlyThreeHebrewParagraphs` — an
    empty or whitespace-only paragraph is already refused for having no Hebrew
    letter in it.
  - the length comparison of the dimension list in `validateStoneMapResult` —
    the member-by-member comparison that follows refuses the same payloads.

## Completed

- `src/lib/__tests__/ai-contract-payload-refusals.test.ts`: 11 tests appended
  (33 in the file).
- `PROGRESS.md` and `ROADMAP.md`: the numbers, and what the remaining
  survivors are.

## In progress

- Nothing.

## Remaining

- Owner action only. Three branches are stacked locally; this one contains all
  three slices: `git push origin test/v6-contract-refusals:main`.

## Changed files

One test file, `PROGRESS.md`, `ROADMAP.md` and this task file.
`.idea/shalomut-map-demo.iml` and `next-env.d.ts` were modified in the worktree
before any of the three slices began and are left alone.

## Verification evidence

### Passed

- `npx tsx --test src/lib/__tests__/ai-contract-payload-refusals.test.ts` —
  33/33.
- `npm run verify:core` — exit 0: 733 TypeScript tests, both fitness checks,
  typecheck, ESLint and the production build.
- `npm run test:mutation:ai-contract` — exit 0:

  | Run | Killed | Survived | No coverage | Errors | Total |
  | --- | --- | --- | --- | --- | --- |
  | this branch's base | 1140 | 67 | 6 | 42 | 93.98% |
  | this branch | 1155 | 52 | 6 | 42 | 95.22% |

  `isValidV6Stone` 9 → 2, `hasExactlyThreeHebrewParagraphs` 8 → 3,
  `isQualitativeNarrative` 1 → 0, `validateStoneMapResult` 9 → 7.

### Failed

- None.

### Blocked or not run

- `npm run verify:db`, `verify:ai` and the Python suite — not run: the diff is
  one test file and documentation.
- Browser smoke — not applicable.

### Environment

Local.

### Residual risk

Low. Of the 52 remaining survivors, 9 are the sentence-segmentation helpers
left alive by decision, 5 are error-message prose, and the rest are the
shadowed comparisons named in each slice's task file. The number should not be
read as a target: the honest reading is that every rule a payload can reach is
now pinned from both sides.

## Failed approaches

- None in this slice. Three of the cases were written knowing the shorter
  fixture could not reach the rule, which is why they build a second metric or
  a sixth recommendation first.

## Known risks

- The mutation score is not a gate and should not become one.

## Approval gates

- None beyond the standing one: pushing is the owner's action.

## Questions requiring an owner decision

- None.

## Next concrete step

Hand the push to the owner: `git push origin test/v6-contract-refusals:main`.
