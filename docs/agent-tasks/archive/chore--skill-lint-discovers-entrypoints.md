# The skill lint finds entrypoints nobody declared

## Metadata

- Branch: chore/skill-lint-discovers-entrypoints
- Base branch: main
- Base commit: `9d0bd1e`
- Landed on `main` as `e0726d5..eac9e8c`, five commits
- Status: landed and archived
- Last updated: 2026-08-12
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the gap the previous task recorded as residual risk: `lint:skills` checked
exactly four hard-coded adapter files, so a brand-new client entrypoint —
`.cursorrules`, `AGENT.md`, `.github/instructions/**` — carried its own
instructions and was never compared against the canonical set at all. The one
failure the whole check exists to prevent is a second set of rules nobody
compared against the first, and a fixed list cannot prevent it.

## User-visible outcome

None. One lint gets stricter; no runtime behaviour changes.

## Context

`CLIENT_ADAPTERS` was a closed list of four files that this repository chose to
write. Every other client that reads instructions from a fixed path was outside
the check by construction, and adding names to the list only ever happens after
somebody notices — which is the moment the check was supposed to come before.

## Scope

`scripts/check-agent-skills.mjs`, `scripts/check-agent-skills.test.mjs`, and the
`AGENTS.md` bullet that describes what the lint checks.

## Non-goals

- No change to the canonical skills or to any product rule.
- No attempt to judge an entrypoint's prose. The check stays a presence check.
- No walk of a dot directory in general. Only `<dot>/rules/` is read.

## Acceptance criteria

- An undeclared entrypoint that names neither `AGENTS.md` nor `.agents/skills/`
  fails the lint.
- Clients that appear after this commit are caught without editing a list.
- No ordinary project file is mistaken for an entrypoint.
- `AGENTS.md` describes what the lint now does, not what it used to do.

All four met; see Verification evidence.

## Decisions made

- Detection is two-layered. A curated list covers clients with fixed filenames
  (`AGENT.md`, `CONVENTIONS.md`, `.junie/guidelines.md`, `.idx/airules.md`,
  `.github/instructions/`, `.clinerules/`). Two shape rules cover the rest: a
  root file matching `/^\.[a-z0-9._-]*rules$/`, and `.md`/`.mdc` under any
  `.<client>/rules/`. The shape rules are what make the check survive a client
  nobody has heard of yet — proved, not assumed, below.
- Only `<dot>/rules/` is descended, never the dot directory itself.
  `.gemini/worktrees/` and `.claude/worktrees/` hold entire checkouts of this
  repository; a wholesale walk would report another worktree's files as this
  one's.
- Detection is shaped, not extension-wide, so the false-positive cost the owner
  question raised does not arise: a new root `NOTES.md` is invisible to it.
- An undeclared entrypoint gets its own failure message. A declared adapter that
  routes nowhere is a maintenance slip; an undeclared file carrying its own
  rules is the failure mode itself, and the two deserve different sentences.
- `CLIENT_ADAPTERS` renamed to `REQUIRED_ADAPTERS`, because the list no longer
  means "the adapters" — it means the four this repository must keep present.

## Assumptions

- The four declared adapters are not discoverable by any of the shape rules, so
  the `REQUIRED_ADAPTERS` filter on the discovered set is defensive rather than
  load-bearing today. It matters if a declared adapter is ever renamed into a
  discoverable shape.

## Completed

- `scripts/check-agent-skills.mjs`: `REQUIRED_ADAPTERS` rename;
  `KNOWN_ENTRYPOINT_FILES`, `KNOWN_ENTRYPOINT_DIRS`, `ROOT_RULES_FILE`,
  `INSTRUCTION_EXTENSIONS`, `NEVER_SCAN` added; `checkAdapter` gained a
  `declared` parameter selecting the message; new exported
  `discoverEntrypoints(listDir, exists)`; `main()` checks every discovered file
  and names them in the success line.
- `scripts/check-agent-skills.test.mjs`: 7 new tests, 28 total.
- `AGENTS.md`: the enforcement bullet now describes discovery and its shape,
  and still states the limit it does not cross.

## In progress

- Nothing.

## Remaining

- Nothing. Push is the owner's action.

## Changed files

Modified: `AGENTS.md`, `scripts/check-agent-skills.mjs`,
`scripts/check-agent-skills.test.mjs`.

Moved: `docs/agent-tasks/active/docs--agent-skill-routing-progressive-disclosure.md`
→ `docs/agent-tasks/archive/`. That task landed on `main` as `23e7932` and
`164c9ef`; its open owner question is answered by this task and marked so in the
archived file.

Added: this task file.

Pre-existing unrelated modifications, left untouched and unstaged:
`.idea/shalomut-map-demo.iml`, `next-env.d.ts`.

The branch was fast-forwarded from `164c9ef` to `b4fea18` before this work was
verified, so it carries the landed interpreter fix. It was then rebased onto
`9d0bd1e` after a first push attempt was rejected: another session had landed
`lint:interpreter` in the meantime. Both moves were conflict-free — that session
touched `package.json` and the interpreter scripts, this one touches `AGENTS.md`
and the skills lint. `verify:core` was re-run after the rebase, on the merged
tree, not only before it.

## Verification evidence

### Passed

- `npm run lint:skills` — 28 unit tests, exit 0; the repository check passes in
  44 ms and reports `3 canonical skills, 4 declared entrypoints`.
- Negative proof taken in `mktemp -d` copies rather than in this worktree, per
  the lesson recorded in the archived task file. Planted `.cursorrules`,
  `.cursor/rules/style.mdc`, `AGENT.md` and
  `.github/instructions/fmt.instructions.md` — every one was flagged.
- `npm run verify:core` — exit 0 as a single chain, including `npm test`. The
  interpreter fix that landed in `219d36a` is why this completes locally now;
  the previous task could only run its steps individually.
- The shape rules were proved to work without a curated name: with `AGENTS.md`
  unnamed in any list, `.roo/rules/bad.md`, `.windsurf/rules/bad.mdc` and
  `.amazonq/rules/ok.md` were all caught. None of those three clients appears
  anywhere in the script.

### Failed

- None.

### Blocked or not run

- Playwright e2e, Python pytest, deployed smoke: not applicable. The diff is one
  Node lint script, its tests and Markdown.

### Environment

- Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`.

### Residual risk

- The curated half of the list still ages. The shape rules limit the damage but
  do not remove it: a future client with a fixed filename in no recognised shape
  is still invisible.
- Discovery reads the working tree, not Git. An entrypoint that is present and
  gitignored is flagged locally and invisible in CI, which is the right way
  round but means a clean CI run is not proof that a checkout is clean.

## Failed approaches

- The first `fakeTree` test helper conflated existence and listing and its
  `exists` predicate was inert. Replaced by `fakeFs(dirs, files)` plus a
  `discover` wrapper, so a test says which paths exist and which are listed.

## Known risks

- None to runtime. The only executable change is a lint that reads Markdown.

## Approval gates

- None triggered.

## Next concrete step

None. Pushed by the owner on 2026-08-12; `origin/main` is `eac9e8c`.
