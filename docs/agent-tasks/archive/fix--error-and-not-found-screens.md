# First-class error and not-found screens

## Metadata

- Branch: `fix/error-and-not-found-screens`
- Base branch: `main`
- Base commit: `0cff722`
- Current HEAD: `213e59b`, which is also `origin/main`. This task's own
  commits are `28f8c6e` and `3d7fcde`.
- Status: closed — pushed to `main` on 2026-08-08 and live on the
  deployed endpoint.
- Last updated: 2026-08-08
- Last agent/tool: Claude Code (Opus 5)

## Objective

Give the product its own screens for a wrong address and for a thrown segment.
Item 1 of the frontend UI/UX audit run on 2026-08-08 (see `Context`).

## User-visible outcome

A manager who follows a stale link, and a member of staff whose share link has
expired, now land on a Hebrew right-to-left screen built from the existing
design system instead of the App Router's English default page.

## Context

A static UI/UX audit of the whole frontend on 2026-08-08 found that `src/app`
contained no `error.tsx`, no `not-found.tsx` and no `global-error.tsx`. Loading
states were already first-class — nine `loading.tsx` files — so this was the one
state the skill requires (`shalomut-map`: «Сохраняй first-class empty, loading,
error и privacy-locked states») that had no implementation at all.

The audit's remaining items are not in this branch's scope. In priority order
they were: `/login` written outside the design system (Tailwind `slate`/`amber`
utilities, a 2.6:1 placeholder, `tracking-tight` on Hebrew), the search input in
the builder dropping its focus outline, the self-overriding `.stone-page`
compact layer in `globals.css` (40 duplicated selectors, 30 `!important`), and
four places where `design.md` no longer describes the code.

The "40 duplicated selectors" above is the audit's original figure and it is
wrong — a grep artifact. Parsing the stylesheet properly gave 10 duplicated
groups and 57 shadowed `.stone-page` selectors; see
`docs/agent-tasks/archive/chore--frontend-audit-minor-items.md` and
`chore--stone-page-cascade-cleanup.md`. The sentence stays as written because
it is what the branch was planned against.

## Scope

- Six route-convention files under `src/app`.
- One `PROGRESS.md` entry.

## Non-goals

- Any other audit item.
- Changing what any existing screen does.
- Response status codes (see `Known risks`).

## Acceptance criteria

- Every 404 and error path renders Hebrew RTL copy inside the design system.
- Respondent screens carry no route into the manager app.
- No boundary renders `error.message`.
- The existing e2e suite still passes.

## Relevant repository instructions

- `AGENTS.md` — RTL-first, WCAG AA, warm design system, preserve unrelated
  changes.
- `.agents/skills/shalomut-map/SKILL.md` — first-class empty/loading/error/
  privacy-locked states; prefer existing components and tokens.
- `.agents/skills/shalomut-verification/SKILL.md` — page TSX changes require
  targeted tests, `npm run lint`, `npm run build` and a browser smoke.

## Relevant architecture and contracts

None touched. No API, contract, schema, persistence or privacy surface changed.

## Decisions made

- **Reuse, do not invent.** Every screen is built from classes that already
  ship: `page stone-page`, `PageIntro`, `form-panel manager-onboarding-panel`,
  `form-section-icon`, `survey-shell` + `survey-complete`, `primary-button`.
  No CSS was added, so the screens cannot drift from the system.
- **Respondent and manager voices are separate files.** A dead share link is
  answered at `answer/[shareCode]/not-found.tsx`, not by the root screen. The
  reader is not a manager, has no second way in, and the manager screens are
  behind a sign-in that would only look like a wall.
- **One wording for "unknown code" and "closed round".** Telling them apart out
  loud would make the screen a way to test whether a share code exists, and the
  respondent's next step is the same either way.
- **No `error.message` anywhere.** Production redacts it; local and deployed
  development builds do not. `app/error.tsx` shows `error.digest` instead, in a
  `dir="ltr"` span so the RTL context does not reorder the identifier. The
  respondent boundary shows no digest at all — a respondent has nothing to do
  with one.
- **`global-error.tsx` imports nothing from the app.** No component, no icon
  set, no navigation module: every dependency is another way for the screen
  that reports a failure to fail.
- **A dimension 404 offers the map, not the home screen**, and drops the
  `round` parameter — the same trade `ManagerOnboarding` already makes for a
  round that does not exist. A not-found boundary is not given search params.

## Assumptions

- The dashboard and respondent routes stay in `headerlessRoutes`; the dimension
  and respondent screens rely on that for their layout.

## Completed

All six files, verified. See `Verification evidence`.

## In progress

Nothing.

