# Locked status stones say nothing rather than zero

## Metadata

- Branch: `feat/locked-status-stones-say-nothing-rather-than-zero`
- Base branch: `main`
- Base commit: `61cbd22`
- Current HEAD: `7368148`, which is also `origin/main`
- Status: done and landed on `main`
- Last updated: 2026-08-11
- Last agent/tool: Claude Opus 5, Claude Code

## Objective

Cheap win 9 in `docs/product-strategy-axes-2026-08-10.md`: render `—` rather
than `0` for the status stones while analytics are locked.

## User-visible outcome

On the manager home screen, `מוקדי טיפול` and `חוזקות לשימור` show `—` with the
helper `ייפתח לאחר N תשובות` while the round is below its privacy threshold,
instead of `0` with a helper describing stones on a map nobody can see. Once
the round opens, both stones show their real counts and their original helpers.

## Context

The finding is recorded at `docs/product-strategy-axes-2026-08-10.md` axis 4:
`getStatusCount` returned `0` whenever analytics were locked, so a principal on
day one with no responses was shown a dashboard asserting zero problem areas —
the empty state indistinguishable from a perfect school, which removes the
urgency needed to chase responses.

The dashboard map does not have the same defect: `src/app/dashboard/page.tsx`
also computes `0` for a locked `overallScore`, but `DashboardMapPage` returns
the locked screen before that number is ever rendered. Left alone deliberately.

## Scope

- The two status stones on `src/app/page.tsx`.
- One optional prop on `StatStone` so a typographic stand-in can be read aloud
  as words.

## Non-goals

- The privacy rule itself, the lock threshold and the locked map screen.
- The response-count stone and the threshold stone, both of which were already
  honest while locked.
- The stones' pastel tints, which are identity rather than status.

## Acceptance criteria

- A locked round shows no number and says when the number arrives.
- An open round with a genuine zero still shows `0` — the change must not make
  a real finding unreadable.
- The dash is not what a screen reader hears.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md`: RTL-first, WCAG AA, first-class
  privacy-locked states, no status by colour alone.
- `.agents/skills/shalomut-verification/SKILL.md`: component changes need
  targeted tests, `npm run lint`, `npm run build` and a browser smoke.

## Decisions made

- `getStatusCount` returns `null` while locked instead of `0`, and a pure
  helper (`describeStatusStone`) turns the absence into value, helper and
  screen-reader text. The absence is now a type the compiler sees.
- `StatStone` gained an optional `screenReaderValue`: when present, the visible
  value is `aria-hidden` and a `.visually-hidden` span carries the words. The
  class already exists in `globals.css`; nothing new was styled.
- The locked helper names the round's own threshold rather than a constant.

## Assumptions

- The home screen is the only place that rendered a locked count as a number.
  Checked by reading every `isLocked` use in `src/app` and `src/components`.

## Completed

- `src/lib/dashboard/status-stone-value.ts` — new.
- `src/components/ui/stat-stone.tsx` — optional `screenReaderValue`.
- `src/app/page.tsx` — `null` while locked, both stones described.
- `src/lib/dashboard/__tests__/status-stone-value.test.ts` — new, 4 tests.
- `src/components/ui/__tests__/stat-stone.test.tsx` — new, 2 tests.

## In progress

Nothing.

## Remaining

Nothing.

## Changed files

- `src/app/page.tsx`
- `src/components/ui/stat-stone.tsx`
- `src/lib/dashboard/status-stone-value.ts` (new)
- `src/lib/dashboard/__tests__/status-stone-value.test.ts` (new)
- `src/components/ui/__tests__/stat-stone.test.tsx` (new)
- `docs/agent-tasks/active/feat--locked-status-stones-say-nothing-rather-than-zero.md` (this file)

## Verification evidence

### Passed

- `npx tsx --test` on both new files — 6/6.
- `npm test` — 866 pass, 0 fail.
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeded.
- Browser smoke on a local production build (`next start` on port 3210, the
  `playwright.config.ts` throwaway fixtures, a temporary Playwright script
  since removed), against the freshly reseeded local database — 12 responses,
  threshold 10:
  - unlocked: `1 | מוקדי טיפול | אבנים הדורשות התייחסות במפה` and
    `6 | חוזקות לשימור | אבנים במצב טוב במפה`;
  - threshold raised to 20 through the setup screen: both stones read
    `— | עדיין אין נתון | … | ייפתח לאחר 20 תשובות`, the accessible name
    coming from the hidden span rather than the dash;
  - threshold restored to 10: the counts return, so the local database is as
    the seed left it.

### Failed

None.

### Blocked or not run

- Deployed verification. Not run: no server or contract change, and the
  deployed database is empty, so the screen has no round to lock.
- Screen-reader walk with real assistive technology. Not run; the markup is
  asserted in tests and the class is the one already used elsewhere.

### Environment

local. The local database was reset and reseeded with
`npx tsx scripts/seed-local.ts --reset` during this task.

### Residual risk

Low. The behaviour change is confined to two stones on one screen, and the
open-round path is covered by a test asserting that a genuine `0` still renders.

## Failed approaches

None.

## Known risks

None open.

## Approval gates

None. No secrets, credentials, authentication configuration or deployment
alias is touched.

## Questions requiring an owner decision

None.

## Next concrete step

None. The owner pushed `7368148` onto `main` on 2026-08-11 and this file was
archived.
