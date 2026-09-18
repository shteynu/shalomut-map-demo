# The published copy names its repository source again

## Metadata

- Branch: `docs/published-copy-names-its-source`
- Base branch: `origin/main`
- Base commit: `3037cc7`
- Current HEAD: `6f24fe3`
- Status: complete; awaiting the owner’s push to `main`
- Last updated: 2026-09-18
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

`scripts/publish-doc.mjs` emits, at the top of every published body, the comment
the 2026-08-20 hand version wrote and the script never learned: the repository
file the page comes from, and the warning that an edit made on claude.ai is
lost. Then republish all three pages, with the owner's explicit yes.

## User-visible outcome

A reader who opens one of the three published pages on claude.ai sees, in the
page source, which file in `shalomut-map-demo` it was generated from and that
editing it there will be overwritten by the next republish.

## Context

The 2026-08-20 pass hand-published the three pages and opened each body with

```html
<!-- Источник этой страницы — файл docs/how-shalomut-works.html в репозитории shalomut-map-demo. Правки вносятся там и переиздаются сюда; правка здесь будет потеряна. -->
```

naming that page's own file. `scripts/publish-doc.mjs` (2026-08-25) replaced the
hand transformation but was never taught the comment, so the 2026-09-17
republish of all three pages dropped it. `docs/agent-tasks/archive/docs--html-pages-catch-up.md`
(*Decisions made*, *Residual risk*) left restoring it out of that branch and
offered it as its own task; the *Published documents* section of
`docs/shalomut-tracker-handoff.md` records the published copies as no longer
naming their source.

## Scope

- `scripts/publish-doc.mjs`: emit the comment, deriving the path from the input.
- `scripts/publish-doc.test.mjs`: a test for it (the file is the
  `lint:docs-publish` gate, run inside `verify:core`).
- `docs/shalomut-tracker-handoff.md` *Published documents*.
- `docs/README.md` *Update rules*, where it describes what the script produces.
- The republish itself, after the owner says yes.

## Non-goals

- The three `docs/*.html` sources do not gain the comment. It describes the
  published copy, not the file on disk, which is its own source.
- No other change to the transformation, the refusals or the mermaid notes.

## Acceptance criteria

- The written body starts with the comment naming the input file's repository
  path, and `<title>` stays inside the 8 KB the script already checks.
- The test states both the comment's presence and that the title window still
  holds with it in front.
- `npm run lint:docs-publish`, `npm run lint:doc-numbers`,
  `npm run lint:gate-inventory` and `git diff --check` pass.

## Relevant repository instructions

- `AGENTS.md`: branch-scoped task state, documentation lifecycle.
- `.agents/skills/shalomut-guardrails/SKILL.md`: the gate's test is the record
  of the rule; a gate's test comes before the check it guards.
- `.agents/skills/shalomut-verification/SKILL.md`: the gate row of the selection
  matrix.

## Relevant architecture and contracts

`scripts/publish-doc.mjs` exports `toArtifactBody(html, name)` as a pure
function; `main()` owns file reading and writing to `tmp/published/`. The
comment has to be produced by the pure function for the test to state it
without a file on disk, and `name` is already the input path.

## Decisions made

- The comment is produced by `toArtifactBody`, not by `main()`, so the gate's
  tests can state it without a file on disk — the same reason the refusals are
  there.
- It is prepended **before** the `<title>` window is measured, so the 8 KB check
  measures the body that is actually published. A page whose `<title>` sat just
  inside the window without the comment is now refused, which is the truth.
- The path is normalised by a new `repositoryPath(file, root)`: `docs/page.html`,
  `./docs/page.html` and an absolute path to the same file all reach
  `docs/page.html`, and a file outside the root is **refused**. The comment is
  published, so an unnormalised path would put a local home directory on a public
  page and nothing downstream would catch it.
- The three `docs/*.html` sources do not gain the comment. It addresses a reader
  of the published copy; on disk the file is its own source.
- Documentation states the script's behaviour and that the published copies still
  lack the comment until republished, so it is true whether or not the owner
  approves the republish.

## Assumptions

- The comment's wording is reproduced exactly as the 2026-08-20 copies carried
  it, with only the filename varying. The test spells it out literally rather
  than calling `sourceComment`, so a typo in the implementation is caught.