## Remaining

Nothing. Committed and pushed to `main` on 2026-08-08.

## Changed files

Untracked (new):

- `src/app/not-found.tsx`
- `src/app/error.tsx`
- `src/app/global-error.tsx`
- `src/app/answer/[shareCode]/not-found.tsx`
- `src/app/answer/[shareCode]/error.tsx`
- `src/app/dashboard/[dimension]/not-found.tsx`

Modified:

- `PROGRESS.md` — one entry under `Survey and manager workflow`.

Pre-existing and unrelated, left alone: `.idea/shalomut-map-demo.iml`,
`next-env.d.ts`.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0. Covers `lint:literals`, `lint:composition`,
  `lint:fixtures`, `lint:mutation-config`, `lint:contract-refusals`,
  `typecheck`, `npm test` (739 pass, 0 fail), `lint`, `build`.
- `npx playwright test` — the existing 6 e2e tests pass unchanged.
- Browser walk, production build on the Playwright smoke server, via a
  throwaway spec that was deleted afterwards:
  - `/no-such-page` → **404**, «הדף לא נמצא», link «חזרה למסך הבית».
  - `/dashboard/not-a-dimension`, `/metrics` and `/recommendations` →
    «הממד לא נמצא», link «חזרה למפת השלומות», headerless and full height.
  - `/answer/NO-SUCH-CODE` → «הקישור אינו פעיל», asserted to contain zero
    links.
  - Manager error boundary, reached by a temporary conditional throw in
    `goals/page.tsx`: «משהו השתבש», retry button, home link, digest line
    present and correctly ordered; the body was asserted not to contain
    `postgres://` or the thrown message.
  - Respondent error boundary, same method on `answer/[shareCode]/page.tsx`:
    «השאלון לא נטען», retry button, zero links, no digest, no thrown message.
  - The temporary throws and the throwaway specs were reverted and deleted;
    `git status` shows only the six new files and `PROGRESS.md`.

### Failed

None.

### Blocked or not run

- `global-error.tsx` was type-checked and built but never rendered. Triggering
  it means making the root layout itself throw, which no probe short of
  breaking `layout.tsx` reaches. Its markup is a subset of the manager error
  screen's, which did render.
- `npm run verify:db` and `npm run verify:ai` were not run: no persistence,
  API, contract or AI code is touched by this diff.
- Deployed verification was not run on this branch. It happened later, after
  the whole stack was pushed on 2026-08-08:
  `https://shalomut-map-demo.vercel.app/answer/NOT-A-REAL-CODE/` serves
  «הקישור אינו פעיל», and it answers 200 exactly as ADR-021 describes.

### Environment

Local. Local Postgres on 127.0.0.1:5433 via `npm run local`; e2e against
`npx next start` on port 3100 with the harness's own throwaway credentials.

### Residual risk

Low. Six additive route-convention files and one documentation entry. No
existing module was edited, so no existing screen can regress through this
diff; the e2e suite confirms that.

## Failed approaches

- Moving the `!entry` check ahead of `loadManagerContext()` in the three
  dimension pages, to make `notFound()` set a 404 status. It did not: the
  status is already committed by then, and the reorder was reverted so the diff
  stays additive. The observation it produced is recorded below.

## Known risks

- **`notFound()` renders the right screen but answers 200.** Measured:
  `/no-such-page`, which no route matches, returns 404 correctly; every
  explicit `notFound()` call — the three dimension routes and
  `/answer/[shareCode]` — returns 200 while rendering the correct screen. The
  same holds for the error boundaries, which answer 200 rather than 500. The
  Consequence is limited to machine readers — monitoring, crawlers, any client
  checking `response.ok`. `/answer/[shareCode]` is the one public URL affected.

  This branch guessed the cause was awaiting a dynamic API — `params`, or
  `connection()` inside `loadManagerContext` — before the call. That guess was
  tested on 2026-08-08 and is wrong: a route whose entire body is `notFound()`,
  with no params and no `await`, also answers 200. The middleware, the custom
  root `not-found.tsx`, `trailingSlash`, and static-versus-dynamic rendering
  were each eliminated the same way. The cause is `loading.tsx`, the decision
  is ADR-021 in `PROJECT_CONTEXT.md`, and the measurements are in
  `docs/agent-tasks/archive/fix--not-found-answers-404.md`.

## Approval gates

None. Nothing here touches secrets, credentials, authentication configuration
or deployment aliases.

## Questions requiring an owner decision

- Should the 200-instead-of-404 status become its own task, or is the correct
  screen enough for a product with no public search surface?

## Next concrete step

None. The work is in `main` and this file is archived.
