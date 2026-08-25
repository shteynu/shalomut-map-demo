# The caret that was an M

## Metadata

- Branch: `fix/round-switcher-caret`
- Base branch: `main`
- Base commit: `d4a0354`
- Current HEAD: this file's own commit
- Status: in progress
- Last updated: 2026-08-25
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Sweep the screens the previous two branches did not audit, and fix what the
sweep finds. It found one thing: the round switcher's caret.

## User-visible outcome

The control that switches rounds, schools and breakdowns has a downward caret
instead of two detached corner ticks that read as a pair of quotation marks.

## Context

The caret is drawn without an image — two square tiles, each filled diagonally
by a `linear-gradient`, placed side by side so their hypotenuses meet into a
triangle. A 45deg gradient fills its tile's **top-right** corner and a 135deg
one fills the **top-left**, so the 45deg tile has to be the inline-start half.
The pair was reversed, so the two halves met at their outer corners and drew an
M: two peaks with a valley between them, about the size of a pair of quotation
marks, on every screen that switches a round.

The recipe this came from anchors both tiles on `right`, where that order is
correct. Anchored on `left`, as this RTL product does, the order flips. That is
the whole of the defect and the whole of the fix.

## Scope

- `background-position` on `.round-switcher select`, `.breakdown-picker select`
  and `.school-switcher select` — one rule, three selectors.
- A guard in the smoke suite.

## Non-goals

- The other selects in the product. The survey builder's per-question selects
  keep `appearance: auto` and the browser's own arrow; that the app has two
  select looks is a design question, not a defect.
- The 1px seam where the two tiles meet, visible only above about 4× zoom.
  Replacing the pair with one inline SVG would remove it and would also stop the
  caret following `--accent-dark`, which is the worse trade.

## Acceptance criteria

- The caret renders as a downward triangle at device scale 1 and at 6.
- A guard fails if the two halves are put back the wrong way round.
- `verify:core` and the full Playwright suite pass.

## Relevant repository instructions

- `AGENTS.md`: verify in proportion to risk; record only verification that ran.

## Relevant architecture and contracts

None touched. One stylesheet, one spec.

## Decisions made

- The guard asserts the **order of the two halves**, not pixels. A pixel
  baseline for a 10px mark is a screenshot to maintain forever, and the order is
  the whole of the rule. It also names the trap: if the anchor ever moves from
  `left` to `right`, the comparison is the thing to re-derive, not the
  stylesheet.

## Assumptions

None.

## Completed

- The two `background-position` values swapped, with the reason in the rule.
- `the round switcher wears a caret and not an M` in `e2e/smoke.spec.ts`,
  negative-checked.

## Remaining

Nothing on the branch. The push is the owner's.

## Changed files

- `src/app/globals.css`
- `e2e/smoke.spec.ts`
- `docs/agent-tasks/active/fix--round-switcher-caret.md` (this file)

## Verification evidence

### Passed

- `npm run verify:core` — exit 0. 1654 Node tests, 587 Python tests, all lints.
- `npm run test:e2e` — 34 passed, the new guard among them.
- Negative check: with the two positions put back, the guard fails with
  *"the two halves of the caret do not meet … (45deg at 16.8px, 135deg at
  12px)"*.
- The caret photographed from the built stylesheet at device scale 6 and at 1:
  a downward triangle in both. Before the fix, at 6, two peaks with a valley.

### The sweep behind this branch, and what it cleared

Every manager screen was walked by script at 1440, 820 and 390 px — home,
round, setup, survey builder, locked dashboard, open map, breakdown, goals,
activity, help, api-docs, the 404 — measuring page overflow, elements leaving
the viewport, text clipped by its own box, marks escaping a parent's rounded
shape, sub-30px targets and console errors. The respondent questionnaire was
walked at 390 and 1440, intro and first step.

What came back was one defect and a list of things that look like defects to a
script and are not. Recorded because each cost a look, and the next sweep will
raise them again:

- **The respondent questionnaire is clean** at both widths: no overflow, no
  clipped text, no small targets, no console errors.
- `.action-card-glow` leaves the viewport by 240px and is clipped by its card's
  `overflow: hidden`. A script that only looks for `overflow-x: auto|scroll`
  ancestors calls that an escape.
- `span.visually-hidden`, the truncated identity address and the help button's
  label are all *meant* to be cut — `clip-path: inset(50%)` and a deliberate
  ellipsis.
- The help disclosure's links have layout boxes while the `<details>` is closed,
  so an overlap check finds them "covered" by whatever paints above them. Opened
  for real, on four screens at two widths, the panel is fully on screen and no
  link is blocked.
- Nothing is permanently hidden behind a sticky bar: every page was scrolled to
  its end before the overlap check ran, including `/setup`, whose save bar is
  the only sticky footer in the product.
- The status line on a map stone has a box wider than the shape's foot, but its
  text is centred and stays well inside. Photographed at 3× to be sure.
- The decorative washes — `.stone-page .form-panel::before` and the pale shape
  on the locked map — are clipped along their container's own curve, not into
  straight edges. They read as artifacts only in a downscaled full-page capture.
- The Next.js dev-tools badge appears in dev-server full-page screenshots as a
  dark circle in the middle of the page. It is `NEXTJS-PORTAL`, not product.

### Blocked or not run

- **The administrator console.** Locally the password account is a member of one
  school and an administrator of nothing, so `/admin` and `/admin/activity`
  redirect home — the sweep's screenshots for them are the home screen, byte for
  byte. On the deployment the owner *is* an administrator, but the session
  expired before that walk; `e2e/administrator-console.spec.ts` covers the
  screens on the second server.
- **The breakdown and goals screens with data.** The seeded questionnaire has no
  background question and the seeded round has no goal, so both screens were
  read in their empty state only.
- **A dimension screen with a real analysis.** Unchanged from the last branch:
  producing one is a paid provider call.

### Environment

`next start` on 3210 against the disposable PostgreSQL in `shalomut-local-db`,
seeded by `seed-local.ts`; Playwright drove it. A production server rather than
`next dev` on purpose — the dev overlay paints into full-page screenshots.

### Residual risk

The guard reads `background-position` as Chrome normalizes it (`12px 55%`). A
future `calc()` or a `right` anchor would make the numbers meaningless; the spec
asserts they parse as lengths and says so in its failure message.

## Failed approaches

- Splitting `background-image` on commas to count the gradients. Every gradient
  carries `rgba(…)` stops with commas of their own, so two images came back as
  six and the guard failed on its own parsing before it reached the defect.

## Known risks

None known.

## Approval gates

`git push` is the owner's.

## Questions requiring an owner decision

Two observations from the sweep, neither a UI defect and neither acted on:

- `/round/` asks for `/api/rounds/<active round>/ai-insights/` and is answered
  `404` while the round is still collecting. The screen handles it, but every
  visit writes a red line to the browser console. Whether "no analysis yet" is a
  404 or a 200 with an empty body is an API contract question.
- The manager session on the deployment expired twice inside about a quarter of
  an hour during this session's walks. Session lifetime is authentication
  configuration, which `AGENTS.md` puts behind an explicit approval gate.

## Next concrete step

Push `fix/round-switcher-caret` to `main` and confirm the deployment answers the
new commit.
