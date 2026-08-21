# Phase 4 — what the administrator can see about every school

## Metadata

- Branch: `feat/what-the-administrator-sees`
- Base branch: `feat/the-session-gets-short` (phase 5, unpushed, which itself
  sits on `f2b8653` above `origin/main`)
- Base commit: `d0efa81`
- Current HEAD: `427c132`
- Status: implemented and verified locally; unpushed
- Last updated: 2026-08-21
- Last agent/tool: Claude Opus 5 / Claude Code

## Objective

Phase 4 of
[`multi-tenancy-plan-2026-08-20.md`](../../multi-tenancy-plan-2026-08-20.md):
the fuller half of the owner's description — how many schools, how many rounds
each has, and the results of any school's round.

## User-visible outcome

An administrator opening `/admin` sees, for each school, whether anything is
happening in it: how many rounds it has run, which round is current, what state
it is in, and how many people have answered against the threshold that would
unlock it. From there one link opens that school's own map.

Today the same screen says only the school's name, city and staff count, so an
administrator cannot tell a school that has never started from one mid-round
without opening each in turn.

## Context

Phase 2 already built most of the routing this phase was expected to need. The
school card carries a `פתיחת בית הספר` link to `/setup?school=<id>`, and the
middleware honours `?school=` on **any** path for an administrator
(`src/middleware.ts:155`), setting the school cookie so the choice survives the
next hop. So "open one school's results" is a second link, not a mechanism.

What does not exist is any round information on the administrator's screen.
`loadOverview` reads organizations and managers and never touches
`IRoundRepository`.

## Scope

- `loadOverview` gains, per school, how many rounds it has and a summary of the
  one that is current: title, status, response count and the round's own
  privacy threshold.
- The school card renders that summary, and gains a link into the school's map
  when there is a round to read.
- The screen names how many schools exist.
- A test that pins the k-anonymity limit: nothing in the overview is a figure
  computed across schools, and nothing in it is a score.

## Non-goals

- **Any cross-school figure.** Named in the plan as the one thing this phase has
  to design in rather than check afterwards, and it is a product invariant
  rather than a preference — two schools whose small groups are each suppressed
  become readable when added together.
- New analytics of any kind. An administrator opening a school gets that
  school's own screens, which already suppress what they must.
- Phase 6 (what a school user may not do) — deferred by the owner.
- Rendering `audit_events`. Who may read the log, and whether a school sees the
  visits made to it, is the question the multi-tenancy phases deliberately left
  open, and it has no addressee until there are real schools.

## Acceptance criteria

- A school with no rounds reads as a school with no rounds, not as an empty
  card.
- A round below its privacy threshold says so, with the same numbers that
  school's own user sees, and offers no score.
- No response count, score or average is summed across schools anywhere.
- The overview costs a bounded number of queries per school, not per round.
- `npm test`, `typecheck`, `lint`, `build` and `lint:composition` pass.

## Relevant repository instructions

- `AGENTS.md` — branch-scoped task state, mandatory progress handoff.
- `.agents/skills/shalomut-map/SKILL.md` — `Канонические границы`: the privacy
  threshold, the eight-dimension taxonomy, RTL-first and WCAG AA.
- `.agents/skills/shalomut-verification/SKILL.md` — before claiming completion.

## Relevant architecture and contracts

- `ManagerAdministrationService.loadOverview` is the only reader behind
  `/admin`, and `AdminPage` refuses a non-administrator itself rather than
  trusting the middleware's matcher.
- `ISurveyRepository.getResponseCount(roundId)` is the cardinality this phase
  needs; `findResponsesByRoundId` would be the wrong call, since it reads
  answers.
- `EVERY_SCHOOL` (`src/lib/server/manager-scope.ts`) is what an administrator's
  scope header carries; the number of schools never reaches their token.

## Decisions made

- Counts and lists carry no privacy question and scores do not, per the plan's
  §3 — so the card may say how many answered and must never say what they
  answered.

## Assumptions

- The current round is the `active` one if there is one, else the most recently
  created. A school runs one round at a time (ADR-014), so this is a
  presentation choice about closed and draft rounds rather than an ambiguity.

## Completed

All of Scope, in `427c132`.

- `CurrentRoundSummary` and two new fields on `SchoolWithPeople` — `roundCount`
  and `currentRound`. `loadOverview` takes `IRoundRepository` and
  `ISurveyRepository` and builds them.
- `SchoolActivity` on the school card, the round-status pill and its styles, the
  `פתיחת המפה` link, and the school count beside the section heading.
- Nine tests in `administrator-school-overview.test.ts`, two of which exist only
  to fail if somebody adds a cross-school figure or a score.

## In progress

- Nothing.

## Remaining

- The owner pushes. Nothing else in this task is unfinished.

