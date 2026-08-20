# Three published artifacts become repository documents, and their numbers get a gate

## Metadata

- Branch: `feat/an-idle-worker-asks-less-often`
- Base branch: `main`
- Base commit: `2bccdd1` — the commit that archived this branch's first task
- Current HEAD: `6edc491` — on `origin/main`
- Status: complete
- Last updated: 2026-08-20
- Last agent/tool: Claude Opus 5 via Claude Code

## Objective

Stop the three claude.ai artifacts describing this system from drifting away
from the code, and make the drift that started this — a poll cadence corrected
in the code and left standing in the prose — the kind of thing that fails a
check instead of being noticed by accident days later.

## User-visible outcome

The owner opens three HTML documents from disk with nothing running, edits them
like any other file, and sees their changes in a diff. `npm run verify:core`
fails when a number in one of them disagrees with configuration.

## Context

This branch's first task is recorded in
`docs/agent-tasks/archive/feat--an-idle-worker-asks-less-often.md`: it added the
idle poll backoff, took `AI_JOB_POLL_MAX_INTERVAL_SECONDS` from nothing to
thirty seconds, and updated `docs/ai-analysis-run-lifecycle.md` in the same
task. It was archived at `2bccdd1`.

The owner then asked whether the three artifacts track code changes. They did
not, and all three still said the worker asks Core every two seconds. That is a
second, independently deliverable task, and it rode the same branch — which the
one-task-one-branch rule in `AGENTS.md` does not allow. Hence this second
archived file rather than an edit to the first, which
`docs/agent-tasks/README.md` forbids reusing.

## Scope

- Bring all three artifacts into `docs/` as living documents.
- Correct every stale cadence claim in them.
- Add a mechanical check for numbers documents quote from configuration.

## Non-goals

- Republishing the artifacts to claude.ai. Their published copies are still the
  2026-08-18 editions. Republishing is an owner decision and is not needed until
  someone outside the repository needs a link.
- Retrofitting the check to numbers outside the AI-analysis job settings.

## Acceptance criteria

- Each document opens standalone: no server, no build step.
- Every diagram renders.
- A number changed in configuration and left alone in prose fails a check.
- The rule that these files are living documentation is discoverable from
  `AGENTS.md` without knowing it already.

## Relevant repository instructions

`AGENTS.md` → Documentation lifecycle: living documents are updated in the task
that changes the behaviour they describe, and `docs/README.md` is what tells a
reader which documents those are. Being absent from that index is precisely why
the artifacts were missed.

## Relevant architecture and contracts

None changed. The diff touches documentation, two lint scripts, the eslint
config and `package.json`. No runtime code, no schema, no contract.

## Decisions made

- **Artifacts become repository documents; published copies become snapshots.**
  The repository is the side that moves. Editing a published copy and expecting
  the repository to follow is explicitly ruled out in `docs/README.md`.
- **Diagrams stay mermaid source, not baked SVG.** Rendering them once to SVG
  would have removed the vendored bundle entirely, but these files exist to be
  edited when the pipeline changes, and generated SVG cannot be edited.
- **The mermaid bundle is vendored once, shared by both pages.** It is 3.3 MB of
  platform-injected build output, byte-identical in both artifacts; the authored
  documents are 24 KB and 59 KB.
- **`how-shalomut-works.html` quotes no numbers at all.** A non-developer
  overview that repeats a figure is a second truth that goes stale in silence.
  Recorded as a rule in `docs/README.md`, not just done once.
- **`file:line` references lose the line number.** All seven in
  `ai-analysis-jobs.html` pointed somewhere else by the time they were checked;
  a line number rots on any edit above it, a setting name does not.
- **The gate fails when its own anchor stops matching.** A check that silently
  passes after the passage it guards was rewritten is worse than no check.

## Assumptions

- The owner reads these documents locally by opening the file, which is what the
  request described.
- The published artifacts staying at their 2026-08-18 wording is acceptable
  until a link is actually needed.

## Completed

- `7db21c1` — the mechanics artifact mirrored into `docs/` (first task's tail,
  pushed by the owner before this task began).
- `e9f30de` — that mirror stops being a snapshot: date out of the filename,
  header states the obligation, eight stale places corrected, index moves it
  from historical evidence to living sources.
- `a63ecb3` — the other two artifacts brought in, the shared mermaid bundle
  vendored, three broken diagrams fixed, cadence claims corrected.
- `6edc491` — `scripts/check-doc-numbers.mjs` with nine tests, wired into
  `verify:core`, documented in `docs/README.md` and `AGENTS.md`.

## In progress

None.

## Remaining

None on this branch. Two things are deliberately left undone and are recorded
as non-goals above: republishing the artifacts, and widening the gate.

## Changed files

