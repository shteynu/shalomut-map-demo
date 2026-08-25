# What still needs a human

## Metadata

- Branch: `docs/what-still-needs-a-human`
- Base branch: `main`
- Base commit: `100d9b9`
- Current HEAD: `ecb388c`
- Status: complete, verified and landed on `main` as `ecb388c`
- Last updated: 2026-08-25
- Last agent/tool: Claude Opus 5 / Claude Code

## Objective

The owner asked what is left that is not code, after a session that found the
answer to "what is left in code" to be "almost nothing an agent can start". The
list existed, spread across seven documents, and nowhere in one place. Two
statements found while compiling it were wrong and are fixed here.

## User-visible outcome

None. Documentation and one skill routing line.

## Context

Twenty-two items, compiled by reading every source rather than by trusting the
handoff's summary of them. Three were checked against current code because a
dated document is not evidence: the print button is still `window.print()`, the
respondent does see a completion screen, and there is no `LICENSE` file while
`NOTICE` says the repository is deliberately not open source.

## Scope

- `docs/open-decisions.md` — new. An index, not a ledger: every entry names what
  is wanted, who can supply it and what it unblocks, then points at the document
  that owns the argument.
- `docs/README.md` — the register joins the living sources of truth.
- `docs/shalomut-tracker-handoff.md` — keeps owning its operational gates and
  says where the rest are indexed; and gate 7 stops naming phase 3.
- `PROGRESS.md` — the fallback-banner question stops pointing at a document that
  never carried it.
- `.agents/skills/shalomut-tracker/SKILL.md` — routing, so an agent asked "what
  is left" finds the register instead of re-deriving it from `PROGRESS.md`.

## Non-goals

- Moving the handoff's nine operational gates into the register. `AGENTS.md`
  assigns external blockers and approval gates to the handoff, and two copies of
  one fact is the failure this repository has already paid for twice.
- Ranking the items. The register says so in its own opening.
- Answering any of the twenty-two.

## Acceptance criteria

- Every link in the register resolves.
- No document claims another document carries something it does not.
- `lint:skills`, `lint:doc-numbers` and `lint:audit-count` pass.

## Relevant repository instructions

- `AGENTS.md` — documentation lifecycle, and who owns which state.
- `docs/README.md` — the lifecycle index the register had to join to exist.

## Decisions made

1. **An index, not a second ledger.** The register carries no reasoning, and
   says in its own text that the source wins on any disagreement — the rule the
   2026-08-21 audit states for its own abandoned feed, for the same reason.
2. **The handoff keeps its gates.** `AGENTS.md` gives it that state; the register
   links to them rather than restating them.
3. **`PROGRESS.md` keeps owning the fallback-banner reasoning**, since the
   paragraph that explains it is there. Only the pointer was wrong.

## Assumptions

- None. Every claim was read at its anchor, and the three that are about runtime
  behaviour were read in the code.

## Completed

- All of Scope.

## In progress

- Nothing.

## Remaining

- Nothing.

## Changed files

`git diff --stat 2c2f5da..HEAD`.

## Verification evidence

### Passed

- Every markdown link in `docs/open-decisions.md` resolves — checked by
  resolving each target against `docs/`.
- `npm run lint:skills` — exit `0`. Required by the verification matrix because
  `.agents/skills/**` changed: 3 canonical skills, 4 declared entrypoints.
- `npm run lint:doc-numbers` — exit `0`.
- `npm run lint:audit-count` — exit `0`; 50 findings, 42 closed, 8 in part, 0
  open, which is the count the register quotes.
- `git diff --check` — clean.
- **On `main`, 2026-08-25.** All four workflows green at `ecb388c`: `Core
  verification`, `Browser smoke`, `Vercel Deployment & Pipeline Checks` and
  `CodeQL Security Analysis`. `GET /api/health/` then answered `commit: ecb388c`,
  so the deployment is level with `main`.
- Three claims verified against code rather than prose:
  `dashboard-map-page.tsx:284` is `window.print()`; `survey-flow.tsx:687`
  renders a completion screen; no `LICENSE` exists and `NOTICE` states the
  repository is publicly readable and not open source.

### Failed

- None.

### Blocked or not run

- `npm run verify:core` — not run. No source file, test, schema or configuration
  changed; the matrix's row for Markdown and skills asks for links, structural
  validation and `lint:skills`, all of which ran. `lint:skills` is itself part of
  `verify:core`.
- `npm run verify:db`, Playwright, mutation — not run; nothing they cover was
  touched.
- Nothing was read on the deployment this task, and nothing here changes it.

### Environment

- Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`.

### Residual risk

- An index over seven documents can go stale when one of them closes an item.
  The register states the rule that governs that — the source wins — and carries
  no reasoning that could contradict a source. Nothing enforces it
  mechanically, which is a considered gap: `lint:doc-numbers` checks numbers and
  `lint:audit-count` checks one document that counts itself, and neither can
  judge whether an entry is still open.

## Failed approaches

- None.

## Known risks

- None beyond the residual risk above.

## Approval gates

- None. No secret, credential, authentication configuration or alias.

## Questions requiring an owner decision

- Twenty-two of them, which is what this task is. `docs/open-decisions.md`.

## Visibility of this handoff

Archived. `origin/main` carries `ecb388c`, and the `100d9b9` this branch also
held arrived with it.

## Next concrete step

None. This task is closed.
