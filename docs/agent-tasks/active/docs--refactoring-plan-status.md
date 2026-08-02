# Record the real implementation status of the v3 refactoring plan

## Metadata

- Branch: `docs/refactoring-plan-status`
- Base branch: `origin/main`
- Base commit: `ae3c3c4`
- Current HEAD: tip of `docs/refactoring-plan-status`, one commit past `ae3c3c4`
- Status: complete, committed on the branch, not pushed
- Last updated: 2026-08-02
- Last agent/tool: Claude Code

## Objective

Stop the repository from presenting the architecture refactoring plan as
delivered when stages 3 to 5 of the v3 document were never started and two of
its P1 defects survived the sequence.

## User-visible outcome

None. Documentation only.

## Context

`PROGRESS.md` carried the headline "Architecture refactoring plan completed and
merged, 2026-08-01". The work actually followed the v4 ordering accepted on
2026-07-30, which is a different and smaller scope: four correctness and
reliability defects first, then registry work. Read against the v3 roadmap,
canonical internal models, the application/ports layer and presentation
hardening are absent, and the Hebrew-only drift and the dormant auth bypass
were still in the code on 2026-08-02.

The 2026-07-30 review also recorded item 6 as "Auth — выполнено". That referred
to deleting stale branches and folding tenant authorization into stage E; the
password-free path in `authenticateCredentials` was untouched, and a reader
could not tell those apart from the wording.

## Scope

- Correct the `PROGRESS.md` headline and point at the audit.
- Add a stage-by-stage audit as section 6 of
  `docs/wellbeing-refactoring-plan-v4-review.md`, which owns the plan review.
- Qualify the "Auth — выполнено" line so it says what it actually covered.

## Non-goals

- Changing any code, or re-planning the unfinished stages.
- Touching `docs/shalomut-tracker-handoff.md`: the open stages are neither
  deployed state, an external blocker nor an approval gate, so that document's
  owned state did not change.
- Re-running verification for the audit's conclusions.

## Acceptance criteria

- No document claims the v3 plan is complete.
- The audit names, per stage, what exists and what does not, with the paths a
  reader can check.
- The two fixes are described as unmerged branch work, because that is what
  they are.

## Relevant repository instructions

`AGENTS.md` memory boundaries (`PROGRESS.md` owns milestones; a global document
is edited only when its own state changed) and the docs-only row of
`.agents/skills/shalomut-verification/SKILL.md`.

## Decisions made

- The audit lives in the plan review document rather than in `PROGRESS.md`.
  `PROGRESS.md` keeps one corrected paragraph and a pointer; the review
  document is where plan-versus-reality already belongs.
- Sections 1 to 5 of the review are left exactly as written on 2026-07-30 and
  marked as a snapshot of that date, rather than edited in place. Rewriting a
  dated review would erase what was actually known then.

## Assumptions

- The audit's findings are as recorded on 2026-08-02 against `ae3c3c4`. They
  came from reading code, not from re-running suites; the section says so.

## Completed

- `PROGRESS.md`: the refactoring bullet now separates the merged v4 sequence
  from the unfinished v3 stages and points at the audit.
- `docs/wellbeing-refactoring-plan-v4-review.md`: added the 2026-08-02 addendum
  note to the header, qualified item 6 of section 4, and added section 6 with
  the stage table, per-stage detail and the defect table from section 8 of v3.

## In progress

None.

## Remaining

Nothing in this task's scope.

## Changed files

Committed as the single commit on `docs/refactoring-plan-status`. The branch is
not pushed, so another worktree in this clone can consume it and another
checkout or machine cannot.

- Modified: `PROGRESS.md`,
  `docs/wellbeing-refactoring-plan-v4-review.md`
- Unrelated, still unstaged and preserved: `.idea/shalomut-map-demo.iml`,
  `next-env.d.ts`

## Verification evidence

### Passed

- `git diff --check`: clean, no whitespace errors.
- Every repository path named in the new section exists on this branch, except
  `contracts/fixtures/hebrew_text_corpus.json`, which the text explicitly
  describes as arriving with the unmerged `fix/hebrew-only-parity` branch.

### Failed

None.

### Blocked or not run

- `npm run verify:core`, `verify:db` and pytest: not run. The diff is two
  Markdown files and changes no code, schema or fixture.

### Environment

Local. `origin/main` at `ae3c3c4`.

### Residual risk

The audit is a point-in-time statement about `ae3c3c4`. Merging
`fix/hebrew-only-parity` or `fix/dormant-auth-bypass` will make two of its
sentences stale, and section 6 names both branches so a later reader can tell.

## Failed approaches

None.

## Known risks

None.

## Approval gates

None.

## Questions requiring an owner decision

Whether the unfinished v3 stages become a planned track or stay a recorded
gap. This branch only records the gap; it does not schedule the work.

## Next concrete step

Nothing here. If the unfinished stages should become work rather than a note,
the smallest independent slice is the fitness-function allowlist: remove
`src/lib/services/analytics.service.ts` from `scripts/check-version-literals.mjs`
and move the two remaining `'2.0'` literals behind the contract package, which
is what DoD 12.2 of v3 actually asks for.
