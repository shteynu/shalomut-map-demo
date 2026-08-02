# Record the real implementation status of the v3 refactoring plan

## Metadata

- Branch: `docs/refactoring-plan-status`
- Base branch: `origin/main`
- Base commit: `ae3c3c4`, merged up to `956daf5`
- Current HEAD: merged into `main` by `4510384`
- Status: complete and merged into `main`
- Last updated: 2026-08-02
- Last agent/tool: Claude Code (Opus 5)

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

Second commit, correcting section 6 after the audit's stage 4 claim did not
survive close reading of the code:

- Stage 4: the statement that the safety loop "повторяет весь pipeline до трёх
  раз" was wrong. Selective replay by dimension already existed on `ae3c3c4`
  (`ReplayPlan` in `ai-analytics-service/src/agents/node_support.py`, covered by
  `tests/test_replay_targets.py`); only the critique never reached the prompt.
  The correction is stated as a correction rather than swapped in silently.
- Defect table: `P1 safety retry без critique` moves from open to closed on
  2026-08-02.
- Stage 2 and the closing list now name `refactor/version-literal-allowlist` and
  `fix/selective-safety-repair` alongside the first two branches, and the list
  says which three passages go stale at merge.
- Stage 0 and the preamble record that `origin/main` moved to `8debfc7` after
  the audit commit, carrying the opt-in Stryker pilot for `src/lib/ai-contract.ts`.

Fourth commit, rewriting section 6 for the merged state after four of the
branches it described landed in `main` (`origin/main` @ `956daf5`):

- The branch merged `956daf5` rather than rebasing onto it. The branch is
  already pushed, and rebasing would rewrite shared history.
- Every "closed on branch X" sentence became a description of what is in `main`.
  Branch state now lives in exactly one place — a commit table titled
  "Чем закрыто" — so only one passage can go stale next time.
- Stage 0 was rewritten around the gap rather than around the fixture: the
  corpus had no callback direction, which is why the Hebrew drift survived green
  runs. It names `callback_corpus.json` and `stone_map_refusal` as work done and
  not yet merged.
- The stage table moved stage 1 to "6 пунктов из 6" and marked stage 0's
  callback direction closed.
- `PROGRESS.md`: the bullet now names all three surviving P1 defects instead of
  two, and its "no unmerged branch remains" claim is dated to 2026-08-01 rather
  than stated in the present tense, since two branches are open right now.

## In progress

None.

## Remaining

Nothing in this task's scope.

## Changed files

Committed as two commits on `docs/refactoring-plan-status`. The branch is not
pushed, so another worktree in this clone can consume it and another checkout or
machine cannot.

- Modified: `PROGRESS.md`,
  `docs/wellbeing-refactoring-plan-v4-review.md`,
  `docs/agent-tasks/active/docs--refactoring-plan-status.md`
- Unrelated, still unstaged and preserved: `.idea/shalomut-map-demo.iml`,
  `next-env.d.ts`

## Verification evidence

### Passed

- `git diff --check`: clean, no whitespace errors, every commit.
- Every commit hash cited in the "Чем закрыто" table resolves
  (`a6599d3`, `48d6f5d`, `1bca033`, `f86acf8`, `6d42f4c`, `8debfc7`, `956daf5`,
  `fa0bd1e`), and the two files the table describes as not yet merged exist on
  `test/callback-corpus-parity`.
- Every repository path named in the new section exists on this branch, except
  `contracts/fixtures/hebrew_text_corpus.json`, which the text explicitly
  describes as arriving with the unmerged `fix/hebrew-only-parity` branch.
- The corrected stage 4 claim was checked against the code rather than against
  the earlier audit: `ReplayPlan` and the three `retry_*` fields are present in
  `ai-analytics-service/src/agents/node_support.py` on this branch, which is
  `ae3c3c4` for that file. `.venv/bin/python -m pytest` was run on
  `fix/selective-safety-repair`, not here.

### Failed

None.

### Blocked or not run

- `npm run verify:core`, `verify:db` and pytest: not run. The diff is two
  Markdown files and changes no code, schema or fixture.

### Environment

Local. The branch is based on `origin/main` @ `ae3c3c4`; `origin/main` has since
moved to `8debfc7`.

### Residual risk

The audit is a point-in-time statement about `ae3c3c4`, and one of its claims
has already needed correcting — the others came from the same reading pass and
carry the same risk. Merging any of the four fix branches makes three passages
stale; section 6 names them and says so explicitly.

## Failed approaches

The first version of section 6 asserted, about stage 4, that the safety loop
replays the whole pipeline. It came from reading `safety_node.py` and the graph
edges without reading `node_support.py`, where the replay is actually narrowed.
Naming a file the claim depends on, and opening it, is what would have caught it.

## Known risks

None.

## Approval gates

None.

## Questions requiring an owner decision

Whether the unfinished v3 stages become a planned track or stay a recorded
gap. This branch only records the gap; it does not schedule the work.

## Next concrete step

Done: both branches merged in that order, and the "не влито" paragraph was
dropped during the merge as planned. Section 6's "Чем закрыто" table is now the
one place carrying merge state, and it lists every commit including the two
merges themselves.
