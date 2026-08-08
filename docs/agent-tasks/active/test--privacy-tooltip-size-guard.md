# A standing guard against tooltip text at headline size

## Metadata

- Branch: `test/privacy-tooltip-size-guard`
- Base branch: `main`
- Base commit: `fa370c5`
- Current HEAD: the branch tip; this file and the test are one commit.
- Status: implementation complete, verified locally, not yet pushed.
- Last updated: 2026-08-08
- Last agent/tool: Claude Opus 5, Claude Code

## Objective

Turn the throwaway check that caught the privacy tooltip bug into the seventh
end-to-end test, so the cascade cannot quietly do it again.

## User-visible outcome

None directly. What changes is that a future edit which lets an outside rule win
over `.custom-tooltip-content` fails the suite instead of reaching the endpoint
and waiting for someone to look at the screen.

## Context

`5ffdd91` fixed the privacy tooltip's three bullet lead-ins rendering at 46.4px
on the home screen. The bug shipped with the component and survived a refactor
of that very component, because the check written at the time asserted five
hand-picked elements and none of them were the broken three. The owner asked for
the replacement check — enumerate every text node, fail on the worst — to become
permanent. Its history is in
`docs/agent-tasks/archive/fix--privacy-tooltip-bullet-size.md`.

## Scope

One test added to `e2e/smoke.spec.ts`. No product code, no configuration.

## Non-goals

- A visual-regression or screenshot-diff harness. This asserts one property, in
  numbers, with a message that names the cause.
- Pinning the tooltip's exact type scale. See the decision below.

## Acceptance criteria

- The new test passes against the current `main`.
- It fails, for the right reason, when the rule that fixes the bug is removed.
- The other six keep passing.

## Decisions made

- **Placed in `e2e/smoke.spec.ts` rather than a file of its own.** It needs the
  `signIn` helper that lives there and is not exported; a new file would have
  meant extracting the helper, which is a bigger diff than the test.
- **The ceiling is 17px, not the exact design sizes.** The tooltip's title is
  1.05rem and its body 0.84rem, and a designer may move either. What may never
  happen again is a line of this panel rendering at headline size. Pinning exact
  values would fail on every deliberate typography change, which is how a guard
  gets deleted.
- **The panel's viewport check is horizontal only.** Measured: the panel is
  370.7x385.1 anchored below a stone partway down the home screen, so in the
  720px-tall Desktop Chrome viewport its foot sits at 798px — below the fold,
  where the reader scrolls to it. Sideways is a real failure: the panel centres
  on its trigger and nothing scrolls it back.
- **The test also asserts `.stat-stone > strong` stays above 30px.** Without it,
  a change that quieted the tooltip by quieting the stone's own 2.9rem number
  would pass — a worse bug than the one being guarded.

## Assumptions

- The local development database holds an active round, so `/` renders the stat
  stones rather than the onboarding screen. The existing share-link test already
  depends on that.

## Completed

Everything in scope.

## Remaining

Nothing.

## Changed files

- `e2e/smoke.spec.ts` — one test, `the privacy tooltip reads as prose, and the
  stone it sits on still shouts`.

## Verification evidence

### Passed

- `npx playwright test e2e/` — **7/7**, against a production build on the
  run's own server (port 3100) and the local development database.
- **The test was proved to fail without the fix.** With
  `.custom-tooltip-content .privacy-tooltip-reasons strong { font-size: 0.88rem }`
  removed from `globals.css` and the application rebuilt, it failed on exactly
  the three bullet lead-ins at `"px": 46.4`, with the message naming the
  cascade. `globals.css` was then restored (`git diff` on it is empty) and
  rebuilt.
- `npm run verify:core` exit 0 — 739 TypeScript tests, 0 fail, all five fitness
  checks, typecheck, ESLint and the production build.

### Failed

- The first draft asserted the panel was inside the viewport in both axes and
  failed on the vertical bound. That was the test being wrong, not the product;
  see the decision above.

### Blocked or not run

- `verify:db`, `verify:ai`, the Python suite and the mutation run. The diff is
  one Playwright test: no schema, repository, contract, Python or mutated
  module is in it.
- Not run in CI yet, and not observable on the deployed endpoint — a test does
  not deploy.

### Environment

Local. Playwright starts its own `next start` on port 3100 with throwaway
credentials from `playwright.config.ts`; the run reads the database and writes
nothing.

### Residual risk

Low. The test is read-only and additive. The one way it can turn noisy is if a
round stops existing locally, in which case `/` shows onboarding and the trigger
is absent — the same dependency the share-link test already has, and it fails
loudly rather than passing empty.

## Known risks

None beyond the above.

## Approval gates

None. Only `git push` remains an owner action.

## Questions requiring an owner decision

None. The question this task existed to answer was answered: yes.

## Next concrete step

Owner runs `git push origin test/privacy-tooltip-size-guard:main`. Then this
file is archived.
