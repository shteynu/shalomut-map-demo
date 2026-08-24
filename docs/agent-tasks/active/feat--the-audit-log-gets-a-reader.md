# The audit log gets a reader

## Metadata

- Branch: `feat/the-audit-log-gets-a-reader`
- Base branch: `main`
- Base commit: `fcfe20f`
- Current HEAD: `474a054`
- Status: complete, unpushed
- Last updated: 2026-08-24
- Last agent/tool: Claude Opus 5 / Claude Code

## Objective

Give the administrative audit log a screen. Every administrative mutation has
been recorded since the owner made the audit mandatory on 2026-08-23, and the
read has been bounded, cursor-paged and tested since `66cc19d` — but
`getOrganizationAuditLogs` had **zero production callers**, so nothing in the
product could show what was recorded.

## User-visible outcome

A platform administrator opens `יומן פעולות` on any school and reads what was
done in it: the action, the person, the time and the round, newest first,
twenty-five at a time. Reached from the main navigation and from a third link on
each school's card in the administrator console.

## Scope delivered

- `/activity` — one school's log, administrator-only, entered through
  `loadManagerContext` so opening it is a recorded visit.
- Cursor pagination in the URL, one opaque parameter.
- Hebrew labels for every `AuditActionType`, exhaustive by type.

## Non-goals (unchanged)

- No cross-school or platform-scoped log. `ADMINISTRATOR_INVITED` is recorded
  under `PLATFORM_SCOPE` and therefore appears in no school's log; nothing
  renders it. See `Remaining`.
- No retention or deletion — an owner question, still open (ADR-049).
- No new API route, so the endpoint surface and `docs/openapi.yaml` are
  untouched.

## Decisions made

1. **Administrator-only.** `ManagerAuditService` permits a member to read their
   own school's log, and that half still has no caller. The log holds
   `ADMINISTRATOR_SCHOOL_VISIT`, so showing it to a school tells that school
   when it was looked at — the owner's question, and the narrower answer is the
   one that cannot leak while it is open.
2. **A manager screen, not a page in the administrator area.** It is about one
   school, so it enters through the screen chokepoint, which records the visit.
   A page under `/admin` would have had to record it some other way, and
   `lint:tenant-chokepoints` refuses exactly that.
3. **Cursor, not page number.** An audit log is appended to while it is read.
   The cursor carries timestamp *and* id in one parameter, so it cannot arrive
   half-formed; a malformed value is the newest page rather than an error.
4. **One row more than is rendered** answers "is there a next page" without a
   second, unbounded counting query.
5. **No controls at all** — not disabled ones. A log a reader can edit is not
   evidence.
6. **A recorded field equal to something already on the line is not repeated.**
   Rule is string equality, not field name: a renamed account or a renamed round
   makes the two differ and both are shown.

## Assumptions

- The school scope survives the pager through the existing `MANAGER_SCHOOL_COOKIE`,
  the same way `/goals` and `/dashboard` keep their school. Verified in a
  browser; see evidence. The pager links deliberately do **not** re-declare
  `?school=`, which would make this the only screen that does.

## Completed

- `src/lib/audit/audit-log-cursor.ts` — format/parse and `takeAuditLogPage`.
- `src/lib/audit/activity-log-view.ts` — labels, actor and round resolution,
  bounded details.
- `loadSchoolActivity` and `ACTIVITY_LOG_PAGE_SIZE` in
  `src/lib/server/manager-context.ts`.
- `src/app/activity/page.tsx`, `src/components/activity/activity-log.tsx`.
- `navigation.ts`: the route, its metadata, the nav item, the
  administrator-only entry, `activityRoute`, `schoolActivityRoute`.
- Console link, header icon, styles.
- 24 new unit/component assertions plus two browser paths.

## Remaining

- Nothing for this task. The platform-scoped log — `ADMINISTRATOR_INVITED`,
  recorded under `PLATFORM_SCOPE` — is readable by the same service and is
  rendered by nothing; it belongs on `/admin` rather than on a school's screen,
  and is a separate slice.

## Changed files

`git show --stat 683a3f3 bad7c44 474a054`. Three commits: the screen, the two
browser paths, the documents.

## Verification evidence

### Passed

- `npm run verify:core` — exit `0`. Includes `typecheck`, `lint`, `build`,
  `npm test` (1649 passed, 0 failed), the Python suite (587 passed) and all
  fourteen fitness/lint gates.
- `npm run test:e2e` — 28 passed, including the two new paths: a school user is
  turned away from `/activity/`, and an administrator opening the log of a
  school they do not belong to sees the visit that opening just recorded, with
  their own address on it.
- `npm run openapi:check` and `npm run docs:endpoints:check` — pass unchanged;
  the screen adds no endpoint.
- Browser, local, on the tenant-boundary server (`next start`, port 3101):
  the pager was walked with 30 seeded rows — `לפעולות ישנות יותר` leads to
  `?after=<millis>.<id>`, the next page renders, and `חזרה לפעולות האחרונות` is
  offered there and not on the newest page. The 30 seeded rows were deleted
  afterwards.
- Browser, local: screenshots of the screen with real rows written by the real
  routes — a `ROUND_CREATED` row naming the round and several visit rows.

### Failed

- None.

### Blocked or not run

- `npm run verify:db` — not run. No schema, migration or repository change.
- Nothing was checked on the deployed runtime: this branch is unpushed, and the
  screen needs a signed-in platform administrator there.
- `npm run test:mutation:ai-contract` — not run; no mutated file was touched.

### Environment

- Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`,
  local PostgreSQL. The local database gained the ordinary walk leftovers — a
  round `רבעון ב׳ תשפ״ז` on `e2e-second-school` and its audit rows. Disposable.

### Residual risk

- The deployed runtime has never rendered this screen. Nothing about it is
  environment-dependent — no migration, no variable, no endpoint — so the risk
  is a render failure rather than a behaviour difference.
- An administrator arriving at `/activity` with no school ever chosen sees the
  onboarding rather than a log. That is the shared behaviour of every
  school-scoped screen and not specific to this one.

## Known risks

- The details rule drops a recorded field whose value equals the actor or the
  round title shown. If a future action records a field that legitimately
  repeats one of those and a reader needs to see the repetition, the rule hides
  it. Tested in both directions; the equality is the whole rule.

## Approval gates

- None. No secret, credential, authentication configuration or alias.

## Questions requiring an owner decision

- **May a school read its own audit log?** The log records administrators
  opening the school, so the answer decides whether the school can see when it
  was looked at. Until it is answered the screen is administrator-only, and
  `ManagerAuditService` already permits the other answer without a caller.
- Retention — whether an `audit_events` row is ever deleted — remains open from
  ADR-049 and is unchanged by this work.

## Visibility of this handoff

Committed on `feat/the-audit-log-gets-a-reader`, three commits ahead of
`origin/main` at `fcfe20f`, **not pushed**. Another worktree on this machine can
read it from the branch; another checkout or machine cannot until it is pushed.

## Next concrete step

Land it: `git push origin feat/the-audit-log-gets-a-reader:main`, which is the
owner's to run.
