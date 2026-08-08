# The smoke waits for the sign-in form instead of stepping around it

## Metadata

- Branch: `test/smoke-waits-for-the-form`
- Base branch: `main`
- Base commit: `b29ce91`
- Current HEAD: see `git log -1`
- Status: implemented and verified locally; not pushed
- Last updated: 2026-08-08
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Remove the workaround in `e2e/smoke.spec.ts` that navigated to the destination
itself rather than waiting for the login form's own transition. It was added
because that transition looked flaky; `8d4af8d` showed it was broken.

## User-visible outcome

None. This is a test change.

## Context

`signIn` submitted the login form, then called `page.goto(destination)`. Its
comment attributed the unsettled transition to the client router being an
unsuitable thing to measure.

## Scope

`e2e/smoke.spec.ts` only, plus a correction to
`docs/shalomut-tracker-handoff.md`.

## Non-goals

- Moving the regression for `8d4af8d` into the smoke. It already exists in
  `e2e/login-transition.spec.ts` and belongs there — see the finding below.

## Acceptance criteria

- The smoke waits for the form's transition and stays green.
- Any claim about what this catches is checked, not assumed.

## Decisions made

- **`signIn` drives the round trip through `?next=`.** That is the parameter
  the middleware itself writes when it turns an unauthenticated request away,
  so the deep-link path is exercised rather than a shortcut past it.
- **The destination is compared without its trailing slash.** `trailingSlash`
  is on, so `/round` arrives as `/round/`; hard-coding the served form would
  make the helper break on a config change that is not its subject.
- **The regression for the sign-in bug stays in `login-transition.spec.ts`.**
  Duplicating it in the smoke would add runtime and no coverage.

## Completed

The change, the verification, and a correction to a claim made yesterday.

## In progress

Nothing.

## Remaining

Push.

## Changed files

- `e2e/smoke.spec.ts`
- `docs/shalomut-tracker-handoff.md`

## Finding: the workaround did not hide the bug it was thought to hide

Both the `8d4af8d` commit message and the handoff entry written with it said
the smoke's workaround stood between the suite and the sign-in defect. That was
asserted, not measured. Measured now, by removing the workaround and running
the smoke against the pre-fix login page: **it still passes, 4/4.**

The reason is specific and worth keeping. The defect needed the destination to
be a route the login screen had already prefetched while signed out — `/`, via
the brand link in its header. The smoke signs in towards `/round` and
`/dashboard`, neither of which is prefetched there, so `router.push` made a
real request and arrived. Only a sign-in with no `?next=` reproduces it, which
is exactly what `login-transition.spec.ts` does.

So the workaround hid a wrong diagnosis rather than a defect. That is still
worth removing — a comment that blames the router teaches the next reader the
wrong thing — but the coverage this buys is the `?next=` deep-link path, not
the cache bug. The handoff entry is corrected in this branch.

## Verification evidence

### Passed

- `npx playwright test e2e/` — 6/6 green with the workaround removed.
- **The negative check**, which is the point of this branch: the login page was
  temporarily reverted to `router.push` + `router.refresh()`, rebuilt, and
  `npx playwright test e2e/smoke.spec.ts` ran **4/4 green** — proving the smoke
  does not guard `8d4af8d` even without its workaround. The login page was
  restored from a copy taken before the experiment and `git diff src/` is
  empty, so nothing of that experiment is in the diff.
- `npm run verify:core` — exit 0.

### Failed

None.

### Blocked or not run

- `verify:db`, `verify:ai`, Python, mutation — nothing in the diff touches
  them.

### Environment

Local: production build on `127.0.0.1:3100` against the local development
database, with the throwaway credentials `playwright.config.ts` generates.

### Residual risk

The smoke's sign-in now depends on `?next=` being honoured. If that parameter
is ever dropped, four smoke tests fail together and the cause will read as
"sign-in broken" rather than "the parameter changed". Acceptable: the failure
is loud and the helper names the parameter.

## Failed approaches

- Claiming coverage without checking it. The first version of this change
  carried a comment and a commit message saying the smoke now guards the
  sign-in fix. The negative check refuted it before it was pushed.

## Known risks

None.

## Approval gates

None.

## Questions requiring an owner decision

None.

## Next concrete step

Push `git push origin test/smoke-waits-for-the-form:main`.
