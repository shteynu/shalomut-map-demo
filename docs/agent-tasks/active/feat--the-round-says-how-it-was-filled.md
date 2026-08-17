# The round says how it was filled

## Metadata

- Branch: `feat/the-round-says-how-it-was-filled`
- Base branch: `feat/how-long-a-round-took-to-fill` (task B), at `01a0bc7`
- Base commit: `01a0bc7`
- Current HEAD: `74dde0a` plus this task-file commit; eight commits ahead of
  `origin/main`, of which four belong to task B. Nothing pushed.
- Status: implemented and verified locally; awaiting the owner's push
- Last updated: 2026-08-17
- Last agent/tool: Claude Code (Opus 5)

## Objective

Put the filling report on `/round`: a panel that says how long the round's
questionnaires took against the estimate the questionnaire gave, in the warm
design language, with the states that are not "ready" rendered as answers rather
than as failures.

## User-visible outcome

A manager opening the round screen reads how the collection went — the
questionnaire's own estimate, the middle session's length, and how many came
back faster than the instrument can be read. And reads, in the same panel, that
the product will not remove any of them, and why.

## Context

Task C of
[`response-quality-plan-2026-08-17.md`](../../response-quality-plan-2026-08-17.md).
Stacked on task B's branch, so landing this lands both. `PROJECT_CONTEXT.md`
ADR-022 owns what this panel is allowed to say and is on the base branch, not on
`main`.

## Scope

- A server-side loader beside `loadRoundFunnel`.
- A `RoundFilling` component, RTL-first, WCAG AA, status never by colour alone.
- Its place on `/round`.
- Styles grouped with the funnel's rather than duplicated.
- Component tests through `renderToStaticMarkup`.

## Non-goals

- No API route. `/round` is a server component and the funnel loads the same way.
- No exclusion control, no per-response row, no individual duration.
- No change to task B's service or module.

## Acceptance criteria

- All four states render something a manager can act on. — **met**; all four
  were rendered and looked at, not only asserted.
- No string implies a respondent may be removed, and none says "spent". — **met**;
  the panel says removal is not offered and why, and a test asserts no state
  renders a `<button>` or `<input>`.
- A round where nobody was fast says so plainly. — **met**, and it is the first
  state in the visual check.
- Nothing carries meaning by colour alone. — **met**; every figure has an icon
  and a label, and no state uses colour to signal.
- `npm run verify:core` passes. — **met**, exit 0.

## Relevant repository instructions

- `AGENTS.md` — never expose respondent identity or detailed results below the
  configured privacy threshold.
- `.agents/skills/shalomut-map/SKILL.md` — RTL-first, warm tokens, first-class
  empty/loading/error/privacy-locked states.
