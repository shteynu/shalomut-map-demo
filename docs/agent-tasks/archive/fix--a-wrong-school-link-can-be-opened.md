# A link into another school's round can be opened

## Metadata

- Branch: `fix/a-wrong-school-link-can-be-opened`
- Base branch: `fix/builder-switcher-reads-the-save`
- Base commit: `d6fc66f`
- Current HEAD: see `git log -1`
- Status: landed on `origin/main` as `c650fe3`, archived 2026-08-09
- Last updated: 2026-08-09
- Last agent/tool: Claude Code (Opus 5)

## Objective

Finding 6 of the 2026-08-09 deployed end-to-end smoke, in
`docs/deployed-e2e-smoke-findings-2026-08-09.md` on
`test/deployed-e2e-smoke-2026-08-09`.

**Fourth in a stack**, on findings 4, 3 and 1–2 in that order. All land by
pushing onto `main`, and branches cut from the same commit cannot each do that.
Pushing this one lands all four.

## User-visible outcome

Following a link to a round that belongs to another school now leads somewhere:
the dead end offers the schools, and choosing one asks that school for the same
round, on the same screen the link was for.

## Context

`SchoolSwitcher` is on the setup screen alone, and that is deliberate: a school
is chosen once and remembered in a cookie, while a round travels in the URL. It
works everywhere except one screen. Open a link to a round in another school and
the manager gets `הסבב המבוקש לא נמצא`, whose only action was
`חזרה למפת הסבב הפעיל` — back to the school they are already in. The one place a
school switcher was needed was the one place it was absent.

## Decisions made

- **The choice lands back on the screen the link was for, not on `/setup`.** The
  middleware reads `?school=` on any route, not only the setup screen, so the
  switch can happen where the manager is. The finding suggested `/setup`; this
  is the same fix without the detour, and it is the difference between "choose a
  school and then find the link again" and opening the link.
- **`action={null}` rather than a path per screen.** A `GET` form with no action
  submits to the URL it is on, so the same markup works from the map, the
  tracking screen and the builder without any of them telling it where they are.
- **The round travels as a hidden field.** A `GET` form replaces the query
  string rather than adding to it, so `?round=` would be dropped by the very
  submit that is supposed to preserve it.
- **Which school the round belongs to is not looked up and not shown.** It could
  be — one query — but the manager's scope is a boundary, and naming another
  school's round crosses it to answer a question the switcher already lets the
  manager answer for themselves.
- **`hasSchoolChoice` is shared rather than restated.** The first version asked
  `schoolChoices !== null` in the screen and let the switcher decide separately,
  which rendered "if the link came from another school, choose it here" above
  nothing at all on a one-school system. A test caught it; the predicate now has
  one home, and both the switcher and the screen that introduces it ask it.
- **The list is read only in this state.** `loadSchoolChoices` returns `null`
  unless the state is `round-not-found`, so the other screens still pay nothing
  for a query they do not render — the property `loadSchools` was documented
  with. The setup screen passes its own already-loaded list instead of asking
  twice.

## Non-goals

Finding 5 and the delta-chip nit.

## Changed files

- `src/lib/schools/school-options.ts` — `SchoolChoices`, `hasSchoolChoice`
- `src/lib/server/manager-context.ts` — `loadSchoolChoices`
- `src/components/school/school-switcher.tsx` — `action`, `roundId`
- `src/components/manager/manager-onboarding.tsx` — the switcher on the dead end
- `src/app/globals.css` — `.manager-onboarding-schools`
- Eight pages that can render the dead end: home, setup, round, survey,
  dashboard and the three dimension screens
- `src/components/manager/__tests__/round-not-found-schools.test.tsx` — new
- `src/components/school/__tests__/school-switcher.test.tsx` — three tests

## Verification evidence

### Passed

- `npm run verify:core` exit 0: 764 TypeScript tests (754 before, ten new), all
  five fitness checks, `npm run typecheck`, ESLint and the production build.
- `npx playwright test e2e/` 9/9 — the committed suite is unchanged.
- **Walked in a browser, with two schools in the database.** Signed into the
  seeded school, following a link to a round in the other one: the dead end
  appeared, offered both schools by name and city, and choosing the other landed
  on
  `/round/?school=aa366a89…&round=789bcd1f…` — the round the link was for, in
  the school it belongs to, on the screen the link named. A screenshot confirmed
  the switcher sits between the explanation and the way back, in the design
  system's own furniture.
- The same walk fails against the pre-fix screen: with `schoolChoices` not
  passed, `select#school-switcher-select` never appears.
- The one-school case is unit-tested, because it is the case that is easy to get
  wrong and invisible in a two-school walk.

### Not run, and why

- **The browser walk is not committed.** It needs a second school in the
  database, and the committed e2e suite leaves the database as it found it. The
  temporary school and its round were deleted afterwards; the local database is
  back to one school and the four rounds `seed-local.ts` puts there.
- `verify:db`, `verify:ai`, the Python suite and the mutation run: no schema,
  repository, contract, Python or mutated module is in this diff.

### Environment

local

### Observed, not a defect

With two schools present and a session naming an organization id that does not
exist, the manager gets `נדרש שיוך לבית ספר` rather than any round screen. That
is `scope-required` behaving as designed — one school can be inferred, two
cannot — and it is what the smoke server's default
`MANAGER_ORGANIZATION_ID=local-dev-organization` produces. The walk above
pointed that variable at the seeded school. Worth knowing before someone reads
it as a regression.

### Residual risk

- Choosing a school on this screen writes the school cookie, as choosing one
  anywhere does. A manager who lands here from a colleague's link and switches
  has changed which school every later screen is about, and only the setup
  screen's switcher says so. That is the existing model, not something this
  change introduced, but this change makes it reachable from more places.

## Approval gates

None.

## Next concrete step

Push, then open a link to a round in another school on the deployed endpoint —
`ff5625a8` and `34d05e66` both have rounds — and confirm the switcher appears
and lands on the round.
