# Phase 5 — the session gets short

## Metadata

- Branch: `feat/the-session-gets-short`
- Base branch: `feat/a-school-gets-its-person` (one unpushed docs commit above `origin/main`)
- Base commit: `f2b8653`
- Current HEAD: `85d5676`
- Status: implemented and verified locally; unpushed
- Last updated: 2026-08-21
- Last agent/tool: Claude Opus 5 / Claude Code

## Objective

Phase 5 of
[`multi-tenancy-plan-2026-08-20.md`](../../multi-tenancy-plan-2026-08-20.md):
turn the 24-hour stateless session into a short one that is renewed while the
manager is working, and make renewal the moment the database is re-read. Until
this lands, revoking somebody's access means "from their next sign-in" — the
phase 2 walk watched a revoked person keep reading their school on a token
minted before the revocation.

## User-visible outcome

A manager who is working notices nothing. A manager who walks away for a quarter
of an hour signs in again. A manager whose membership was revoked, whose account
was suspended, or whose administrator flag was taken away stops being able to
read anything within fifteen minutes rather than within a day — and immediately
at their next renewal.

## Context

Three places mint a session today, each with its own `86400`:
`src/app/api/auth/login/route.ts:111`, `src/app/api/auth/oidc/callback/route.ts:148`,
and `src/lib/auth/membership-service.ts:25` (school switching, which reuses the
provider default in `src/lib/auth/jwt-session-provider.ts:91`). `revokeSession()`
is a documented no-op, and its own comment names short TTL as the way out.

## Scope

- One source for both numbers, and no `86400` literals left behind.
- An absolute deadline claim in the token, carried across renewals unchanged.
- A renewal endpoint that re-reads `managers` and `organization_memberships`
  from the database and refuses a session that no longer deserves to exist.
- A client renewal that fires on the manager's own activity, not on a timer.
- Tests for each refusal, and for the deadline surviving renewal.

## Non-goals

- Phase 4 (what an administrator can see about every school).
- Phase 6 (what a school user may not do) — deliberately deferred by the owner.
- A server-side token blacklist. A fifteen-minute window plus a database re-read
  at renewal is what the owner asked for; a revocation list is a different
  design and is not needed to make revocation bite.
- Changing anything about the OIDC handshake itself.

## Acceptance criteria

- A token minted anywhere expires in 15 minutes and carries a 12-hour deadline.
- Renewal past the deadline is refused, however active the manager has been.
- Renewal by a manager whose membership went `suspended` is refused, and the
  cookie is cleared.
- A manager who keeps working is never signed out inside the 12 hours.
- `npm test`, `typecheck`, `lint`, `build` and `lint:composition` all pass.

## Relevant repository instructions

- `AGENTS.md` — branch-scoped task state, mandatory progress handoff.
- `.agents/skills/shalomut-map/SKILL.md` — `Канонические границы`: repositories
  are resolved only from entrypoints, checked by `npm run lint:composition`.
- `.agents/skills/shalomut-verification/SKILL.md` — before claiming completion.

## Relevant architecture and contracts

- `ISessionProvider` (`src/lib/auth/domain-contract.ts:43`) is the contract both
  the real provider and the in-file stub implement.
- The middleware (`src/middleware.ts`) is the read chokepoint and verifies the
  token on every manager request. It is **not** a place a database read may
  happen — see the decision below.

## Decisions made

- **15-minute sliding session, renewed by the manager's own requests, under a
  12-hour absolute cap.** Owner decision, 2026-08-21, taken over a
  heartbeat-while-the-tab-is-open variant (which would have removed idle logout
  entirely) and over a 60-minute window (which would have weakened the thing
  phase 5 exists for). The plan asked for this number to be picked against how a
  manager actually works.
- **Renewal is a route handler, not the middleware.** The middleware is the one
  place that both sees every page navigation and can set a cookie, which makes
  it the obvious home — and it is ruled out by the repository's own composition
  rule: `resolveCoreRepositories()` is called only from a route handler, a
  server-component context loader, a script or a test, and `lint:composition`
  enforces it. A server component cannot set a cookie in Next 16 either. So the
  database re-read lives in `POST /api/auth/session/renew` and the client asks
  for it.
- **A token with no absolute-deadline claim is refused.** The safe reading of
  silence, matching how `adm` is read in the same payload. The cost is that
  every session alive when this deploys signs in again once; there is one
  deployed manager account today.

## Assumptions

- A manager reading the map has JavaScript running — it is an interactive React
  screen, so activity-driven renewal reaches the reading case that a
  navigation-only trigger would miss.

## Completed

All of Scope, in `85d5676`.

- `src/lib/auth/session-lifetime.ts` — 15 minutes, a 12-hour cap, the 5-minute
  renewal interval, and the two helpers that derive a deadline and clamp a
  window to it. No `86400` survives anywhere.
- The absolute deadline is an `abs` claim, minted by both session providers,
  enforced in `verifyToken`, and carried unchanged through renewal and through
  `MembershipService.switchActiveOrganization`.
- `SessionRenewalService` — the database re-read, with four refusals:
  `SESSION_EXPIRED`, `USER_NOT_FOUND`, `NO_ACTIVE_MEMBERSHIP`, `SCHOOL_REVOKED`.
- `POST /api/auth/session/renew` and the `SessionRenewal` client component in the
  root layout, gated by `shouldRenewSession`.
