# The three HTML documents match the code, then are republished

## Metadata

- Branch: `docs/html-pages-catch-up`
- Base branch: `main`, through `docs/living-docs-catch-up-with-7-0`
- Base commit: `13e5a76` — the tip of the unlanded `7.0` catch-up branch, whose
  three commits sit on `origin/main` `bfa9ea2`
- Current HEAD: `42abc5b`, and the commit that carries this file
- Status: archived 2026-09-17 — reconciled and republished; ready to land, and
  the push is the owner's
- Last updated: 2026-09-17
- Last agent/tool: Claude Code (Opus 5)

## Objective

On 2026-09-17 the owner chose to fix the drift in the three HTML living
documents first and then republish them. That drift goes beyond `7.0`, and it
was listed while their `7.0` claims were corrected (archived
`docs--living-docs-catch-up-with-7-0.md`, *Remaining*). Make every claim about
current behaviour in `ai-analysis-run-mechanics.html`, `ai-analysis-jobs.html`
and `how-shalomut-works.html` agree with the code, then republish all three to
their existing claude.ai artifacts.

## User-visible outcome

A reader of any of the three pages, in the repository or on claude.ai, is told
how the platform works today: who acts on a round, how many analyses run at
once, what the open dashboard does when a result lands, where telemetry goes.

## Context

- The base branch is not on `main` yet. This branch is built on it because both
  edit the same three files; one push of this branch lands both.
- `origin/main` read `bfa9ea2` on 2026-09-17 (`git fetch`, twice), and neither
  branch is on `origin`.

## Scope

1. The drift listed in the archived task file, each item re-checked against the
   code before it is rewritten.
2. Any further drift found by reading the three pages end to end.
3. `.agents/skills/shalomut-map/SKILL.md`: the published-contract range still
   read `1.0`–`6.0`.
4. The republish, and the global state it changes: `docs/open-decisions.md`
   item 22, the handoff's *Published documents*.

## Non-goals

- The pages' visual design: the design hook's side-tab, colour and radius
  findings predate this task and stay.
- Dated history inside the pages stays history.
- Code comments the reading found stale (see *Decisions made*).

## Acceptance criteria

- No claim about current behaviour in the three pages contradicts the code.
- `how-shalomut-works.html` gains no new exact figure (see *Decisions made* for
  why this replaces "carries no exact figure").
- `npm run lint:doc-numbers`, `npm run lint:docs-publish`, `git diff --check`
  pass; diagrams render with no mermaid error and SVG labels inside their
  `viewBox`.
- The three artifacts are updated in place, not duplicated.

## Relevant repository instructions

- `docs/README.md`, *Update rules*: the HTML documents are living; publish only
  through `npm run docs:publish`; no exact figures in the overview.
- `.agents/skills/shalomut-map/SKILL.md`, `shalomut-verification`.

## Relevant architecture and contracts

- Roles, ADR-042: `admin` holds every write; `manager` is the school user and
  reads analytics, the survey definition and round status.
- A `6.0`/`7.0` round does not fail on a silent provider. The structured
  summary and the overall summary fall back to copy written from the numbers,
  marked `deterministic_fallback`. `ProviderUnavailableError`, the graph's
  `provider_unavailable` exit and that gap reason are raised only on `5.0` and
  earlier, and by question suggestion (`llm_provider.py`,
  `psychologist_node.py`, `graph.py`).
- After the repair budget, `_degrade_to_partial_map` either leaves stated gaps
  (`validation_rejected`) or the round fails `validation_failed`.

## Decisions made

- One branch for reconciliation and republish, stacked on the unlanded `7.0`
  branch.
- The scope took in the documents the pages are paired with, because an HTML
  page corrected alone would contradict its source again:
  - `docs/platform-handbook.md`, the source of `how-shalomut-works.html`;
  - `docs/ai-analysis-run-lifecycle.md`, the twin of `ai-analysis-jobs.html`;
  - `scripts/generate-endpoint-surface.mjs`, whose status-code table both
    quote;
  - `docs/data-flow-and-subprocessors.md`, which repeated two of the stale
    claims.
