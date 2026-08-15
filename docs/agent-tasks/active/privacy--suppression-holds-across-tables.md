# Privacy: suppression that holds across the tables `/breakdown` publishes together

## Metadata

- Branch: privacy/suppression-holds-across-tables
- Base branch: main
- Base commit: `b23ae58`
- Current HEAD: `7ba34ac` is the commit that changes product code, and a
  documentation commit sits on top of it. Written this way on purpose — a task
  file that names its own tip is stale the moment the next documentation commit
  lands, which this repository has watched happen twice.
- Status: implemented, verified locally and committed. Not pushed.
- Last updated: 2026-08-15
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the residual risk the `/breakdown` branch left open: `cell-suppression.ts`
guaranteed its arithmetic within one published table, while the screen offers a
table per background question of the same round, one query parameter apart.

## User-visible outcome

A round whose breakdown table would leave a sub-threshold remainder now publishes
no group at all, where it used to publish the large ones. The empty state gained
a second sentence for the new reason, because the existing one ("no group is
large enough") is false when a group of forty is the one being withheld.

## Context

Raised as an owner decision by `claude/breakdown-by-background-question` and
carried into `docs/shalomut-tracker-handoff.md`. Owner answered on 2026-08-15:
**joint suppression** — the guarantee has to hold across the tables published
together, rather than restricting the screen to one table per round or accepting
the limit with a note.

## Scope

- `src/lib/privacy/cell-suppression.ts` and its tests.
- `src/lib/analytics/__tests__/background-breakdown.test.ts` — the same rule
  stated at the product level.
- `src/components/breakdown/breakdown-board.tsx` — the empty-state copy.
- `scripts/seed-breakdown-round.ts` — a round that exercises the new rule.

## Non-goals

- No schema change, no contract change, no AI boundary change.
- No pairwise cross-tabulation engine. See `Decisions made` for why the obvious
  reading of "joint suppression" is not what was built.

## Acceptance criteria

- A table whose blanked categories come to fewer than `threshold` people
  publishes nothing.
- The existing guarantee — no line has exactly one blank — still holds.
- Both empty-state reasons are distinguishable on screen.
- `verify:core` exit 0, and the change watched working in a browser.

## Relevant repository instructions

- `AGENTS.md` — branch-scoped task state, privacy invariant.
- `.agents/skills/shalomut-tracker/SKILL.md`, `shalomut-map/SKILL.md`,
  `shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

- `src/lib/privacy/cell-suppression.ts` — the algebra.
- `src/lib/analytics/background-breakdown.ts` — its only product caller.
- ADR-004 and ADR-005 in `PROJECT_CONTEXT.md` — the round-level privacy lock,
  which is a separate gate and was not touched.

## Decisions made

- **The mechanism is a rule about residuals, not a cross-tabulation of question
  pairs.** Running `suppressCrossTab` over every pair of background questions
  was considered first and rejected: those cells are never published, so the
  closure would propagate nothing back to the marginals that are. What a reader
  of two tables can actually line up is each table's *residual* — everyone
  outside its published categories, whose size is the round total minus the
  published ones, and whose dimension score-sums follow because `/breakdown`
  prints each group's averages beside its size.
- **So the invariant gained a second rule**: the blanks on a published line
  account for nothing at all, or for at least `threshold` people. It composes
  across tables without any table knowing about another, which is the property
  the owner's decision needs.
- Rule 1 (no lone blank) was **kept alongside** rule 2 rather than replaced.
  Rule 2 alone would permit a lone blank of forty, determined by subtraction —
  harmless as a number but it would make the table's shape depend on whether the
  blank happened to be large.
- `suppressFrequency` now computes `isFullySuppressed` from its own categories
  instead of inheriting it. The wrapper builds a one-column cross-tab whose
  column total is the grand total and therefore always published, so the
  cross-tab's answer was "something is published" for a table showing nothing.

## Assumptions

- The round's own dimension averages are readable by anyone who can read the
  breakdown, so a published group's complement is derivable. This is what makes
  a residual of one an exposed respondent rather than a theoretical one.

## Completed

- The defect was reproduced on the unmodified module before anything changed:
  `{veterans: 54, newcomers: 1, unanswered: 0}` at threshold 10 published
  `veterans 54` against a total of 55, leaving one person as the whole hidden
  remainder.
- Rule 2 implemented in `closeUnderSubtraction`, which now takes the threshold.
- Module comment rewritten: the two rules, why rule 2 is the one that carries
  across tables, and a narrowed statement of what the module does not claim.
- Three tests added to `cell-suppression.test.ts` and one to
  `background-breakdown.test.ts`. The cross-tab family test now also asserts the
  new rule, through a helper that checks it the way the rule is stated — only on
  lines whose sum is published, because with the sum blank there is no
  subtraction to do.
- `--lopsided` added to `scripts/seed-breakdown-round.ts`: 41 responses, 40 of
  them in one category. The round is healthy and its dashboard reads; only the
  tenure table refuses.
- Empty-state copy split by reason in `breakdown-board.tsx`.

## In progress

- Nothing.

## Remaining

- The push. `git push` is an owner action in this environment; the branch is
  visible in this worktree and, now that a commit exists, to another worktree on
  the same machine — not to another checkout until it reaches `origin`.

## Changed files

Committed in `7ba34ac`:

- `src/lib/privacy/cell-suppression.ts`
- `src/lib/privacy/__tests__/cell-suppression.test.ts`
- `src/lib/analytics/__tests__/background-breakdown.test.ts`
- `src/components/breakdown/breakdown-board.tsx`
- `scripts/seed-breakdown-round.ts`

Pre-existing and unrelated, left untouched and unstaged:
`.idea/shalomut-map-demo.iml`, `next-env.d.ts` (regenerated by `next typegen`,
flips between `.next/dev/types` and `.next/types`).

Outside the repository: `.claude/launch.json` gained a `signed-in-walk` entry
(production build on port 3210 with throwaway credentials). `.claude/` is
gitignored, so that entry does not travel with the branch and another checkout
must recreate it.

## Verification evidence

### Passed

- `npm run verify:core` — **exit 0**, twice: once after the module and test
  changes, once after the copy and seed changes. 1113 TypeScript tests, 0 fail,
  0 `not ok` lines. Includes `typecheck`, `npm test`, `lint`, `build` and the
  eight `lint:*` gates.
- `npx tsx --test src/lib/privacy/__tests__/cell-suppression.test.ts` — 18/18.
- `npx tsx --test src/lib/analytics/__tests__/background-breakdown.test.ts` —
  13/13.
- **The behaviour change was watched in a browser**, signed in against a
  production build (`next start`, port 3210) on the local database, with
  credentials generated for the run rather than the repository's own:
  - **The new refusal.** The `--lopsided` round's tenure table publishes no
    group. Before the change it published `veteran 40` with its eight dimension
    averages, which states the forty-first respondent's scores by subtraction.
  - **The same round's role table still reads** — 14 and 27 against a total of
    41. So the round is not locked and this is a per-table refusal, which is the
    distinction the change has to draw.
  - **The ordinary round is unchanged**: 14 and 12 published with scores, the
    four newcomers and the eleven who did not answer both blank, residual 15.
  - **The locked round keeps its own message** — "at least 10 responses, and
    there are 4" — rather than the new one.

### Failed

- None outstanding. One test was written wrong on the way and fixed: the first
  version of `assertHiddenPartIsNeverASmallGroup` summed a line's blanked
  addends *together with its blanked sum*, double-counting the same people, and
  failed on the `an entire small row` fixture. The module was right; the helper
  now checks only lines whose sum is published.

### Blocked or not run

- The third empty-state branch — every category genuinely below the threshold —
  was **not re-walked** in the browser. Its copy is unchanged and now sits behind
  the `false` arm of the new ternary. With four tenure categories it needs a
  round of about ten responses spread evenly, which no seed variant produces.
- `verify:db` and `verify:ai` not run: no schema, repository, contract or AI
  boundary change in this diff.
- Deployed environment untouched and unverified. Nothing here reaches it.

### Environment

- local, `127.0.0.1` database, production build on port 3210.

### Residual risk

- **The claim is about arithmetic, not about knowledge.** A principal who
  already knows their staff room can still recognise a suppressed group. The
  module's comment now says this in place of the older sentence about combining
  different tables, which is the part that is now defended.
- **`suppressCrossTab` gained the rule but has no product caller** other than
  through `suppressFrequency`. Its two-dimensional behaviour under rule 2 is
  covered by the test family and by nothing that renders.
- The new rule suppresses strictly more than the old one. On a small school with
  one dominant category, a table that used to say something now says nothing —
  intended, and worth knowing before someone reads it as a regression.

## Failed approaches

- Pairwise `suppressCrossTab` over background questions, propagating suppressed
  row totals back to the marginals. Abandoned before implementation: the cells it
  closes over are never published, so it would have suppressed almost nothing
  extra while claiming to defend the linkage.

## Known risks

- Pre-existing and **not** introduced here: every manager screen overflows
  horizontally at 375px, recorded on the breakdown branch and still open.

## Approval gates

- `git push` is an owner action in this environment and has not happened.
- No secrets, credentials, aliases or migrations touched. The walk's credentials
  were generated for the run and exist only in the gitignored `.claude/`.

## Questions requiring an owner decision

- None open on this branch. The cross-table question that prompted it was
  answered on 2026-08-15.
- Unchanged from before: the methodologist's item-to-dimension mapping still
  blocks phases 3, 5 and 6 of the research-instrument plan.

## Next concrete step

Push `privacy/suppression-holds-across-tables` and read the three workflows on
it. This is also the branch that finally answers the question the CI session
left open: `Browser smoke` triggers on `push` with no branch filter, and no
branch push has happened since, so its first run on a branch has been inferred
from the trigger and never read.
