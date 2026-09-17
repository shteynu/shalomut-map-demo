# The living documents stop presenting `6.0` as the deployed contract

## Metadata

- Branch: `docs/living-docs-catch-up-with-7-0`
- Base branch: `main`
- Base commit: `bfa9ea2`
- Current HEAD: `690560f`, and the commit that carries this file
- Status: archived 2026-09-17 — ready to land; the push is the owner's. The
  republish of the three HTML documents waits on the owner's yes
- Last updated: 2026-09-17
- Last agent/tool: Claude Code (Opus 5)

## Objective

The deployment produces contract `7.0` since 2026-09-13, and read so again on
2026-09-17. The follow-ups the call-count task left (its archived file,
*Remaining*) turned out to be the visible end of a wider gap: the documents
that own runtime status never heard about the switch, and several comments
still quote call counts from before adaptation was batched per dimension.
Make every living document and configuration comment say what is true, and
change no configured value.

## User-visible outcome

Nothing in the product changes. A reader of the version matrix, the service
README, `.env.example`, `render.yaml`, `config.py` or the three HTML documents
learns that the deployment produces `7.0` and what a `7.0` round costs in
provider requests.

## Context

- Anonymous reads on 2026-09-17 12:11 UTC: Core `GET /api/health/` answers
  `commit: bfa9ea2`, `producedContractVersion: 7.0` (`configured`), producible
  `3.0`–`7.0`, supported `1.0`–`7.0`; the service `GET /health` answers
  `commit: bfa9ea2`, `env: production`, supported `1.0`–`7.0`,
  `jobPollingEnabled: true`.
- `1cd6591` recorded the switch in `PROGRESS.md` and the tracker handoff only.
  `docs/ai-contract-version-matrix.md` — the document that owns runtime status
  — still said Production selects `6.0` and `7.0` is not deployed.
- A `7.0` round is 17 requests on a clean pass (8 structured summaries,
  1 overall summary, 8 adaptation batches), 51 when every answer is refused at
  the default three attempts, 204 at most with replays; untimed. Counted in
  `docs--round-call-count-7-0`.

## Scope

1. Runtime status: the version matrix, `docs/ai-analytics-handoff.md`, the
   service README, `.env.example`, `PROGRESS.md`, `PROJECT_CONTEXT.md` (ADR-002
   area), `docs/README.md`, `docs/source-of-truth.md`,
   `docs/dashboard-semantic-contract.md`,
   `docs/dynamic-questionnaire-ai-contract.md`, the OpenAPI descriptions and
   `scripts/local-unlocked-pipeline.ts`.
2. Call counts: `config.py`, `render.yaml`, `.env.example`, the service README,
   the sequence diagram of `docs/ai-analysis-run-lifecycle.md`.
3. `docs/shalomut-tracker-handoff.md`: *Provider account* (the depletion count)
   and *Contract and AI runtime*.
4. The `7.0`-specific claims of the three HTML living documents.
5. `docs/open-decisions.md` item 22: what the republish still needs.

## Non-goals