- `setSessionCookie` / `clearSessionCookie` in `session-auth.ts`, replacing three
  hand-written cookie blocks.
- `PROJECT_CONTEXT.md` ADR-028, the corrected revocation sentence beside ADR-027,
  and the doc comment on the membership route that said phase 5 had not happened.

## In progress

- Nothing.

## Remaining

- The owner pushes both branches. Nothing else in this task is unfinished.

## Changed files

See `git show --stat 85d5676`. Twenty files: six new, fourteen modified, of which
four are existing test files adjusted for the `SessionMintOptions` signature and
the new required `ManagerSession.absoluteExpiresAt`.

## Verification evidence

### Passed

- **The suite, on this branch at `85d5676`.** `npm test` 1333 passed / 0 failed,
  up from 1319 — the fourteen are `short-session.test.ts`. `npm run typecheck`,
  `npm run lint` and `npm run build` clean; `lint:composition`,
  `lint:doc-numbers`, `lint:literals`, `lint:skills`, `openapi:check` and
  `docs:endpoints:check` all pass. The build lists `ƒ /api/auth/session/renew`.
- **A signed-in local walk, `next dev` on :3000 against the local Docker
  database.** In order, from the server log:
  - A session cookie left in the browser from before this change was refused —
    `[auth] a manager session cookie was rejected`. That is the `abs` check
    doing what it is for, observed rather than argued.
  - Signing in as `admin@shalomut.edu.il` gave `POST /api/auth/login/ 200`,
    then `POST /api/auth/session/renew/ 200`, and the home screen rendered
    signed in.
  - Navigating to `/dashboard` renewed again — the reason the component sits in
    the root layout rather than the header, which that screen does not render.
  - `/answer/NOSUCHCODE` made **no** renewal request. The respondent's screen
    has no session and does not ask about one.
- **The defect this walk found, and its fix.** Before the fix the same walk read
  `[auth] a session was not renewed for manager mgr-admin-001: USER_NOT_FOUND`
  followed by `POST /api/auth/session/renew/ 401` and a bounce to `/login`:
  signing in worked and renewal immediately undid it. The password door's
  managers are constants in `manager-auth-service.ts` with no rows, and the
  deployed endpoint is on that door. Renewal now asks the directory the
  runtime's configuration says is live, and two tests pin both halves.

### Failed

- None outstanding. The `USER_NOT_FOUND` bounce above is recorded because it was
  a real defect in this branch's own work, found by walking rather than by
  testing, and fixed in the same commit.

### Blocked or not run

- **Nothing was verified on the deployed endpoint**, because this branch is
  unpushed and `git push` is the owner's action here.
- The idle expiry itself was not waited out — no walk sat still for fifteen
  minutes. The arithmetic is covered by tests; the browser evidence covers
  renewal, not expiry.
- `verify:core` was not run whole. `verify:ai`, `lint:interpreter`,
  `lint:mutation-config`, `lint:contract-refusals` and `lint:fixtures` were not
  run: nothing here touches the AI contract or the Python service.

### Environment

- Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`,
  local Docker PostgreSQL on `127.0.0.1:5433`, `next dev` on :3000.
- The deployed database write recorded below targeted Supabase
  `aws-1-ap-northeast-2` via `.env.deployed.local`, confirmed by the host Prisma
  printed. It preceded this branch and is not part of its diff.

### Residual risk

- **Deploying this signs everybody out once.** A token without the `abs` claim is
  refused. Intended, stated here so it is not read as a defect.
- **One window stays open.** A token already in a revoked person's browser is
  valid until it expires — at most fifteen minutes. Closing it needs a
  revocation list, which is a different design and was not asked for.
- The renewal is a database read on the manager's path, throttled to one per
  five minutes per tab. A hard document load resets that throttle, so a manager
  reloading repeatedly costs one read per load.

## Failed approaches

- **Renewal in the middleware**, which is where it belongs by every other
  measure: it sees every page navigation, including the ones no client component
  would catch, and it is the only place that can set a cookie on one. Abandoned
  before it was written, on two independent grounds — this repository's
  composition rule forbids resolving repositories outside a route handler, a
  server-component context loader, a script or a test (`lint:composition`
  enforces it), and Next 16 middleware runs on the Edge runtime where the Prisma
  client cannot go. A server component was the other candidate and cannot set a
  cookie. Recorded so the next reader does not spend the same hour on it.

## Known risks

- The renewal endpoint is a database read on the manager's path. It is bounded
  by a throttle rather than fired per request, because the database is in Seoul
  and the functions are in Washington — roughly 180 ms each time.

## Approval gates

- **The Google OAuth client remains the owner's to create** and falls under the
  standing gate on authentication configuration. The deployment keeps its
  password screen until `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`
  and `OIDC_REDIRECT_URI` are set. Phase 5 does not depend on it.
- `git push` is the owner's action in this environment.

## Questions requiring an owner decision

- None open. The interval question was asked and answered on 2026-08-21.

## Next concrete step

Hand `git push origin feat/the-session-gets-short` to the owner — the branch
carries `f2b8653` beneath it, so pushing it lands both. Then read
`GET /api/health/` once Vercel has rebuilt, and sign in on the deployed endpoint
once: it is on the password door this branch fixed, and that path has been
verified locally but never there.
