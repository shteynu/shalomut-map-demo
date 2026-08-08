# The first sign-in never leaves the login screen

## Metadata

- Branch: `fix/login-transition-stall`
- Base branch: `main`
- Base commit: `3ff449f`
- Current HEAD: see `git log -1`
- Status: implemented and verified locally; not pushed
- Last updated: 2026-08-08
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

The owner reported that the first sign-in spins on "מתחבר..." for a long time,
and that reloading `/login` and signing in again enters immediately. Find the
cause and fix it.

## User-visible outcome

A manager signs in once and lands on the home screen. No reload, no second
attempt. Measured at 592ms from click to rendered home screen where it
previously never arrived.

## Context

The report read as slowness — a cold start, a slow database. It is not. The
login API answers `200` in 46ms and the browser then stays on `/login/`
indefinitely.

`e2e/smoke.spec.ts` already contained the clue. Its `signIn` helper navigates to
the destination itself rather than waiting for the form's own transition, with a
comment saying that transition "does not settle reliably under test". That was
read at the time as the router being unfit to test. It was the product defect,
routed around.

## Scope

- `src/app/login/page.tsx` — the transition after a successful sign-in.
- `src/components/layout/manager-user-bar.tsx` — the same shape on sign-out.
- `src/lib/navigation.ts` — `resolveLoginRedirect`, because the fix turns
  `?next=` into a real document navigation.
- `e2e/login-transition.spec.ts` — the regression the smoke deliberately skips.

## Non-goals

- Rewriting the smoke's `signIn` helper. Its workaround is now unnecessary but
  harmless, and changing it would mix a test refactor into a bug fix.
- Anything about session shape, JWT verification or the Node 20 middleware bug
  fixed in `26209f3`. Different defect, same screen.

## Acceptance criteria

- A first sign-in in a fresh browser lands on the destination without a reload.
- `?next=` cannot send a just-authenticated manager to another host.
- `npm run verify:core` exit 0 and the full `e2e/` suite green.

## Relevant repository instructions

`AGENTS.md` (branch-scoped task state, verification proportional to risk),
`.agents/skills/shalomut-map/SKILL.md` (auth changes need explicit bounded
approval only for secrets/credentials/authentication *configuration* — this
changes neither), `.agents/skills/shalomut-verification/SKILL.md` (auth row:
unauthorized tests plus a security-focused diff review).

## Relevant architecture and contracts

None of the AI contract, persistence or privacy boundaries are touched. The
session cookie, its issuing route and the middleware are unchanged.

## Decisions made

- **The destination is reached by a document load, not `router.push`.** The
  reason is the root cause below: a client-side push can be served from a cache
  populated before the manager had a session. A document load also re-renders
  the root layout against the new cookie, which is what the `router.refresh()`
  beside the old push was reaching for.
- **The same change on sign-out**, mirrored: after the cookie is cleared the
  client router still holds every manager screen the session rendered, and
  `router.push` would leave that cache for the Back button to serve.
- **`?next=` is filtered.** It was already an open redirect via `router.push`;
  making the navigation a real one made it worth closing in the same change
  rather than leaving it as a separate finding.

## Assumptions

- The owner's report is about the deployed endpoint, but the defect reproduces
  against a local production build, so no deployed-specific cause is assumed.
  Deployed cold starts may well add seconds on top; they are not this bug.

## Completed

Root cause, fix, unit tests, e2e regression, full local verification.

## In progress

Nothing.

## Remaining

Push, then confirm on the deployed endpoint with a signed-in first attempt in a
fresh browser profile.

## Changed files

- `src/app/login/page.tsx`
- `src/components/layout/manager-user-bar.tsx`
- `src/lib/navigation.ts`
- `src/lib/__tests__/navigation.test.ts`
- `e2e/login-transition.spec.ts` (new)

## Root cause

The login screen's brand header is a `<Link href="/">`. Next prefetches it on
render — while the manager is still signed out. The middleware answers that
prefetch with a redirect back to `/login`, and the client router caches it.

When the cookie is then set, `router.push("/")` is served from that cache. It
issues no network request at all, and "navigates" to where it already is. The
form's `loading` state is never cleared on the success path, by design, because
the component is supposed to unmount — so the spinner runs forever.

Reloading `/login` was the owner's own workaround, and it explains the second
half of the report exactly: with the cookie present, the same prefetch returns
the real home screen, so the push finds a usable entry and lands instantly.

Evidence, from the reproduction run before the fix:

- `POST /api/auth/login` → `200` in 46ms.
- Then five `GET /login/?_rsc=…` — the `router.refresh()` re-fetching the page
  it was already on. No request for `/` ever.
- With `router.refresh()` removed, no request at all. That refuted the first
  hypothesis, a push/refresh race, and pointed at the cache.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0. 739 TypeScript tests, all five fitness
  checks, `typecheck`, ESLint, production build.
- `npx playwright test e2e/` — 6/6 green, including the two new cases.
  Before the fix the first-sign-in case timed out at 45s having made no request
  for the destination.
- `npx tsx --test src/app/api/auth/__tests__/auth-routes.test.ts` — 4/4.
- `npx tsx --test src/lib/__tests__/navigation.test.ts` — 20/20.
- Contrast check on the `impeccable` hook's `gray-on-color` finding in
  `login/page.tsx`: slate-600 on the brand surface `#f5e9c9` is 6.27:1 and on
  the page background `#fbf4dd` is 6.89:1. Both clear WCAG AA. Pre-existing and
  left unchanged.

### Failed

None.

### Blocked or not run

- `verify:db`, `verify:ai` and the Python suite — no schema, repository,
  contract or Python file is in the diff.
- The full mutation run — no mutated module is in the diff.
- The deployed endpoint — the fix is unpushed, and confirming it there needs the
  owner's own sign-in in a fresh browser profile.

### Environment

Local: production build on `127.0.0.1:3100` against the local development
database on `127.0.0.1:5433`, with the throwaway credentials
`playwright.config.ts` generates. No real secret was read.

### Residual risk

- The deployed endpoint may still feel slow on a first sign-in for an unrelated
  reason — Vercel cold start plus the first Supabase connection. That would now
  show as a slow-but-arriving landing rather than an endless spinner, and it is
  a different investigation.
- A document load costs a full page render where the old code intended a client
  transition. On this screen that is the right trade: it happens once per
  session, and it is the only way to be sure the new cookie is what rendered
  the destination.

## Failed approaches

- **Push/refresh race.** Removing `router.refresh()` and keeping
  `router.push(nextPath)` changed nothing: still no navigation, and now not even
  a network request. Recorded because it is the intuitive first guess and the
  experiment is cheap to redo.

## Known risks

None beyond the residual risk above.

## Approval gates

None. No secret, credential, authentication configuration or deployment alias
is touched; the session cookie, its route and the middleware are unchanged.

## Questions requiring an owner decision

None.

## Next concrete step

Push `git push origin fix/login-transition-stall:main`, then sign in on the
deployed endpoint in a **fresh** browser profile — the first attempt is the one
that used to hang — and record the result here.