- No configured value changes, no paid provider call.
- Dated records stay as written: the 2026-08-21 audit, ADRs (ADR-056's "as of
  this record" included), archived task files, dated milestones in
  `PROGRESS.md`.
- Drift in the HTML documents that is not about `7.0` — listed under
  *Remaining*, not fixed, until the owner decides the scope.
- Republishing the HTML documents — only on the owner's explicit yes.

## Acceptance criteria

- No living document or comment presents `6.0` as the deployed contract or a
  pre-`7.0` call count as current.
- `npm run lint:doc-numbers` passes; comment-only edits are proven comment-only
  (Python AST, parsed YAML, `.env.example` assignments unchanged).
- Committed on this branch; the push is handed over.

## Relevant repository instructions

- `.agents/skills/shalomut-tracker/SKILL.md`, `.agents/skills/shalomut-map/SKILL.md`,
  `.agents/skills/shalomut-verification/SKILL.md`.
- `docs/README.md`, *Update rules*: the three HTML documents are living; no exact
  numbers in `how-shalomut-works.html`; publish only through `npm run docs:publish`.

## Relevant architecture and contracts

- `contracts/capabilities.json`: `7.0` — `usesNarrativeMetrics: false`,
  `carriesAnswerScale: true`, otherwise `6.0`'s flags. Five recommendations per
  stone follow `usesStructuredDimensionSummary` (`safety_node.py`,
  `ai-contract.ts`), so `6.0` and `7.0`.
- `src/lib/analytics-encoder.ts`: a version without `carriesAnswerScale` refuses
  to encode a round whose questions are not on the colour scale.
- `ai-analytics-service/src/services/hebrew_prompts.py`, `ANSWER_SCALE_RULE`:
  the model is told a high normalised average is good even on a
  negative-polarity statement.
- `src/lib/ai-insights-view-model.ts`: the screens mark a stone's summary, the
  round overview and each adapted recommendation as written without the model,
  separately.

## Decisions made

- The version matrix is corrected first: `docs/README.md` and the service README
  both point readers there for runtime status.
- Where the pool size and pace comments rest on the `6.0` measurement, they say
  so and keep the value; re-deriving them for `7.0` needs a timed `7.0` round.
- The HTML pages write dates in Russian prose as «13 сентября»: an ISO date
  broke across lines at its hyphen in the rendered page.
- The artifact URLs are not written into the repository.

## Assumptions

- The prepayment is still depleted on 2026-09-17, as the owner stated that day;
  nothing in the repository can read the balance.

## Completed

- `44eda70` — scope 1–3: runtime status, call counts, the handoff, OpenAPI
  descriptions and the regenerated `public/openapi.json`, the local pipeline
  script's header and usage message.
- `690560f` — scope 4: `ai-analysis-run-mechanics.html` (sections 01–05, 07,
  the settings table, section 11), `ai-analysis-jobs.html` (the sequence
  diagram), `how-shalomut-works.html` (chapters 4, 5, 7, 8 and the glossary,
  with no exact figure).
- With this file — scope 5.

## In progress

- (none)

## Remaining

Owner:

- Land the branch (*Next concrete step*).
- Say whether to republish the three HTML documents now, or after the drift
  below is reconciled — `docs/open-decisions.md` item 22.
- Top up the prepayment and rotate `GEMINI_API_KEY` — items 26 and 1, unchanged.

Agent, if the owner wants the pages reconciled — drift found while reading,
not about `7.0`, not fixed here:

- `ai-analysis-run-mechanics.html`
  - Section 09, "пропускная способность" and "очередь без справедливости": one
    analysis at a time, one worker. `render.yaml` sets `AI_JOB_POOL_SIZE` to 3.
  - Section 09, "последняя миля", and section 11's diagram, caption and closing
    note: no notification, only a page reload. The dashboard watches an analysis
    in flight and announces the map that lands (`src/lib/hooks/use-ai-insights.ts`,
    `src/lib/dashboard/ai-insights-watch.ts`).
  - Section 09, "телеметрия в пустоту": observability lands in Core's Postgres
    since 2026-08-23 (`/api/observability`, `/api/health/observability`).
  - Section 09, "некому прочитать причину", and section 11's red mark for it:
    `ai-insights-client.ts` parses a failed run's `failureCode` and no component
    reads it, so this may still hold — re-read before changing.
  - Masthead "12 эндпоинтов на границе": `docs:endpoints:check` counts 14; not
    checked that both count the same boundary.
  - Section 09, the two endpoints nobody calls (the old webhook): not checked.
  - Settings table, "Темп, быстрая/тяжёлая модель" 60/30: both tiers point at
    the same model, so the effective pace is 30.
- `how-shalomut-works.html`
  - The director sets up and closes a round, raises the privacy threshold and
    asks for the analysis again (chapters 2, 3, 6 and 7): since 2026-08-23 a
    school user reads and every action on a round is the administrator's
    (`PROGRESS.md`).
  - Chapter 10, "заменить учебные пароли": sign-in on Production is Google since
    2026-08-21 (the handoff).
  - Chapter 10, the sleeping free-tier service and its five-minute pinger: not
    re-checked against the handoff's current hosting section.
- `ai-analysis-jobs.html`: the endpoint table, against the generated endpoint
  surface.

Agent, once a round has been analysed on `7.0` through the deployment: time it,
and re-derive the pool-size comments in `config.py`, `render.yaml` and
`.env.example` from that rate.

## Changed files

- `.env.example`, `ai-analytics-service/src/config.py`, `render.yaml` —
  comments only.
- `PROGRESS.md`, `PROJECT_CONTEXT.md`, `ai-analytics-service/README.md`,
  `docs/README.md`, `docs/ai-analysis-run-lifecycle.md`,
  `docs/ai-analytics-handoff.md`, `docs/ai-contract-version-matrix.md`,
  `docs/dashboard-semantic-contract.md`,
  `docs/dynamic-questionnaire-ai-contract.md`, `docs/openapi.yaml`,
  `public/openapi.json`, `docs/shalomut-tracker-handoff.md`,
  `docs/source-of-truth.md`, `docs/open-decisions.md`.
- `scripts/local-unlocked-pipeline.ts` — header comment and usage message.
- `docs/ai-analysis-run-mechanics.html`, `docs/ai-analysis-jobs.html`,
  `docs/how-shalomut-works.html`.
- This file.

## Verification evidence

### Passed

- The deployed health reads under *Context*.
- `AI_ANALYTICS_CONTRACT_VERSION=7.0 npx tsx scripts/local-unlocked-pipeline.ts`
  with no provider key: exit 0 — MCP contract `7.0`, 12 responses, threshold 10,
  not locked, 24 question aggregates; Python `success`, contract `7.0`, eight
  stones, each `deterministic_fallback`, `attempts 0`. With the variable unset:
  the usage message names `7.0`, exit 1.
- Comment-only, against `bfa9ea2`: `config.py` parses to an identical AST,
  `render.yaml` to identical YAML (`js-yaml`), and `.env.example`'s non-comment
  lines are identical.
- `npm run openapi:generate`, then `npm run openapi:check` — exit 0.
- `npm run verify:core` — exit 0, read from its own exit code with the output
  redirected to a file, `GEMINI_API_KEY` and `LLM_API_KEY` unset: sixteen gates,
  typecheck, `npm test` 1688/1688, `verify:ai` 639 passed, lint, build. It ran
  before the last prose edits: Russian date form and section 01 wording in the
  mechanics page, the figures taken out of the overview, item 22 of
  `open-decisions.md`.
- After those edits, on `690560f`: `npm run lint:doc-numbers` — exit 0, 26
  claims across 4 documents; `git diff --check` over both commits — clean.
- Browser pane, `python3 -m http.server` on `docs/`: in the mechanics page the
  edited SVG labels sit inside their `viewBox` by `getBBox()` («от 17 вызовов,»
  704–801 of 900, «предоплата у провайдера исчерпана» 418–646, the section 11
  caption 20–892) and the first overlaps nothing; section 11 and the settings
  table screenshotted. The jobs page's sequence diagram rendered with the new
  label and no mermaid error. The overview: five diagrams, no error, no
  horizontal overflow, chapter 4 screenshotted. The overview's last wording
  change (figures removed) was not re-walked.
- `git fetch origin main` — `origin/main` is still `bfa9ea2`.

### Failed

- (none)

### Blocked or not run

- `npm run docs:publish -- docs/<page>.html` for the three pages, as a dry run
  into `tmp/published/`: refused by the auto-mode permission classifier as a
  publication, not retried. Its tests (`lint:docs-publish`) passed inside
  `verify:core`.
- `verify:db`, `test:e2e`: no schema, SQL or screen change.
- The republish itself: approval gate.

### Environment

- Local, macOS; deployed reads anonymous and read-only.

### Residual risk

- The pool-size comments now say the value stands on the `6.0` rate; the `7.0`
  rate is unmeasured, so the comment is honest and the number is unproven.
- The three published artifacts still show their 2026-08-20 text until
  republished.

## Failed approaches

- `git grep ':!__tests__'` — "Unimplemented pathspec magic"; `:(exclude)…` works.
- An eval baseline path guessed from memory did not exist; no claim about the
  `7.0` baseline's reasoning setting was made.

## Known risks

- The push touches `render.yaml`, `ai-analytics-service/src/config.py` and
  `ai-analytics-service/README.md`, so Render rebuilds the AI service although
  only comments changed; Vercel redeploys Core as on every push.

## Approval gates

- Republishing the three HTML documents to their claude.ai artifacts.

## Questions requiring an owner decision

- Republish now, or reconcile the drift under *Remaining* first?

## Git state

Committed, not pushed: `44eda70`, `690560f` and the commit carrying this file,
on `docs/living-docs-catch-up-with-7-0`, whose upstream is `origin/main`
(`bfa9ea2`). Nothing staged or untracked besides; `next-env.d.ts` shows as
modified by the last Next command and is deliberately not committed. The
handoff is visible in this worktree and, once committed, to other worktrees of
this checkout; it reaches another machine only after the push.

## Next concrete step

The owner lands the branch:

    git push origin docs/living-docs-catch-up-with-7-0:main