- `.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

- `RoundFunnel` is the nearest neighbour and the styles are now shared with it.
- `loadRoundFunnel` in `src/lib/server/manager-context.ts` is the loader shape.
- `RoundFillingService.getRoundFilling` returns `no-questionnaire`,
  `below-privacy-threshold` or `ready`.

## Decisions made

1. **No API route.** The page is a server component and the funnel already loads
   this way; a route would be a second door onto the same numbers with its own
   authorization to keep correct.
2. **The loader takes the round, not its id.** The service needs the stored
   questionnaire and the threshold from it, and passing the round means the
   caller is holding one from the manager's own context — which is what keeps
   this from becoming a way to read another school's collection.
3. **The two reads run in `Promise.all`.** They are independent and both only
   wanted by this screen.
4. **Styles are grouped selectors, not copied values.** `.round-funnel` and
   `.round-filling` share every rule except the funnel's timestamp line, with a
   comment saying so, because the two panels sit together and a manager reads
   them as one thing.
5. **A withheld count is written in words.** See Failed approaches — `< 3` is a
   defect in RTL, not a style preference.
6. **Every fast sentence names its denominator.** Also from looking at it: "no
   questionnaire came back too fast" read identically over two measured sessions
   and over two hundred.

## Assumptions

- The panel appears as soon as the round's privacy threshold is met, closed or
  not. That is what the service gates on and what the owner asked for on
  2026-08-17.

## Completed

1. `8ae1962` — `loadRoundFilling`, the `RoundFilling` component with its four
   states, its place on `/round`, the grouped styles, and 14 component tests.
   Both browser-found defects are in this commit.
2. `74dde0a` — `docs/source-of-truth.md` gains a "How a Round Was Filled"
   section; `PROGRESS.md` gains the milestone beside the funnel's.

`docs/dashboard-semantic-contract.md` was inspected and needed nothing — it
describes the AI contract, not the round screen. No OpenAPI change: no route was
added.

## In progress

Nothing.

## Remaining

Nothing in scope. The response-quality plan's remaining tasks are D (per-step
timing, which the plan argues against and which waits on an owner decision) and
E (attention-check items, which waits on the methodologist).

## Changed files

Two commits of this task; eight on the branch, four of them task B's.

- New: `src/components/round/round-filling.tsx`,
  `src/components/round/__tests__/round-filling.test.tsx`, and this file.
- Edited: `src/app/round/page.tsx`, `src/app/globals.css`,
  `src/components/round/index.ts`, `src/lib/server/manager-context.ts`,
  `docs/source-of-truth.md`, `PROGRESS.md`.

`next-env.d.ts` carries a pre-existing unstaged modification that predates this
branch and was deliberately left uncommitted. `.claude/launch.json` gained a
`signed-in-walk-local-org` configuration; it is gitignored and therefore local
to this machine.

## Verification evidence

### Passed

- `npm run verify:core`, exit 0, at `74dde0a`: **1119 tests, 1119 pass, 0 fail**
  across 18 suites, plus typecheck, eslint, the production build and all eight
  lint gates. Task B's branch was 1105; the 14 added here are the component
  tests.
- **The panel was looked at, in a browser, at 1280×900 and at 800px.** All seven
  renderings of the four states were built from the real component and the real
  built stylesheet and read on screen: the three-column grid, its collapse to
  one column under the 860px query, RTL order (estimate on the right, fast count
  on the left), the navy figures, and every sentence in place.
- Two of the seven states were built from the local database as it actually
  stands, not invented: the round with 21 responses and 9 measurable sessions,
  and the other organization's round with 41 responses and no attempt rows at
  all. Both were read out of PostgreSQL first.

### Failed

Two defects, both found by looking and neither reachable by the markup tests
that were already passing. Both fixed in `8ae1962`, both now covered:

- **`< 3` rendered as `3 >`.** `<` is bidi-neutral, so on an RTL line it
  reorders past the digit and the tile claimed the opposite of what it meant.
  Written in words now; a test asserts the `<` does not return.
- **The zero-fast sentence had no denominator.** "No questionnaire came back too
  fast" read the same over two measured sessions as over two hundred — and a
  round whose answers mostly predate this measurement is exactly where it
  sounded most reassuring and meant least. Every fast sentence now names how
  many sessions it was computed over.

### Blocked or not run

- **The panel was not walked inside the product.** `/round` is behind `/login`,
  and signing in means typing a password, which is the owner's to do. What was
  verified instead is the component rendered with the real built stylesheet — it
  covers layout, RTL, the grid and every string, and does not cover the page
  around it: the panel's position relative to the funnel and the next-step card,
  and its behaviour on a real round loaded through `loadRoundFilling`. A
  `signed-in-walk-local-org` launch configuration on port 3211 is left ready for
  whoever does walk it; the round to open is `round_local_1786790341143` in
  `local-dev-organization`.
- **e2e (Playwright): not run.** Not part of `verify:core`; no spec covers the
  round screen's panels.
- **The database integration suite: not run.** No migration and no repository
  method were added.

### Environment

Local worktree, a local production build, and the local database at
`127.0.0.1:5433` read twice — once to list rounds, once to compute the join by
hand so the rendered states would match real data. No writes. Nothing deployed.

### Residual risk

- The one-third boundary is still judgement no real distribution has checked;
  the local data is seeded and every measurable session in it is about eight
  seconds long, so it exercises the "fast" branch and proves nothing about where
  the boundary belongs.
- The panel is rendered for every round the manager opens, including drafts,
  where it says it is waiting for responses. That is correct but adds a fourth
  block to a screen that already has three; whether it belongs above or below
  the next-step card is a judgement nobody has seen in context yet.

## Failed approaches

- **`< 3` in the withheld tile.** A mathematical comparison in an RTL line is
  not a mathematical comparison — the bidi algorithm moves the neutral `<` to
  the other side of the digit. The lesson generalises: any Latin operator or
  bracket placed beside a number in this product's UI has to be read on screen
  before it is trusted, and no assertion over `renderToStaticMarkup` output can
  substitute for that, because the markup is correct and the rendering is not.

## Known risks

- This branch is stacked on an unpushed one. Pushing this branch alone would
  carry task B with it, which is intended; pushing task B alone and then
  rebasing this one is the alternative and nobody has asked for it.

## Approval gates

- **Push is the owner's.** Eight commits with no upstream. No secrets,
  credentials, authentication configuration or deployment alias was touched.

## Questions requiring an owner decision

- Where the panel belongs on the round screen. It currently sits between the
  funnel and the next-step card; that was chosen because the two panels are
  about the same collection, and it has not been seen in a signed-in session.
- `FAST_FILLING_FRACTION` is a third of the estimate, still unchecked against a
  real distribution.

## Next concrete step

Hand the push over to the owner:

```bash
git push origin feat/the-round-says-how-it-was-filled
```

Then walk `/round` signed in — `npm run build` is already done, the
`signed-in-walk-local-org` launch configuration serves it on port 3211, and
`round_local_1786790341143` is the round with measurable sessions. The one
thing to look at that no test covers is where the panel sits among the three
blocks already on that screen.
