# The three HTML documents match the code, then are republished

## Metadata

- Branch: `docs/html-pages-catch-up`
- Base branch: `main`, through `docs/living-docs-catch-up-with-7-0`
- Base commit: `13e5a76` — the tip of the unlanded `7.0` catch-up branch, whose
  three commits sit on `origin/main` `bfa9ea2`
- Current HEAD: `32e4d84`, and this file lands in the commit after it
- Status: in progress — reconciled and committed; republish next
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
- `origin/main` read `bfa9ea2` on 2026-09-17 (`git fetch`), and neither branch
  is on `origin`.

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
  beside the wrong leader line. They came in with `e9f30de` and are live on the
  published artifact, so they were fixed now. The fixes change geometry only,
  except three shorter wordings that say the same thing: «ищет вмешательства»,
  «правит формулировку», «heartbeat каждые 30 с, всё время».
- Stale code comments go to a separate task, not this branch:
  - in `ai_job_worker.py`, "roughly two dozen provider calls", and a reclaimed
    attempt "re-sends the same bytes";
  - comments that still assume two containers.
  That task waits for `44eda70` to reach `origin/main`.
- A product bug found while checking roles goes to a separate task: a school
  user is shown the analysis button, and its `403` reads as "service
  unavailable".

## Assumptions

- The claude.ai artifact renderer draws these mermaid blocks as the local
  runtime in `docs/vendor/` does. Checked locally only; see *Residual risk*.

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
  - This commit, the overview:
    - `platform-handbook.md` and `how-shalomut-works.html`: three kinds of
      people, the reset bullet, history kept only on changed saves, the pooled
      side average, what leaves the site, the heartbeat, one order in flight,
      the watch, the screen table, companies in five roles;
    - `data-flow-and-subprocessors.md`: the encoder fields and
      administrator-authored notes;
    - the skill.

## In progress

- (none)

## Remaining

- Scope 4: republish the three pages, then open-decisions item 22 and the
  handoff's *Published documents*, then archive this file.

## Changed files

- Committed in `6f66e8b`:
  - `scripts/generate-endpoint-surface.mjs`
  - `docs/ai-analysis-run-lifecycle.md`
  - `docs/ai-analysis-jobs.html`
  - `scripts/check-doc-numbers.mjs`
  - `scripts/check-doc-numbers.test.mjs`
- Committed in `32e4d84`: `docs/ai-analysis-run-mechanics.html`.
- In this commit:
  - `docs/how-shalomut-works.html`
  - `docs/platform-handbook.md`
  - `docs/data-flow-and-subprocessors.md`
  - `.agents/skills/shalomut-map/SKILL.md`
  - this file
- Not staged on purpose: `next-env.d.ts`, which flips with the last Next
  command.

## Verification evidence

### Passed

- `npm run lint:doc-numbers` — exit 0, 27 claims across 4 documents, its tests
  0 failed, after the last page edit.
- `npm run lint:docs-publish` — exit 0.
- `git diff --check` — exit 0.
- `npm run docs:endpoints:check` — exit 0, 14 endpoints declared and rendered;
  the endpoint-surface test passed after the generator edit.
- `npm run lint:gate-inventory` (16 gates), `npm run lint:interpreter`,
  `npm run lint:skills` — exit 0.
- Browser pane, `python3 -m http.server` over `docs/`, fonts loaded:
  - `ai-analysis-jobs.html`: 5 mermaid diagrams render; actors «Пользователь
    школы» and «Администратор»; step 20 at the identity check; the state
    diagram's new labels; both new table rows.
  - `ai-analysis-run-mechanics.html`: measured in viewBox units, the 8
    hand-drawn SVGs have no label outside the `viewBox`, no label over another
    label, no line through a label and no label across a box edge (sequence
    lifelines excepted by design). Screenshots of the boundary, lease, state,
    graph, authority and status diagrams.
  - `how-shalomut-works.html`: 5 mermaid diagrams render with no source block
    left visible; the round sequence shows both actors; no horizontal scroll.

### Failed

- Mid-session, `lint:doc-numbers` failed 4 tests after the stall claim was
  added, because its fixture lacked the row. After adding the row it passed.

### Blocked or not run

- `npm run verify:core`, `npm run test:e2e` and the Python tests — not run: no
  product code, route or Python file changed.
- Rendering on claude.ai — not yet; it follows the republish.

### Environment

- Local, macOS.

### Residual risk

- The published artifacts render mermaid in claude.ai's own runtime, which has
  dropped `<br/>` and failed on `;` before. The pages use `&lt;br/&gt;` and no
  `;` in labels, but only a look at the published page proves it.

## Failed approaches

- (none)

## Known risks

- Landing this branch lands the `7.0` branch too. A push of either rebuilds the
  AI service on Render, because the `7.0` branch touches `render.yaml` and
  `ai-analytics-service/**`.

## Approval gates

- Republishing: the owner said yes on 2026-09-17, after the reconciliation.
- The push to `main` is the owner's.

## Questions requiring an owner decision

- (none)

## Next concrete step

- Run `npm run docs:publish -- docs/ai-analysis-jobs.html`. Read its artifact
  without `path`, then publish the body to that artifact's URL. Repeat for the
  other two pages.
