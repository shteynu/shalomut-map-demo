# A request with no school has a way out

## Metadata

- Branch: fix/scope-required-has-a-way-out
- Base branch: main
- Base commit: 2e80b6a (`origin/main` at session start)
- Current HEAD: see the commit on this branch; the worktree is otherwise as
  described under `Changed files`.
- Status: closed. The state was reached in the owner's signed-in Chrome against
  the local development server and left through the new switcher. The owner
  pushed the three commits on 2026-08-09; `origin/main` is `1b49e86`.
- Last updated: 2026-08-09
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the dead end recorded in `docs/shalomut-tracker-handoff.md` on 2026-08-09:
a session whose `shalomut_school` cookie names a deleted school lands on
`נדרש שיוך לבית ספר` with no school switcher and no button at all. It is the
same shape the 2026-08-09 finding #6 fixed for `round-not-found`, which was
fixed only for that state.

## User-visible outcome

On every manager screen except setup, the `scope-required` state now offers the
schools it could not choose between. Choosing one submits to the URL the manager
is already on, carrying the round the request named, so the screen the link was
for reopens inside the chosen school. The middleware writes the new choice to
the cookie, so the stale value that caused the state is replaced by the act of
leaving it.

## Context

`scope-required` is reached when the request names no school the system has and
more than one school remains — a remembered choice whose school was deleted, or
a session whose `activeOrganizationId` is gone
(`manager-scope.service.ts:29-51`). The setup screen already answered this state
with its own switcher (`src/app/setup/page.tsx:42`); every other screen rendered
`ManagerOnboarding`, whose `scope-required` branch suppresses even the
onboarding button, so the manager arrived at a screen with nothing to press.

## Scope

- `loadSchoolChoices` serves `scope-required` as well as `round-not-found`.
- `ManagerOnboarding` renders the switcher and choice-appropriate copy in that
  state.
- `SchoolSwitcher` grows a placeholder row for the case where no school is
  current.
- The goals screen, the one caller that passed no `schoolChoices`, now passes it.

## Non-goals

- No change to how `scope-required` is *reached*: the discard of an unknown
  school id is deliberate and stays.
- No naming of which school a round belongs to. The manager's scope is a
  boundary; the switcher is how they cross it deliberately.
- No change to the setup screen, which already answers this state its own way.

## Acceptance criteria

- The state renders a working switcher whenever more than one school exists.
- Nothing is displayed as the current school, because none is.
- With one school or no list, the screen is exactly what it was.
- The round the request named survives the switch.

## Relevant repository instructions

- `AGENTS.md` — branch-scoped task state.
- `.agents/skills/shalomut-tracker/SKILL.md`, `.agents/skills/shalomut-map/SKILL.md`.

## Relevant architecture and contracts

- `src/lib/services/manager-scope.service.ts` — where the state originates.
- `src/middleware.ts:92-108` — `?school=` becomes the cookie, which is what
  makes the switcher self-healing here.
- `src/lib/schools/school-options.ts` — `hasSchoolChoice`, one school is not a
  choice.

## Decisions made

- The switcher submits with no `action`, as on `round-not-found`, so the
  manager stays on the screen the link was for.
- The requested round is carried through. If the chosen school does not have it,
  the manager lands on `round-not-found`, which has its own way out.
- Copy changes only when a choice is actually offered. With no list the screen
  keeps `פנו למנהל המערכת`, which is still the right advice when there is
  nothing to choose.

## Assumptions

- `scope-required` implies more than one school (`manager-scope.service.ts:46`),
  so the switcher renders in practice on every screen that passes the list. The
  one-school branch is defensive.

## Completed

- Session start: git and deployed state inspected, skills read, branch created.
- `loadSchoolChoices` widened to a two-state set with the reason written down.
- `ManagerOnboarding`: `scopeRequiredWithChoice` selects the title, description
  and body copy, and renders the switcher above the onboarding button.
- `SchoolSwitcher`: a disabled `בחרו בית ספר` row when nothing is selected.
  Without it the browser would display the first school as if it were current,
  and choosing that school would fire no `change` event and go nowhere.
- New rendering suite `scope-required-schools.test.tsx`, six tests, built on the
  existing `round-not-found-schools.test.tsx`.
