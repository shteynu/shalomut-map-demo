# Keyboard accelerators for the builder's per-question actions

## Metadata

- Branch: `feat/builder-keyboard-accelerators`
- Base branch: `feat/last-saved-timestamp` (itself on `feat/one-active-round-index`, on `main` = `3adb18a`)
- Base commit: `a394e60`
- Current HEAD: the two commits under `Git state`
- Status: implementation complete, verified locally, unpushed
- Last updated: 2026-08-04
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the last remaining item of `docs/product-behaviour-backlog.md` §3:
accelerators for the per-question builder actions. This is speed, not access —
every action was already a native button reachable by Tab.

## User-visible outcome

Inside the question the caret is in: `Alt+↑`/`Alt+↓` move it, `Alt+E` opens the
editor, `Alt+D` duplicates, `Alt+H` hides or restores, `Alt+R` switches
required. Screen-wide: `/` focuses the search field, `Ctrl`/`Cmd+S` saves.

The chords are listed above the question list and repeated in each button's
tooltip and `aria-keyshortcuts`.

## Decisions made

These were the agent's calls, made rather than asked, and each is one edit to
reverse:

- **Alt is the modifier.** Ctrl/Cmd belong to the browser; Alt+letter and
  Alt+arrow are the combinations a page can take without shadowing something a
  manager relies on.
- **The chords are read from `event.code`, the physical key.** On a Hebrew
  layout `event.key` for the D key is `ג`, so a character-matched shortcut would
  work only for managers typing English — which is no manager. When a keyboard
  reports no physical key at all (on-screen and IME keyboards do this), the
  character is read as a fallback and a Hebrew letter simply matches nothing,
  which is the honest outcome rather than a wrong action.
- **Nothing destructive gets a chord.** Delete stays a button press with its
  confirmation.
- **The move is on the arrow keys**, not left/right: up and down mean the same
  thing in RTL as in LTR, while a left/right chord would have to reverse with
  direction.
- **The action target is the caret's card**, so no "selected question" concept
  had to be invented.
- **A chord that cannot act is not swallowed** — moving the first question up
  leaves the browser's own behaviour alone.
- **`Ctrl/Cmd+S` is taken over only when saving is possible**; otherwise the
  manager gets the browser dialog they know rather than nothing.
- **`/` stands down inside text fields**, where a slash is a character.

## Changed files

- `src/components/survey/survey-builder/keyboard-accelerators.ts` (new, pure)
- `src/components/survey/__tests__/keyboard-accelerators.test.ts` (new, 10 tests)
- `src/components/survey/survey-builder/survey-question-card.tsx` — the
  per-question handler, `aria-keyshortcuts` and tooltips; the two toggles now
  share one `toggle` helper
- `src/components/survey/survey-builder/survey-builder-questions.tsx` — the
  visible legend and the search input's ref
- `src/components/survey/survey-builder.tsx` — the screen-wide handler
- `src/app/globals.css` — `.survey-builder-shortcut-note` and `kbd`
- `PROGRESS.md`, `docs/product-behaviour-backlog.md`

## Verification evidence

### Passed

- `npm run verify` — exit code 0 on 2026-08-04: both fitness checks, typecheck,
  **498** TypeScript tests (488 + 10 new), ESLint, production build; **12**
  PostgreSQL tests; **375** Python tests.
- Browser, `dev-inmemory` on `:3100`, questionnaire loaded from the 24-question
  template, every chord driven through real key events:
  - `Alt+↓` in question 1's text field swapped questions 1 and 2;
  - `Alt+D` took the list from 3 to 4 visible questions, duplicating the focused
    one, and inserted no character into the textarea;
  - `Alt+H` turned the tags to מוסתרת, `Alt+R` to רשות, both without touching
    the wording;
  - `Alt+E` opened the edit dialog on the right question ("עריכת שאלה 2");
  - `/` from outside a field focused the search input and typed nothing into it;
  - `Ctrl+S` from inside the search field saved — the status line moved to
    "נשמר בשעה 12:36".
  - No console errors.

### Failed, then fixed

The first browser run did nothing at all: the automation sends key events with
an empty `event.code`, and the matcher read only `code`. That is also what
on-screen and IME keyboards do, so it was a real gap rather than a harness
artifact — hence the documented character fallback, with tests for both halves.

### Blocked or not run

- The frozen-questionnaire case (a round with responses) was not exercised in a
  browser; the handler returns early on `isFrozen`, which no test drives.
- macOS was not tested with a physical Option key. On macOS `Option+letter`
  normally composes a character; the handler calls `preventDefault`, so it
  should not, but this deserves a look on the owner's machine — it is the one
  claim here that rests on reasoning rather than observation.

### Environment

Local only: `dev-inmemory` (`DATABASE_URL=` empty), dev fallback manager
password from `docs/local-environment.md`, `shalomut_test` container database
for `verify:db`.

## Known risks

Low and contained: an accelerator that misfires costs one undoable edit, and the
destructive action deliberately has none.

## Approval gates

None.

## Git state

Two commits on this branch, local and unpushed, stacked on
`feat/last-saved-timestamp` and `feat/one-active-round-index` — pushing this
branch lands all three slices.

## Next concrete step

Owner: push this branch, which carries all three of today's slices.

```bash
git push origin feat/builder-keyboard-accelerators:main
```

Then apply the migration from the index slice to the deployed database with
`npm run db:migrate:deploy`.
