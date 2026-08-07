# More than one school, chosen on the setup screen

## Metadata

- Branch: feat/multi-school-scope
- Base branch: main
- Base commit: b2f8a33
- Current HEAD: a0f5306
- Status: implemented and walked in a signed-in browser; unpushed
- Last updated: 2026-08-07
- Last agent/tool: Claude Code (Opus 5)

## Objective

Let the system hold more than one school and let the manager choose which one
every screen is about, the same way rounds are chosen: a select that appears
only when there is more than one school. Creating a school happens on the setup
screen. Authentication stays a single user.

## User-visible outcome

- With one school nothing changes anywhere.
- With more than one school the setup screen shows a school select above the
  form; choosing a school makes it the school every other screen reads —
  rounds, questionnaire, map, goals — until another one is chosen.
- The setup screen can open a new school, which is created together with its
  first round.

## Context

The data layer was already school-scoped before this task: `ManagerScopeService`
resolves an organization id, `ManagerContextService` reads rounds and analytics
inside it, and `authorizeManagerRound` refuses a round from another school. What
was missing was a way to *choose* the school: middleware injected
`managerSession.activeOrganizationId`, which comes from `MANAGER_ORGANIZATION_ID`
at login, so a second organization in the database was unreachable.

## Scope

- Request-scoped school selection (cookie + `?school=` on the setup screen).
- School select on `/setup` only, shown when there is more than one school.
- New-school mode on `/setup`, creating organization plus first round.
- Tests and documentation for the above.

## Non-goals

- Memberships, per-user school lists, or any authentication change. One user.
- The AI analytics service: it receives one round's canonical analytics and
  never sees the school list.
- A school picker on the dashboard, goals, round or builder screens.

## Acceptance criteria

- One school: no select rendered, every screen behaves as before.
- Two schools: the select appears on `/setup`; choosing one changes the round
  list, the map, the goals and the builder to that school's data.
- A round id from another school still reads as not found.
- A stale or unknown school id does not dead-end the manager.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-{tracker,map,verification}/SKILL.md`.

## Decisions made (owner, 2026-08-07)

- The school is chosen on the existing `/setup` screen, not on a new screen.
- The choice is remembered in a cookie and expressed as `?school=` in the URL,
  so it survives navigation to screens that carry no school parameter.
- A new school is created from the setup screen.

## Assumptions

- `MANAGER_ORGANIZATION_ID` stops being a hard pin and becomes the default
  school a session lands on; the cookie wins when set.
- An unknown school id falls back to the unscoped resolution rather than
  reporting an error, because a deleted school leaves a stale cookie behind.

## Completed

- Scope layer (commit `0d37ef4`): `school` search param and `shalomut_school`
  cookie, middleware resolution (param → cookie → session), and a scope service
  that honours a chosen school only when it exists — or when the system has no
  schools at all, which is the empty deployment naming its first school's id.
- Setup screen (commit `36f40c5`): `SchoolSwitcher` on `/setup` only and only
  with a second school, `?school=new` mode, an "add school" action beside the
  "new round" one, `createOrganization` on `PUT /api/manager/setup`, and the
  screen answering `scope-required` with the switcher instead of an onboarding
  dead end.
- Documentation: ADR-020, amendments to ADR-009 and ADR-013, `PROGRESS.md`,
  `docs/openapi.yaml` plus the regenerated `public/openapi.json`.

- The walk found one defect and commit `a0f5306` fixes it: the setup form kept
  its client state across the client-side navigation into another school, so an
  empty new-school form reported the previous school's save time. The form is
  now keyed by the school and round it is about.

## In progress

- Nothing.

## Remaining

- Nothing in code that is known to be missing. The branch is unpushed; landing
  it is `git push origin feat/multi-school-scope:main`, which is the owner's.

## Changed files

Committed: `src/lib/navigation.ts`, `src/middleware.ts`,
`src/lib/server/manager-scope.ts`, `src/lib/services/manager-scope.service.ts`,
`src/lib/schools/school-options.ts`, `src/components/school/*`,
`src/app/setup/page.tsx`, `src/components/round/setup-form.tsx`,
`src/app/api/manager/setup/route.ts`, `src/app/globals.css`,
`src/lib/server/manager-context.ts`, `docs/openapi.yaml`,
`public/openapi.json`, and the four test files.

Unstaged: `PROGRESS.md`, `PROJECT_CONTEXT.md`, this task file.
Pre-existing and untouched: `.idea/shalomut-map-demo.iml`, `next-env.d.ts`.

## Verification evidence

### Passed

- `npm test` — 643 TypeScript tests, 0 failures (was 620 before this task).
- `npm run typecheck`, `npm run lint`, `npm run lint:composition`,
  `npm run build`.
- `npm run openapi:generate` and `src/app/api/__tests__/openapi.test.ts`.
- New tests: middleware school scope (5), scope service (7), school options (4),
  school switcher rendering (5), and two setup-route cases — a second school is
  created beside the scoped one without renaming it, and a request that does not
  ask for a school still saves the scoped one.

### Failed

- None.

- Browser walk, local, owner's signed-in Chrome session, 2026-08-07: one school
  showed no switcher; `הוספת בית ספר` opened an empty form with the switcher
  offering the way back; saving created `בית ספר רימון — ירושלים` with its first
  round and moved the screen into it (`/setup?school=<uuid>`); `/round` showed
  the new round's dates and `/goals` the new school with no goals; the switcher
  then listed both schools and switching back moved `/setup`, `/goals` and the
  map to `בית ספר בדיקה מקומי`, whose round switcher offered only its own
  rounds.
- Re-walk after `a0f5306`: the new-school form no longer reports a save time.
- The test school was then deleted from the local database at the owner's
  request, which walked the stale-cookie path for real: with the cookie still
  naming the deleted school, `/setup` and `/goals` came back on the surviving
  one, with no switcher and no dead end. Local persistence is back to one
  school with four rounds.

### Blocked or not run

- `verify:db` and the Python suite: nothing in this diff touches the schema,
  repositories or the AI service.

### Environment

Local.

## Known risks

- Middleware writes the school cookie; a wrong value there scopes every manager
  screen, so the value is validated in the service layer before it is used.

## Approval gates

None. No secrets, credentials or deployment aliases are touched.

## Next concrete step

Push the branch onto `main` (`git push origin feat/multi-school-scope:main`),
which the owner performs; Vercel deploys from that push. Nothing in the code is
waiting on it.