## Changed files

See `git show --stat 427c132`. Six files: one new test, one modified test, the
service, the page, the console component and the stylesheet.

## Verification evidence

### Passed

- **The suite, at `427c132`.** `npm test` 1342 passed / 0 failed, up from 1333.
  `npm run typecheck`, `npm run lint` and `npm run build` clean;
  `lint:composition`, `lint:doc-numbers`, `lint:literals`, `lint:skills`,
  `openapi:check` and `docs:endpoints:check` all pass.
- **A signed-in administrator walk**, against the local Docker database through
  a stand-in OIDC provider on `:4455` and `next start` on `:3212`. Signed in as
  `walk-admin@example.test`, a platform administrator row that was already in
  the local database. The three schools it holds happened to cover all three
  cases:
  - `בית ספר ההליכה`, no rounds — `בית הספר טרם פתח סבב אבחון.` and **no** map
    link.
  - A school with three closed rounds — the most recent is named, `סגור`,
    `4 מתוך 10 תשובות שנדרשות לפתיחת התוצאות · 3 סבבים בסך הכול`.
  - A school with an active round **and a newer draft** — the active one is
    named, `פתוח למענה`, `21 תשובות · התוצאות פתוחות · 2 סבבים בסך הכול`. The
    live confirmation of the rule the tests state: what is open wins over what
    is newest.
- **The map link opens that school's results.** Following it rendered the stone
  map for `בית ספר בדיקה מקומי` with its eight stones and a 66 overall.
- **The suppression is the school's own.** Following the locked school's numbers
  through to its map gave the locked screen — `המפה עדיין נעולה`, `4 מתוך 10
  תשובות נדרשות` — the same two numbers the card had shown, and no result.
- **The visit was recorded.** `audit_events` gained
  `ADMINISTRATOR_SCHOOL_VISIT` rows for the administrator, naming the school and
  the round. Reading the list recorded nothing, which is the intended
  distinction.
- **Mobile layout holds.** At 375 px the card is 363, its header 321 and the new
  action row 298, so nothing exceeds its container. `document.body.scrollWidth`
  reads 511 there — see Failed approaches, it is not an overflow.

### Failed

- None.

### Blocked or not run

- **Nothing was verified on the deployed endpoint**, because this branch is
  unpushed and `git push` is the owner's action here.
- The deployed database has one school and no rounds, so the deployed screen
  would exercise only the empty case even after a push.
- `verify:core` was not run whole. `verify:ai`, `lint:interpreter`,
  `lint:mutation-config`, `lint:contract-refusals` and `lint:fixtures` were not
  run: nothing here touches the AI contract or the Python service.

### Environment

- Local worktree, local Docker PostgreSQL on `127.0.0.1:5433`.
- The walk needed a stand-in identity provider because the password door signs
  in as `mgr-admin-001`, which is **not** a platform administrator, so `/admin`
  is unreachable through it. The stand-in and the `signed-in-walk-oidc` entry in
  the gitignored `.claude/launch.json` are rebuilt per session and are not part
  of this diff.

### Residual risk

- The screen costs three queries per school. Fine at a handful; worth revisiting
  before a hundred, and named in ADR-029 so the next reader does not discover it
  by watching the screen get slow.

## Failed approaches

- **Reading `document.body.scrollWidth` as evidence of mobile overflow.** At
  375 px it reports 511 on this screen, which looks like a horizontal-scroll
  defect. It is not: no element exceeds the viewport, `/help` — untouched by this
  branch — reports the identical 511, and the document's own scroll range is a
  single point (`min === max === -135`), so the page does not scroll
  horizontally at all. It is an RTL measurement artefact. Recorded because the
  first reading cost a detour and the second would too.

## Known risks

- `loadOverview` already queries per school. Adding rounds and a response count
  makes it three queries per school rather than one; with the deployed database
  in Seoul at roughly 180 ms a query, the screen's cost grows with the number of
  schools. Acceptable at four administrators and a handful of schools, and worth
  naming before it is a hundred.

## Approval gates

- The Google OAuth client remains the owner's to create, under the standing gate
  on authentication configuration. Phase 4 does not depend on it.
- `git push` is the owner's action in this environment.

## Questions requiring an owner decision

- None open. One is worth surfacing rather than deciding: **every phase of the
  multi-tenancy plan that was not deferred is now written**, so the next
  substantial work is no longer in that plan. `docs/product-behaviour-backlog.md`
  §12, the research instrument, is the standing alternative.

## Next concrete step

Hand `git push origin feat/what-the-administrator-sees` to the owner — it lands
this branch, phase 5 and `f2b8653` in one push, since each sits on the one below.
Then sign in once on the deployed endpoint: it is on the password door phase 5
fixed, and that path has been verified locally but never there.
