# A visible "last saved" time on both save surfaces

## Metadata

- Branch: `feat/last-saved-timestamp`
- Base branch: `feat/one-active-round-index` (which is based on `main` = `3adb18a`)
- Base commit: `166c300`
- Current HEAD: the two commits listed under `Git state`
- Status: merged into `main` and archived
- Last updated: 2026-08-04
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close `docs/product-behaviour-backlog.md` §1's first remaining proposal: a
visible "last saved" timestamp after save actions, so "did that save?" stops
being a question only a page reload can answer.

## User-visible outcome

Under the save button on the setup screen and in the survey builder:

- after a completed write — "נשמר בשעה HH:MM";
- from the first edit after it — "יש שינויים שטרם נשמרו. שמירה אחרונה בשעה
  HH:MM";
- before any save in the session, once the manager has edited — "יש שינויים
  שטרם נשמרו." with no time at all.

The builder's stale success note no longer sits on screen while the manager
types: every edit now goes through one `markEdited`, including the settings
fields (name, minutes, threshold, intro and anonymity text), which previously
did not clear the saved state at all.

## Decisions made

- **The time comes from the server**, as a `savedAt` on the two save responses,
  not from the browser clock. The line is evidence that a write completed, not
  that a button was pressed.
- **A response with no usable `savedAt` shows no time**, rather than falling
  back to the browser's own clock. A made-up timestamp is worse than none —
  it is exactly the claim a manager would rely on.
- **The time survives the next edit** rather than disappearing with the saved
  state. It stays true as a fact about the last write; the line just stops
  claiming the screen matches the database.
- **Session-scoped, deliberately.** Surviving a reload would need a persisted
  `updatedAt` on the round — a migration for a weaker version of the same
  answer. Recorded as the remaining half of §1.
- One shared `SaveStatus` component for both screens, following the
  `CopyLinkStatus` precedent, so the two surfaces cannot drift apart.

## Changed files

- `src/components/ui/save-status.tsx` (new), exported from `src/components/ui/index.ts`
- `src/components/ui/__tests__/save-status.test.tsx` (new, 7 tests)
- `src/components/round/setup-form.tsx` — dirty tracking on the uncontrolled
  form via `onInput`/`onChange`, plus the status line
- `src/components/survey/survey-builder.tsx` — `markEdited`/`edited` and the
  status line
- `src/app/api/manager/setup/route.ts`, `src/app/api/rounds/[roundId]/survey-definition/route.ts` — `savedAt`
- `docs/openapi.yaml` + generated `public/openapi.json` — `savedAt` on both
  responses; the survey-definition `200` body is now documented at all, which it
  was not (it already returned `closedRoundTitles`)
- `src/app/globals.css` — `.save-status`
- `PROGRESS.md`, `docs/product-behaviour-backlog.md`

## Verification evidence

### Passed

- `npm run verify` — exit code 0 on 2026-08-04: both fitness checks, typecheck,
  **488** TypeScript tests (481 + 7 new), ESLint, production build; **12**
  PostgreSQL tests; **375** Python tests.
- Browser, `dev-inmemory` on `:3100` (in-process repositories, no database):
  - Setup screen: first keystroke → "יש שינויים שטרם נשמרו."; after saving →
    "נשמר בשעה 12:03." with `<time datetime="2026-08-04T09:03:32.139Z">`, which
    is the server's value, not the browser's; editing the notes field →
    "יש שינויים שטרם נשמרו. שמירה אחרונה בשעה 12:03." and the old success note
    disappears.
  - Builder: loading the 24-question template → the pending line; saving →
    "נשמר בשעה 12:08." under the save button, 24 questions across 8 dimensions.
  - No console errors on either screen.

### Blocked or not run

- Nothing was verified against the deployed endpoint; every deployed route
  redirects to `/login`.
- The in-memory run does not exercise the Prisma path for these two endpoints.
  `savedAt` is set in the route after the write returns, so it does not depend
  on the repository, and `verify:db` covers the writes themselves.

### Environment

Local only. `dev-inmemory` (`DATABASE_URL=` empty, `next dev` on `:3100`), the
dev fallback manager password documented in `docs/local-environment.md`, and the
`shalomut_test` container database for `verify:db`.

## Known risks

Low. The one behaviour change beyond the new line is that builder settings edits
now clear the saved state, which they should always have done.

## Approval gates

None.

## Git state

Two commits on this branch, both local and unpushed, on top of
`feat/one-active-round-index` — so pushing this branch lands the partial unique
index as well. Visible only in this worktree until the owner pushes.

## Next concrete step

Owner: push this branch (it carries both slices), then apply the migration that
came with the index branch to the deployed database.

```bash
git push origin feat/last-saved-timestamp:main
```

## Outcome

Merged into `main` as part of `26f4c37` (2026-08-04). No deployment step of its
own: the Vercel GitHub integration builds every push to `main`.