- Exact figures on the overview page. The rule in `docs/README.md` and the
  page's no-figures header arrived in the same commit, `a63ecb3`, while the page
  already quoted 75/50, ten, 90 s, 30 s, twenty copies and a five-minute pinger.
  So the rule is read as "add none": the existing figures stay, rewritten text
  adds no figure, and a wrong one («до четырёх раз») became «несколько раз».
  The acceptance criterion above is worded to match.
- Diagram defects on the mechanics page predate this task: labels clipped at
  the `viewBox`, labels over other labels, lines and box edges, and two labels
  beside the wrong leader line. They came in with `e9f30de` and were live on the
  published artifact, so they were fixed now. The fixes change geometry only,
  except three shorter wordings that say the same thing: «ищет вмешательства»,
  «правит формулировку», «heartbeat каждые 30 с, всё время». A last one, the
  two lines of the unfunded-provider label in the status diagram, read bottom
  to top (`6566b6d`).
- Mermaid defects that only the published pages showed were fixed in this
  branch too, because the republish would otherwise have carried them again
  (`42abc5b`):
  - claude.ai draws the diagrams without waiting for web fonts. A flowchart or
    state-diagram label is HTML sized in the font present at that moment, so a
    web font that landed later clipped it. The labels now take the local
    fallback of each page's body font: Georgia on the jobs page, `system-ui`
    on the overview. The overview's flowcharts had passed on macOS but depended
    on the same race;
  - the jobs page's `.label` rule matched none of its own elements and reached
    into mermaid's labels; it is gone;
  - the job state diagram had two `running --> running` self-loops. Mermaid
    keeps one, so the heartbeat label was lost and the kept one lay over an exit
    label. A note on `running` says both, on the page and in
    `ai-analysis-run-lifecycle.md`.
- The overview's round sequence was left as it is. The lower copy of each
  stick-figure actor's name has a font box that reaches past the `viewBox` by 2
  of 907 units, which is mermaid's own sequence geometry. Measured glyphs stay
  inside except the tail of «р» in «Администратор», by 0.1 unit, under a pixel
  at every width the page is shown.
- The republish dropped the comment the 2026-08-20 hand version put at the top
  of each published body, naming the repository file and warning that an edit
  on claude.ai is lost. Restoring it is a change to `scripts/publish-doc.mjs`
  and a third republish of all three pages. It is left out of this branch and
  offered as its own task.
- Stale code comments go to a separate task, not this branch:
  - in `ai_job_worker.py`, "roughly two dozen provider calls", and a reclaimed
    attempt "re-sends the same bytes";
  - comments that still assume two containers.
  That task waits for `44eda70` to reach `origin/main`.
- A product bug found while checking roles goes to a separate task: a school
  user is shown the analysis button, and its `403` reads as "service
  unavailable".

## Assumptions

- The assumption this task started with, that claude.ai draws these diagrams as
  the runtime in `docs/vendor/` does, was false and is replaced by measurement.
  The platform loads mermaid `11.16.1` (the repository ships `11.15.0`) and
  does not wait for web fonts. What still rests on assumption is that the
  platform's page behaves like its stored file with the runtime loaded from
  jsdelivr at the same version; see *Residual risk*.

## Completed

- Scope 3: the skill line reads `1.0`–`7.0`.
- Scope 1–2, committed:
  - `6f66e8b`, the job lifecycle and the jobs page:
    - roles: the administrator closes the round and the school user reads
      the map;
    - the `7.0` provider branch ends in success, with copy the screens mark;
    - `service_error` then `worker_error` answered `409`, and a crash outside
      the analysis;
    - three silent endings and the `ai-queue` stall report;
    - the pace is shared across processes;
    - lane-count and stall-threshold rows, the stall threshold checked by
      `lint:doc-numbers`;
    - endpoint status codes regenerated.
  - `32e4d84`, the mechanics page:
    - roles;
    - the check against published aggregates, and the double write in one
      transaction;
    - the dashboard watch, with no push or e-mail;
    - lanes and pace sharing, heartbeat retries and unreachable leases;
    - the `5.0`-only provider exit;
    - operational events and the two health endpoints;
    - the secret switch and timing-safe comparison;
    - diagram geometry.
  - `1cdf5a5`, the overview:
    - `platform-handbook.md` and `how-shalomut-works.html`: three kinds of
      people, the reset bullet, history kept only on changed saves, the pooled
      side average, what leaves the site, the heartbeat, one order in flight,
      the watch, the screen table, companies in five roles;
    - `data-flow-and-subprocessors.md`: the encoder fields and
      administrator-authored notes;
    - the skill.
  - `6566b6d`, the mechanics status-diagram label order.
  - `42abc5b`, the diagram labels and the heartbeat note.