- Goals screen given the list it never passed.

## In progress

- Nothing.

## Remaining

- Nothing. The one thing never checked on the deployed endpoint is the state
  itself; Vercel builds every push to `main`, so the code is expected there.

## Changed files

Modified: `src/lib/server/manager-context.ts`,
`src/components/manager/manager-onboarding.tsx`,
`src/components/school/school-switcher.tsx`, `src/app/goals/page.tsx`.
Added: `src/components/manager/__tests__/scope-required-schools.test.tsx`.

Pre-existing unrelated modifications left untouched and unstaged:
`.idea/shalomut-map-demo.iml`, `next-env.d.ts`.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0. 778 TypeScript tests, all five fitness checks,
  typecheck, ESLint and the production build.
- Four of the six new tests fail against the pre-fix component, checked by
  stashing both component files and running the suite: 774 pass, 4 fail — the
  switcher, the placeholder row, the carried round and the changed copy. The
  other two are the no-choice guards and correctly pass either way.
- **Walked in the owner's signed-in Chrome, 2026-08-09**, against the local
  development server on `next dev`, with the local database on `127.0.0.1`
  holding two schools. The state does not need a deleted school to reach:
  the middleware writes `?school=` to the cookie without checking that the
  school exists (`middleware.ts:32,99`), so
  `/?school=00000000-0000-0000-0000-000000000000&round=<invented>` is the same
  request a deleted school produces. What was confirmed in the product:
  - the screen renders `בחירת בית ספר` with both schools in the select, and
    `פנו למנהל המערכת` is gone;
  - `main` holds **no** link or button besides the switcher — which is what the
    dead end was: before this change that count was zero;
  - the select shows the disabled `בחרו בית ספר` row at `selectedIndex` 0 with
    `value === ""`, so neither school is displayed as the current one;
  - the form carries no `action` and holds
    `round=1b2c3d4e-dead-4beef-9999-000000000000` as a hidden field;
  - choosing the first school navigated to
    `/?school=34d05e66…&round=1b2c3d4e…` — the same screen, inside that school —
    and, the invented round not existing there, landed on `round-not-found`,
    which offered its own switcher and `חזרה למפת הסבב הפעיל`. The two dead ends
    chain as intended;
  - the cookie was replaced by that choice: a bare `/` afterwards rendered
    `בית ספר בדיקה מקומי, סבב חורף 2027` rather than the state again;
  - `/goals/?school=<invented>` — the one caller that passed no list before this
    change — also offers the switcher, and choosing the second school reopened
    `מעקב יעדים` inside `בית ספר שני לבדיקת מעבר`.
- The walk's fixture school (`1e9f8ab1`, `בית ספר שני לבדיקת מעבר`, no rounds)
  was created for it and deleted afterwards with `db:clear:targeted`. The local
  database is back to one school, 4 rounds, 24 responses and 576 answers, and
  the browser's cookie was returned to that school before the deletion.

### Failed

- None.

### Blocked or not run

- `verify:db`, `verify:ai`, the Python suite and the mutation run: no schema,
  repository, contract or Python file is in this diff.
- Playwright: not run. The state needs a second school, which the smoke does not
  set up.
- The deployed endpoint: not walked, because the fix is not pushed there yet.
- The native `select` menu: not driven. macOS opens an OS-level popup that
  synthetic key events do not reach, so the choice was made by dispatching the
  `change` event the component listens for. Everything from `onChange` onwards —
  `requestSubmit`, the GET navigation, the middleware, the cookie — is real; the
  OS menu above it is browser behaviour and was not exercised.

### Environment

- Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`.

### Residual risk

- The placeholder is confirmed to render and to leave `value` empty in a real
  browser, but the behaviour it exists for — that picking the first school fires
  `change` at all — sits inside the OS menu the walk could not open. A keyboard
  or screen-reader user reaches it by a path nothing here has exercised.

## Failed approaches

- None.

## Known risks

- None to persistence, contracts or privacy. No school is named that the
  manager could not already read.

## Approval gates

- None triggered. No secrets, credentials, aliases or migrations touched.

## Questions requiring an owner decision

- None.

## Next concrete step

None. This file is archived.
