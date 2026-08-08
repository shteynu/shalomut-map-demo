# The sign-in screen, inside the design system

## Metadata

- Branch: `fix/login-inside-the-design-system`
- Base branch: `fix/error-and-not-found-screens` (itself based on `main` at
  `0cff722`; that branch is not pushed, so this one carries both items)
- Base commit: `3d7fcde`
- Current HEAD: `3d7fcde` (working tree ahead, see Git state)
- Status: implementation complete, verified locally, not committed
- Last updated: 2026-08-08
- Last agent/tool: Claude Code (Opus 5)

## Objective

Item 2 of the frontend UI/UX audit run on 2026-08-08: `/login` was the only
screen written outside the design system.

## User-visible outcome

The first screen a manager ever sees now looks like the product: cream, warm
panel, organic radii, the accent pill button and the same brand mark the header
draws. Its placeholder is readable and its focus ring is the product's.

## Context

The audit measured four separate defects in `src/app/login/page.tsx`:

- Raw Tailwind utilities instead of tokens — `text-slate-700/900/600/400`,
  `bg-white`, `bg-amber-700`, `border-[#d6c49c]`, `rounded-2xl`. `design.md`
  forbids this in as many words: «Don't use standard Tailwind CSS gray-scales».
- `placeholder:text-slate-400` on white measured **2.57:1**, below WCAG AA.
- `tracking-tight` on a Hebrew heading, against `design.md`'s rule that
  letter-spacing is a dead style in Hebrew and the `letter-spacing: 0` the
  stylesheet sets on `html`.
- `focus:outline-none focus:ring-2`, which replaced the global 3px navy
  `:focus-visible` outline with a ring that also fired on mouse clicks.

## Scope

- `src/app/login/page.tsx` — markup and classes only.
- `src/app/globals.css` — one new `.login-*` section, one placeholder rule, two
  one-word fixes to dead custom properties.
- `PROGRESS.md`.

## Non-goals

- Any logic in the sign-in flow. The `window.location.assign` redirect, the
  Suspense boundary, `resolveLoginRedirect` and the error handling are
  untouched, comments included.
- Other audit items.

## Acceptance criteria

- No Tailwind colour or radius utility left on the screen.
- Every text pair on it clears WCAG AA.
- Keyboard focus shows the product's outline.
- The e2e suite, which drives this form, still passes unchanged.

## Relevant repository instructions

- `design.md` — colour tokens, Hebrew typography rules, RTL arrow direction,
  control radii.
- `.agents/skills/shalomut-map/SKILL.md` — RTL-first, WCAG AA, prefer existing
  components and tokens.

## Relevant architecture and contracts

None touched. No API, contract, schema, persistence, privacy or auth surface
changed — the authentication call and its payload are byte-for-byte the same.

## Decisions made

- **Reuse the global form furniture.** The label wraps its input, which is how
  every other form in the product is written and what the global `label` grid
  rule expects. `id`/`htmlFor` stay anyway.
- **The in-field mail and lock icons are gone.** No other field in the product
  has one, `design.md` does not describe the pattern, and they were the reason
  for the physical `pr-10`/`pl-4` padding. Removing them meant no new CSS for
  an icon slot.
- **The brand mark is the header's `.brand-mark`,** markup and all, rather than
  a second hand-built lockup.
- **The submit arrow is `ArrowLeft`, not `LogIn`.** Forward is leftward in
  Hebrew, which is what every other primary button in the product says; the
  `LogIn` glyph is a door drawn for a left-to-right reader.
- **`role="alert"` without `aria-live="polite"`.** The role already implies an
  assertive live region; the two together contradicted rather than softened.
- **The placeholder fix is global, not local.** Removing the Tailwind class
  left the framework default, which composites to `#9b9b9b` — 2.78:1, still a
  failure. One `::placeholder` rule on the global input styles fixes it with
  `--muted` (5.63:1 measured). Exactly two fields in the product carry a
  placeholder: this one and the builder's search.

## Assumptions

- Adding the two missing borders below is a fix, not a redesign: both
  declarations already asked for a border and were silently dropped.

## Completed

All of the above, verified. See `Verification evidence`.

## In progress

Nothing.

## Remaining

Nothing in scope. Commit and push are the owner's to run.

## Changed files

- `src/app/login/page.tsx` — rewritten markup, identical logic.
- `src/app/globals.css` — `.login-page`/`.login-shell`/`.login-intro`/
  `.login-panel`; the `::placeholder` rule; `--danger-surface` → `--red-strong`
  in `.survey-submit-error`; `--border` → `--line` in the builder's `kbd`.
- `PROGRESS.md` — one entry.

Pre-existing and unrelated, left alone: `.idea/shalomut-map-demo.iml`,
`next-env.d.ts`.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0, 739 tests pass.
- `npx playwright test` — all 6 e2e pass, unchanged. These drive this exact
  form: they fill it by accessible label, submit it, assert a wrong password is
  refused, and assert the first sign-in lands without a reload. That is the
  strongest available evidence that the rewrite changed nothing functional.
- Measured in the browser on the running screen, computed styles:
  - label and intro copy on cream — **5.12:1**
  - `h1` ink on cream — **10.66:1**
  - button ink on accent — **4.95:1**
  - field text — **11.73:1**
  - placeholder — **5.63:1** (was 2.57 before the rewrite, 2.78 after removing
    the Tailwind class and before the global rule)
  - `letter-spacing` on the heading — no longer negative
  - real keyboard Tab into the email field — `rgb(45,48,126) solid 3px`, offset
    `3px`: the product's own `:focus-visible`
  - `.survey-submit-error` border — `solid 1px rgb(207,44,78)`, present for the
    first time

### Failed

None.

### Blocked or not run

- The error note was checked visually by injecting the element into the DOM,
  not by signing in wrongly. The refusal path itself is covered by the e2e test
  that passed.
- `verify:db` and `verify:ai` not run: no persistence, API, contract or AI code
  in the diff.
- Deployed verification not run.

## Failed approaches

None.

## Known risks

- **Two borders appear where none did before.** Fixing the dead
  `--danger-surface` and `--border` tokens restores a 1px border on every
  `.survey-submit-error` in the product — six existing screens — and the outline
  on the builder's keyboard-shortcut key caps. Both were always in the
  stylesheet and both were dropped as invalid. This is the one visible change
  this branch makes outside `/login`; it is a restoration, but it is visible.
  Kept, by owner decision on 2026-08-08.
- The in-field icons are gone. Deliberate, recorded above, and reversible.

## Approval gates

None. The authentication call, its payload and its configuration are untouched.

## Questions requiring an owner decision

None open.

- ~~Keep the restored error-note border, or revert to borderless?~~ Kept, owner
  decision 2026-08-08. The borderless look was never designed — it was the
  stylesheet asking for `var(--danger-surface)`, a custom property that has
  never existed, and an undefined `var()` drops the whole declaration. The
  border the rule always intended is now the border on screen.

## Next concrete step

Owner runs `git push origin fix/login-inside-the-design-system:main`. This
branch sits on top of `fix/error-and-not-found-screens`, so that one push
delivers both audit items and the earlier branch needs no push of its own.