- Scope 4:
  - republished in place, each artifact read first: the mechanics page as
    Version 4, and Version 5 to restore its gallery description (below); the
    jobs page and the overview as Version 4, after a Version 3 of each that
    this session published before the label fixes;
  - `docs/open-decisions.md`: item 22 and its section removed, done;
  - the handoff's *Published documents*: the date, the source commit, the end
    of the duplicated `<style>`, the dropped comment, the platform's mermaid;
  - `docs/README.md`, *Update rules*: the duplicated `<style>` in the past
    tense, and the label-font rule.

## In progress

- (none)

## Remaining

- (none)

## Changed files

- Committed in `6f66e8b`:
  - `scripts/generate-endpoint-surface.mjs`
  - `docs/ai-analysis-run-lifecycle.md`
  - `docs/ai-analysis-jobs.html`
  - `scripts/check-doc-numbers.mjs`
  - `scripts/check-doc-numbers.test.mjs`
- Committed in `32e4d84` and `6566b6d`: `docs/ai-analysis-run-mechanics.html`.
- Committed in `1cdf5a5`:
  - `docs/how-shalomut-works.html`
  - `docs/platform-handbook.md`
  - `docs/data-flow-and-subprocessors.md`
  - `.agents/skills/shalomut-map/SKILL.md`
  - this file
- Committed in `42abc5b`:
  - `docs/ai-analysis-jobs.html`
  - `docs/ai-analysis-run-lifecycle.md`
  - `docs/how-shalomut-works.html`
- In the commit that carries this file:
  - `docs/open-decisions.md`
  - `docs/shalomut-tracker-handoff.md`
  - `docs/README.md`
  - this file, moved to `archive/`
- Not staged on purpose: `next-env.d.ts`, which flips with the last Next
  command.

## Verification evidence

### Passed

- Reconciliation, before `1cdf5a5`:
  - `npm run lint:doc-numbers` — exit 0, 27 claims across 4 documents, its
    tests 0 failed, after the last page edit.
  - `npm run lint:docs-publish` — exit 0.
  - `git diff --check` — exit 0.
  - `npm run docs:endpoints:check` — exit 0, 14 endpoints declared and
    rendered; the endpoint-surface test passed after the generator edit.
  - `npm run lint:gate-inventory` (16 gates), `npm run lint:interpreter`,
    `npm run lint:skills` — exit 0.
  - Browser pane, `python3 -m http.server` over `docs/`, fonts loaded:
    - `ai-analysis-jobs.html`: 5 mermaid diagrams render; actors «Пользователь
      школы» and «Администратор»; step 20 at the identity check; both new table
      rows.
    - `ai-analysis-run-mechanics.html`: measured in viewBox units, the 8
      hand-drawn SVGs have no label outside the `viewBox`, no label over
      another label, no line through a label and no label across a box edge
      (sequence lifelines excepted by design). Screenshots of the boundary,
      lease, state, graph, authority and status diagrams.
    - `how-shalomut-works.html`: 5 mermaid diagrams render with no source block
      left visible; the round sequence shows both actors; no horizontal scroll.
- Diagram fixes, before `42abc5b`:
  - `npm run lint:doc-numbers` — exit 0, 27 claims across 4 documents, 9 tests
    passed; `npm run lint:docs-publish` — exit 0, 10 tests passed;
    `git diff --check` — exit 0.
  - A copy of each page as claude.ai serves it, from the platform's skeleton
    and runtime script with mermaid `11.16.1` loaded from jsdelivr, in the
    Browser pane with the Google Fonts link injected 3 s after load: jobs 5 of
    5 diagrams with no HTML label overflowing its box, no labels overlapping,
    none outside its SVG and every label present; overview 5 of 5, labels in
    `system-ui`, no overflow or overlap, 26 line breaks. The `.md` state
    diagram rendered clean under mermaid `11.16.1`.
  - Both repository pages under `docs/vendor/` (`11.15.0`), same DOM checks:
    clean.