- `npm run` runs the script from the repository root, which is what
  `repositoryPath` resolves against.

## Completed

- Confirmed `6c06ceb` is an ancestor of `origin/main`, so the handoff paragraph
  to edit is on main.
- `scripts/publish-doc.mjs` emits the comment; `sourceComment` and
  `repositoryPath` are exported and documented, and the top doc-comment records
  the step and why it exists.
- `scripts/publish-doc.test.mjs` gained four tests and two assertions.
- `docs/shalomut-tracker-handoff.md` *Published documents* and `docs/README.md`
  *Update rules* updated.
- Gates run green (see *Verification evidence*).
- Checked, at the owner's request, that the change had not already been made in
  another thread. It had not, on either side: only `8d59f3b` (which created the
  script) and this branch's commit ever touched `scripts/publish-doc.mjs`, no
  remote branch's copy carried the comment, and all three published pages were
  still at their 2026-09-17 version containing neither the comment nor the string
  `shalomut-map-demo` anywhere.
- Republished all three artifacts on 2026-09-18 with the owner's explicit yes,
  reading each by `url` first and publishing with `url` + `file_path` only.

## In progress

- Nothing.

## Remaining

- The push to `main`, which is the owner's.

## Changed files

- `scripts/publish-doc.mjs`
- `scripts/publish-doc.test.mjs`
- `docs/shalomut-tracker-handoff.md`
- `docs/README.md`
- `docs/agent-tasks/active/docs--published-copy-names-its-source.md` (new)

## Verification evidence

### Passed

- `npm run lint:docs-publish` — exit 0, 14 tests pass, 0 fail (was 10).
- `npm run lint:doc-numbers` — exit 0, 27 claims across 4 documents.
- `npm run lint:gate-inventory` — exit 0, 16 gates.
- `git diff --check` — exit 0.
- `npx eslint scripts/publish-doc.mjs scripts/publish-doc.test.mjs` — exit 0.
- `npm run docs:publish` on all three documents — each writes
  `tmp/published/<page>.html` opening with the comment naming its own file.
  Checked by hand on `tmp/published/ai-analysis-jobs.html`.
- The same script invoked with an absolute path reports
  `source: docs/ai-analysis-jobs.html`; invoked on `/etc/hosts` it refuses.
- Republish read back: each of the three published pages now opens with the
  comment naming its own file. `how-shalomut-works` and `ai-analysis-jobs` still
  carry exactly one `claude-mermaid-runtime` block, the platform's own;
  `ai-analysis-run-mechanics` carries none, because its figures are inline SVG.
- The three documents are byte-identical to `42abc5b`
  (`git diff --stat 42abc5b HEAD -- docs/*.html` empty), so the republish changed
  the comment and nothing else.

### Failed

- (none)

### Blocked or not run

- `npm run verify:core` in full — not run. The diff is two `scripts/*.mjs` files
  and Markdown; the gate row of the verification matrix selects the paired
  `node --test` plus the gate itself and `lint:gate-inventory`, all of which ran.
  No `.ts`/`.tsx` changed, so `typecheck` has nothing new to see.
- `npm run lint:skills` — not run and not required: no file under
  `.agents/skills/**` changed.
- Nothing else: the republish ran.

### Environment

- local, plus the claude.ai artifact platform for the republish and its read-back

### Residual risk

- Nothing keeps the published copies level with `docs/` except doing the
  republish. The gate cannot see claude.ai, so a document that changes without
  one drifts silently; the handoff's *Published documents* date is the only
  record of when the two sides were last level.
- `repositoryPath` resolves against `process.cwd()`. Run from a subdirectory
  rather than through `npm run`, the refusal fires instead of a wrong path being
  published, which is the safe direction but is not the same as being right.

## Failed approaches

- (none)

## Known risks

- (none outstanding)

## Approval gates

- The republish of the three artifacts needed the owner's explicit approval, and
  had it on 2026-09-18 after they asked for a check that the change had not
  already been made elsewhere.
- The push to `main` is the owner's: `git push origin docs/published-copy-names-its-source:main`.

## Questions requiring an owner decision

- None. The republish was approved and done.

## Next concrete step

Nothing is left in the worktree. The owner lands the branch with
`git push origin docs/published-copy-names-its-source:main`, after which this
task file moves to `docs/agent-tasks/archive/`.
