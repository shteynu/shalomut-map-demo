# A school user reads; every action on a round is the administrator's

## Metadata

- Branch: `feat/a-school-user-may-only-read`
- Base branch: `main`
- Base commit: `124f661`
- Current HEAD: see **Exact Git state** — three commits above `124f661`
- Status: implementation and documentation complete, verified, uncommitted
- Last updated: 2026-08-23
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close phase 6 of `docs/multi-tenancy-plan-2026-08-20.md`, which had been recorded
on 2026-08-20 as deliberately undecided. The owner decided its content on
2026-08-23:

> Пользователь школы не может создавать опросник и запускать и анализировать
> раунд, только администратор может это. Все действия с раундом может делать
> только администратор.

Asked separately, the owner confirmed that round **goals**, **reset** and the
**AI question suggestion** are administrator-only as well, and that the tab
holding round creation/editing/archiving/deleting should be **hidden** from a
school user rather than shown disabled.

## User-visible outcome

Signed in as a school user (`manager` role):

- Four navigation tabs instead of seven. `setup`, `surveyBuilder` and `goals`
  are gone, and visiting their URLs directly redirects to the home screen.
- The home screen offers three action cards instead of six, and its primary
  button is "פתיחת המפה" rather than the setup screen.
- `/round` keeps the anonymous link, the answer count, the funnel and the
  filling report, and offers exactly one control: "פתיחת המפה". Close, archive,
  reset and re-run analysis are not rendered.
- The round's next-step band, in the two states whose next step used to be
  "press re-run analysis", now reports what happened to the round and says
  "פנו למנהל המערכת" instead of linking to a button that is not on the screen.
- `/dashboard/<dimension>` shows the deterministic-summary note without the
  re-run control, and the recommendations screen shows the recommendations
  without the goals panel.
- Every write API answers `403` with
  `{"error":"Only a school administrator can do this. You can read this round's
  results.","code":"FORBIDDEN_FOR_ROLE","action":"<action>"}`.

An administrator sees no change at all.

## Scope

Role enforcement at the API, the screens and the copy, plus documentation.

## Non-goals

- Any change to what an administrator can do.
- Any new screen, endpoint or capability for either role.
- A UI for assigning roles. Roles come from the membership row, which phases 1
  and 2 already built.

## Acceptance criteria

- Every manager write refuses a `manager`-role session and still succeeds for an
  `admin` one.
- A refused write changes nothing.
- Every manager read still succeeds for a `manager`-role session.
- A round belonging to another school still answers `404`, not `403`, whichever
  role asks.
- The role header cannot be forged by a client.

## Decisions made

1. **`403`, not the product's usual `404`.** Non-disclosure exists so a manager
   cannot learn that another school's round exists. This refusal is about a
   round the reader is entitled to see, and calling it "not found" would be a
   lie told to the one person it protects nobody from. The screens tell them the
   same thing anyway.
2. **The check runs after the round resolves.** A foreign round answers `404`
   first, so the role refusal cannot be used to probe for other schools' rounds.
3. **The gate lives in `authorizeManagerRound`**, the chokepoint every
   round-scoped route already passes through. Fifteen call sites gained the
   check by naming their action; no route gained a branch it could forget. The three
   writes with no round to resolve yet — creating a round, the setup screen, the
   question suggestion — call `requireManagerPermission` directly.
4. **Screens leave controls out rather than disabling them.** A disabled button
   invites the question "why", and the answer is not something the school can
   act on.
5. **The root layout became `async`** so the role is read on the server and the
   navigation is right on first paint. The alternative — fetching the role in
   the browser — would have rendered seven tabs and then taken three away in
   front of the user. Cost: `/api-docs` and `/_not-found` are now rendered on
   demand; only `/icon.svg` is still static. The stale premise this invalidated
   in `next.config.ts`'s CSP comment was corrected in the same change.
6. **`getManagerRole` treats an absent or unrecognised header as `admin`.** That
   state means the middleware did not run — a route outside the gate entirely —
   not a school user who slipped past it.
7. **Three actions were added to `RolePermissionService`**
   (`write:reset-round`, `write:goals`, `write:question-suggestion`) for the
   writes it had no name for. It previously had zero production callers.

## Completed

- `src/lib/server/manager-permission.ts` (new) — `requireManagerPermission`.
- `src/lib/server/manager-scope.ts` — `MANAGER_ROLE_HEADER`, `getManagerRole`,
  the `role` argument to `createScopedManagerHeaders` (which deletes any inbound
  header of that name first), and the `action` argument to
  `authorizeManagerRound`.
- `src/middleware.ts` — computes the role from the active membership for the
  chosen school, redirects a school user away from administrator-only screens,
  and forwards the role on the request.
- `src/lib/auth/roles-and-permissions.ts` — three new actions on `admin`;
  `manager` keeps only the three reads.
- Actions named at all fifteen `authorizeManagerRound` call sites across
  thirteen route files, plus the three direct `requireManagerPermission` calls.
- `src/lib/navigation.ts` — `administratorOnlyScreens`, `isScreenOpenTo`,
  `isAdministratorOnlyScreen`, and the `role` argument to
  `mainNavItemsForRound`.