- Republish:
  - `npm run docs:publish` — exit 0 for each page.
  - Each artifact was read before each publish. Before the last one, the jobs
    page and the overview still held the Version 3 this session had published,
    so nothing had been edited on claude.ai in between, and the new overview
    body differed from that Version 3 by exactly the eight added CSS lines.
  - Read back after the publish: the stored jobs and overview bodies are
    identical, line for line, to `tmp/published/`. Each of those two pages
    carries one mermaid runtime block, where the 2026-08-20 copies carried two;
    the mechanics page carries none, having no mermaid.
  - The stored pages themselves, runtime pointed at `mermaid@11.16.1` on
    jsdelivr, Google Fonts link injected 3 s after load (fonts ready at about
    4.1 s and 3.3 s, after the diagrams were drawn):
    - jobs: 5 of 5 diagrams, no source block visible, no mermaid error; no
      HTML label overflowing its box, overlapping another or outside its SVG;
      every state-diagram label present, the heartbeat note included, in
      Georgia; sequence notes break into lines, with no literal `<br`.
    - overview: 5 of 5, no error, no horizontal scroll; the four flowcharts
      with no overflow, overlap or label outside, labels in `system-ui`, 26
      line breaks, no literal `<br`. The round sequence as under *Decisions
      made*.

### Failed

- Mid-session, `lint:doc-numbers` failed 4 tests after the stall claim was
  added, because its fixture lacked the row. After adding the row it passed.
- Before `42abc5b`, the render check of the jobs page failed: state names
  clipped, the heartbeat label missing, labels over labels.
- The mechanics redeploy passed an English `description` and replaced the
  gallery subtitle. The original Russian one was restored in Version 5.

### Blocked or not run

- `npm run verify:core`, `npm run test:e2e` and the Python tests — not run: no
  product code, route or Python file changed.
- The page on claude.ai itself was not looked at: the in-app Artifacts pane was
  not open, and signing in to claude.ai in the Browser pane is the owner's.
- Screenshots of the rendered diagrams after the fix — not taken: the Browser
  pane was hidden and returned blank frames. The evidence is DOM measurement.
- GitHub's rendering of the state diagram in `ai-analysis-run-lifecycle.md` —
  not checked.

### Environment

- Local, macOS. Browser pane over `python3 -m http.server` on 4321 (`docs/`)
  and 4322 (the scratch copies).

### Residual risk

- The published pages were checked as a reconstruction: the stored file with
  its runtime loaded from jsdelivr at the same version. A change to the
  platform's runtime can break them with nothing changed here.
- The published copies no longer name their repository source.

## Failed approaches

- A label overflow check on screen rectangles reported overflow on scaled
  SVGs that was not there. Comparing a `foreignObject`'s own `width` and
  `height` with its content's scroll size is the measure that holds.

## Known risks

- Landing this branch lands the `7.0` branch too. A push of either rebuilds the
  AI service on Render, because the `7.0` branch touches `render.yaml` and
  `ai-analytics-service/**`.

## Approval gates

- Republishing: the owner said yes on 2026-09-17, after the reconciliation.
  Done.
- The push to `main` is the owner's.

## Questions requiring an owner decision

- (none)

## Git state

Committed, not pushed, on `docs/html-pages-catch-up`: `6f66e8b`, `32e4d84`,
`1cdf5a5`, `6566b6d`, `42abc5b` and the commit carrying this file, on top of the
unlanded `44eda70`, `690560f` and `13e5a76`. `origin/main` is `bfa9ea2`, and the
branch is not behind it. Nothing staged or untracked besides; `next-env.d.ts`
shows as modified by the last Next command and is deliberately not committed.
The handoff is visible in this worktree and, once committed, to other worktrees
of this checkout; it reaches another machine only after the push.

## Next concrete step

The owner lands both branches with one push:

    git push origin docs/html-pages-catch-up:main
