# Privacy-threshold next-step states

## Metadata

- Branch: `feat/threshold-next-step-copy`
- Base branch: `main`
- Base commit: `1b5e54a`
- Current branch tip: `0be636c`
- Status: merged into `main`, combined gate passed and published
- Last updated: 2026-08-02
- Last agent/tool: Codex

## Objective

Make the manager-facing next step explicit when a survey round approaches or
reaches its privacy threshold, using the durable AI run lifecycle as the source
of truth.

## User-visible outcome

The round flow distinguishes waiting for more responses, analysis queued or
running, a ready map, and a recoverable missing/failed analysis without
claiming that closing the round is what starts analysis.

## Context

- Product behaviour backlog item 6 remains open.
- Durable AI runs now use `queued`, `running`, `succeeded`, and `failed`.
- The current round page always says the map appears after closing the round,
  while automatic analysis is enqueued when the privacy threshold is reached.

## Scope

- Manager-facing threshold/analysis next-step copy on the round flow.
- Reuse the persisted durable-run/result state; do not infer success only from
  response count.
- RTL/WCAG-aware rendering and focused tests for every state.

## Non-goals

- Changing the privacy threshold, scoring, AI contracts, provider behavior,
  persistence schema, deployments, secrets, aliases, or manager authorization.
- Implementing tracked goals or the other product-behaviour backlog items.

## Acceptance criteria

- Below threshold: the manager sees how many responses remain and that results
  stay locked.
- At or above threshold with `queued`/`running`: the manager sees that analysis
  starts automatically and results may take a few minutes.
- With a readable successful result: the manager sees that the map is ready.
- With a failed or missing result: the copy gives an accurate recovery action.
- Existing privacy and empty-runtime behavior remain unchanged.
- Focused tests cover the distinct states and accessible status semantics.

## Relevant repository instructions

- `.agents/skills/shalomut-tracker/SKILL.md`
- `.agents/skills/shalomut-map/SKILL.md`
- `.agents/skills/shalomut-verification/SKILL.md`

## Relevant architecture and contracts

- `docs/source-of-truth.md` AI Analysis Triggering section.
- `docs/product-behaviour-backlog.md` item 6.
- Durable run states are persisted and exposed through the existing AI
  insights boundary.

## Decisions made

- Prefer exact lifecycle state over a threshold-only success message.

## Assumptions

- This is a code/UI task only and needs no deployment or credential mutation.

## Completed

- Established branch and task scope from current `main`.
- Added a manager-facing next-step component backed by the existing
  `useAiInsights` lifecycle boundary.
- Covered below-threshold, loading, running, ready, question-level locked,
  missing and failed states with localized Hebrew copy and exact actions.
- Replaced the misleading claim that closing a round starts the map.
- Added semantic `h2`/live-region structure, reduced-motion spinner behavior
  and warm state-specific surfaces.
- Connected recoverable states to the existing refresh-analysis button and
  ready/running states to the Dashboard.
- Marked product-behaviour backlog item 6 complete.
- Applied the sole pending migration
  `20260730150000_add_ai_analysis_runs` to the confirmed local Postgres at
  `127.0.0.1:5433` so runtime lifecycle verification could run. No deployed
  environment was touched.

## In progress

- No implementation work remains.

## Remaining

- None for this task.

## Changed files

- `docs/agent-tasks/active/feat--threshold-next-step-copy.md` — task state.
- `docs/product-behaviour-backlog.md` — item 6 completion state.
- `docs/shalomut-tracker-handoff.md` — exact local/deployed migration boundary
  observed during browser verification.
- `src/app/globals.css` — state surfaces, responsive copy layout and
  reduced-motion spinner behavior.
- `src/app/round/page.tsx` — lifecycle-aware next-step integration.
- `src/components/round/index.ts` — component export.
- `src/components/round/round-controls.tsx` — accessible recovery anchor
  target.
- `src/components/round/round-threshold-next-step.tsx` — lifecycle-aware UI.
- `src/components/round/__tests__/round-threshold-next-step.test.tsx` — seven
  focused regression tests.
- `next-env.d.ts` — pre-existing user-owned generated diff; unrelated and must
  remain untouched.

## Current Git state

- Branch tip: `0be636c`; implementation commit `f539d89` plus task archive
  commit are included in published `main`.
- Staged: none.
- Unstaged unrelated user file: `next-env.d.ts`.
- Untracked task files: none.

## Verification evidence

### Passed

- `node --import tsx --test src/components/round/__tests__/round-threshold-next-step.test.tsx`
  — 7/7 passed after fail-first implementation.
- `npm run typecheck` — passed after Prisma generation and Next route typegen.
- `npm test` — 314/314 TypeScript tests passed.
- `npm run lint` — passed.
- `npm run build` — production build passed; 41 routes/pages generated.
- `git diff --check` — passed.
- Local Playwright on authenticated `/round/`:
  - real persisted provider-failure payload rendered localized recovery copy;
  - mocked valid persisted payload rendered `המפה מוכנה` and Dashboard link;
  - mocked durable `running` state rendered automatic-analysis copy;
  - desktop `1440x1000` and mobile `390x844` layouts were visually inspected;
  - document and component computed direction were RTL;
  - with `prefers-reduced-motion: reduce`, spinner animation computed to
    `none`.
- `npm run db:migrate:deploy` — applied only
  `20260730150000_add_ai_analysis_runs` to local `127.0.0.1:5433`; subsequent
  worker polls returned `204` instead of the pre-migration `P2021` error.
- `npm run db:status` — confirmed all seven migrations are applied to the local
  `shalomut` database.

### Failed

- No unresolved failures. Initial typecheck exposed invalid `null` fields in
  the new test fixture and was fixed. Initial browser smoke exposed the local
  database's pending AI-run migration and was repeated after applying it.

### Blocked or not run

- Deployed/preview smoke was not run; no deployment is in scope.
- A browser below-threshold database scenario was not created because it would
  mutate the seeded round; below-threshold and singular-response copy are
  covered by fail-first static component tests.

### Environment

- Primary local worktree on macOS; branch created from `main` at `1b5e54a`.
- Browser runtime used local Core `:3000`, AI service `:8000` and local
  PostgreSQL `127.0.0.1:5433`; services were stopped after verification.

### Residual risk

- The round next-step state refreshes on page load; it does not poll a running
  job automatically. The linked Dashboard retains its existing manual status
  recheck.
- Below-threshold browser layout was not exercised against persisted data.

## Failed approaches

- Fail-first test initially could not import the not-yet-created component, as
  expected.
- Initial browser runtime could not read durable jobs because the local DB was
  one migration behind; confirmed the loopback target and applied the pending
  migration before repeating the smoke.

## Known risks

- Copy based only on response count could falsely claim analysis is ready.

## Approval gates

- No deployment, secret, credential, alias, authentication configuration, or
  external data mutation is in scope.
- Commit and push remain owner-authorized actions. No commit or push was made.

## Questions requiring an owner decision

- None currently.

## Next concrete step

Select the next independently deliverable product-backlog task.