- `src/app/layout.tsx` (now `async`), `header-gate.tsx`, `app-header.tsx`,
  `src/app/page.tsx`, `src/lib/server/manager-context.ts` (`loadManagerRole`).
- `src/components/round/round-controls.tsx` — the `mayAct` prop, wrapping every
  action and leaving the dashboard link outside it. `readOnly` stays what it
  was: a fact about the round, not about the reader.
- `src/components/round/round-threshold-next-step.tsx` — the `mayAct` prop, and
  the two states whose next step was the re-run button.
- `src/components/dashboard/dashboard-dimension-page.tsx`,
  `dashboard-recommendations-page.tsx` and their two inner exported components.
- Documentation: phase 6 of the multi-tenancy plan marked implemented and its
  open question closed; `docs/README.md`'s stale "Not yet implemented" note
  replaced; `PROJECT_CONTEXT.md` ADR-042; `PROGRESS.md`; `docs/openapi.yaml`
  (ten `403` descriptions) and the regenerated `public/openapi.json`.

## Remaining

Nothing in this task. Commit and hand the push over — see **Next concrete step**.

## Exact Git state

Three commits on `feat/a-school-user-may-only-read`, fast-forwarding from
`origin/main` at `124f661`. **Unpushed** — `git push` is the owner's.

1. `feat(roles): the school user reads, and the routes say so` — the permission
   service, `requireManagerPermission`, the role header, the middleware, all
   fifteen `authorizeManagerRound` call sites plus the three direct ones, and
   the API tests.
2. `feat(screens): a reader is offered nothing that would be refused` — the
   navigation, the layout, the home screen, the round screen, the two dashboard
   screens, the next-step copy, the component tests, and the corrected CSP
   comment in `next.config.ts`.
3. The documentation commit, which carries this file.

Nothing is staged. The only unstaged file is `next-env.d.ts`, which is generated
and belongs to the owner — always stage with `git add -A ':!next-env.d.ts'`.

`.claude/launch.json` gained a `school-user-walk` dev-server entry on port 3213.
It is gitignored and went unused: port 3000 was already serving the owner's own
dev server, which was left running and not restarted.

## Verification evidence

### Passed

- `npm run verify:core` — exit `0`, zero `not ok`. Run twice: once after the
  code, once after the documentation and the regenerated `public/openapi.json`.
  The first run of the documentation pass failed on the OpenAPI mirror check
  until `npm run openapi:generate` was run.
- `src/app/api/__tests__/a-school-user-may-only-read.test.ts` — 16 tests. Ten
  writes each refused with `FORBIDDEN_FOR_ROLE`; a refused write changes
  nothing; four reads still allowed; an administrator negative control.
- `src/components/round/__tests__/school-user-round-controls.test.tsx` — 4
  tests, including an administrator negative control, so the assertions cannot
  pass by the buttons disappearing for everyone.
- `src/components/round/__tests__/round-threshold-next-step.test.tsx` — 12
  tests, two of them new.
- `src/lib/server/__tests__/middleware-school-scope.test.ts` — 4 new tests: the
  three administrator-only screens redirect, the reader screens do not, an
  administrator of that school opens all three, and the role header cannot be
  forged.
- Browser walk against the running dev server on `localhost:3000`, signed in as
  `manager@shalomut.edu.il`. Four tabs; three home cards; `/setup`, `/survey`
  and `/goals` redirect to `/`; `/round`, `/dashboard` and `/breakdown` render.
  Over real HTTP with a real session, `PATCH /api/rounds/:id`,
  `POST …/reset`, `POST …/goals` and `POST …/trigger-ai` each answered `403`
  with `FORBIDDEN_FOR_ROLE`, while `GET …/analytics` answered `200`. After the
  round-screen fix, the live DOM held exactly one control in `.round-actions`
  ("פתיחת המפה"), no `a[href="#refresh-round-analysis"]`, and the next-step band
  read "פנו למנהל המערכת להפעלת הניתוח."

### Blocked or not run

- `npm run verify:db` — not run. This change adds no query, no migration and no
  repository method; every new test is a route handler or a rendered component.
- The administrator negative control in the API test **skips
  `question-suggestion` on purpose**: that route calls the paid provider, and a
  test run on a machine with a real `GEMINI_API_KEY` would spend money. Its
  refusal for a school user is covered; its success for an administrator is not.
- The deployed runtime was not exercised, because it holds one administrator
  session and no school user exists there to walk as.

### Environment

Local. `next dev` on `:3000` (the owner's own server, left running and not
restarted), Docker PostgreSQL on `127.0.0.1:5433`.

### Residual risk

- The role is computed in the middleware and carried on a header. Any future
  route that bypasses the middleware sees `admin`, by design (decision 6). The
  middleware matcher is what makes that safe, and it is not asserted here beyond
  the existing scope tests.
- `next.config.ts`'s nonce follow-up is now free — the CSP comment says so — but
  nothing was changed to take it.

## Approval gates

None reached. No credential, secret, authentication configuration or deployment
alias was touched. `git push` is the owner's — see **Next concrete step**.

## Next concrete step

Hand the owner the push, which is theirs to run:

```
git push origin feat/a-school-user-may-only-read:main
```

Vercel auto-deploys every push to `main`, so the deployed commit should read
back as this branch's tip afterwards. Nothing about the change is observable
there until a school user exists.