- `docs/ai-analysis-run-mechanics.html` (renamed from the dated filename)
- `docs/ai-analysis-jobs.html`, `docs/how-shalomut-works.html` (new)
- `docs/vendor/mermaid.min.js`, `docs/vendor/mermaid-init.js` (new, vendored)
- `docs/README.md`, `AGENTS.md`
- `scripts/check-doc-numbers.mjs`, `scripts/check-doc-numbers.test.mjs` (new)
- `package.json`, `eslint.config.mjs`, `.gitattributes` (new)

## Verification evidence

### Passed

- `npm run lint:doc-numbers` — 9 unit tests, then 17 claims across 3 documents.
- The gate was proved to fail, not only to pass: four scenarios injected through
  its `check({readFile})` seam — ceiling changed to 45 in `config.py` (6 errors,
  3 documents), lease changed to 120 000 ms (3 errors), a diagram label
  rewritten so nothing matches (2 errors, anchor-slipped message), the setting
  renamed at the source (1 error, reported once rather than per document).
- Whole lint chain: `lint:literals`, `lint:interpreter`, `lint:composition`,
  `lint:fixtures`, `lint:skills`, `lint:mutation-config`,
  `lint:contract-refusals`, `lint:fonts`, `lint:doc-numbers` — all pass.
- `npx eslint` — clean. It had been reading the vendored bundle; excluding
  `docs/vendor/**` took a run from ~20 s to ~8.6 s.
- Both mermaid documents served over a local static server: 5 diagrams of 5
  render in each, `mermaid.parse` clean on all ten, screenshot taken of the
  chapter-7 sequence diagram in `how-shalomut-works.html` confirming the
  corrected `loop` label and a two-line note.
- `ai-analysis-run-mechanics.html` re-rendered after editing: 12 `<h2>`,
  8 `<svg>`, 0 scripts, no comment text leaking into the page, no stale cadence
  strings. The three lengthened SVG labels measured against the 900-unit
  viewBox — right edges at 583, 589 and 817, nearest neighbour gap 28 units.
- Every relative link in `docs/README.md` resolves to a file that exists.

### Failed

None outstanding. Two defects were found and fixed during verification, both
predating this task: the platform's mermaid initializer reads a block's
`textContent`, so 38 `<br/>` written as tags never reached mermaid, and a
semicolon — a statement separator in a sequence diagram — truncated two notes
and took their whole diagram down. Those two diagrams never rendered on
claude.ai either.

One defect was self-inflicted and fixed: the semicolon replacement ran after the
line-break escaping and corrupted 22 of the resulting HTML entities.

### Blocked or not run

- `npm test`, `npm run typecheck`, `npm run build`, `npm run verify:ai` — not
  run. Nothing under `src/` runtime, no schema and no contract changed.
- **`file://` rendering of the two mermaid documents is unverified.** The
  preview pane loads a local file as a `data:` URL, which breaks the relative
  script path, and the connected-Chrome tool rewrites `file://` to `https://`.
  Verified over `http://localhost` instead, plus static evidence that the bundle
  is a classic script with no `import()` and no `import.meta`, which is the only
  loader `file://` refuses.

### Environment

Local worktree only. No database, no deployed environment and no paid provider
were touched.

### Residual risk

- The `file://` path above is argued rather than observed. Opening either
  document by double-click would settle it in seconds.
- `docs/vendor/mermaid.min.js` is 3.3 MB of someone else's build output. It is
  marked vendored in `.gitattributes` and excluded from eslint; nothing in it is
  ours to fix, and we have no way to update it except by re-publishing an
  artifact and extracting again.
- The gate covers figures with a named source. It is blind to prose describing
  changed behaviour — the hardest correction of the day, a passage claiming
  nobody had counted what idle polling costs, would pass it untouched. Said in
  both `docs/README.md` and `AGENTS.md` so a green run is not mistaken for a
  reviewed document.

## Failed approaches

- Fetching the artifacts with `curl`, to keep their bulk out of context: the
  artifact URL returns a 14 KB single-page shell, and the frame subdomain and
  the `/api/frame/` path both answer 404 anonymously. They are private, which is
  correct. No fetch was needed in the end — both files were still cached from
  the earlier session under this session's `tool-results/`.
- Baking the diagrams to inline SVG: rejected on maintainability, see Decisions.

## Known risks

Recorded under Residual risk above.

## Approval gates

None were crossed. Republishing to claude.ai needs an owner decision and was not
done.

## Questions requiring an owner decision

- Whether to republish the three artifacts so the public copies match. Not
  urgent: the two diagrams that never rendered are fixed in the repository
  copies, which is where the documents now live.

## Next concrete step

None. The branch is complete and `origin/main` is at `6edc491`. This file is
archived with a suffixed name because the branch already has an archived task
file and `docs/agent-tasks/README.md` forbids reusing it; a future task starts
from a new branch and a fresh file under `active/`.
