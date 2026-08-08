# The privacy tooltip's bullets stop shouting

## Metadata

- Branch: `fix/privacy-tooltip-bullet-size`
- Base branch: `docs/archive-frontend-audit-tasks`
- Base commit: `610e24f` (itself one commit ahead of `origin/main` at `6c232a8`)
- Current HEAD: `57dda52`, which is also `origin/main`. This task's own commits
  are `5ffdd91` (the rule), `fffb364` and `57dda52` (this file) and `d1395bd`
  (the tracker note).
- Status: closed — pushed to `main` on 2026-08-08 and confirmed on the deployed
  endpoint
- Last updated: 2026-08-08
- Last agent/tool: Claude Code (Opus 5)

## Objective

On the home screen, the three bold lead-ins inside the privacy tooltip render
at 46.4px and push the text out of the panel. Make them the 0.88rem the rule
always intended.

## User-visible outcome

A manager who opens the privacy explanation on `/` reads it. Today the middle
of it is a headline with the sentence spilling past the panel edge.

## Context

Found on 2026-08-08 by walking the deployed product in the owner's signed-in
browser — not by a test, and not by the audit that had just refactored this
component.

Two rules match `<strong>` inside a tooltip bullet, at identical specificity
`(0,1,1)`:

```
.custom-tooltip-content strong { font-size: 0.88rem }   /* line 4657 */
.stat-stone strong             { font-size: 2.9rem  }   /* line 4887 */
```

`PrivacyTooltip` is planted inside `StatStone` on the home screen, so both
apply, and the later one wins. 2.9rem is the stone's big number; the tooltip
inherits it because the selector is a descendant selector rather than a child
selector.

**This is not a regression.** `git show 8b7263a^` confirms the pre-refactor
markup set only `marginBottom` inline on each `<li>`; the `<strong>` inside it
never carried a size, so `.stat-stone strong` won there too. The bug shipped
with the component.

**The audit should still have caught it.** `chore/frontend-audit-minor-items`
moved this component's inline styles into classes and scoped five of them
against exactly this collision — and then verified the five it had written
rather than the tooltip it had changed. A screenshot of the open tooltip would
have shown it immediately. The computed-style fingerprint could not: it detects
*change*, and this element renders at 46.4px before and after.

Scope of the bug: the home screen only. `/setup` and `/survey` measure 14.08px,
because of the eighteen `strong { font-size }` rules in the stylesheet only
`.stat-stone strong` and `.workflow-card strong` are descendant selectors that
reach into a planted tooltip; the rest use `>`.

## Scope

One rule in `src/app/globals.css`.

## Non-goals

- Rewriting `.stat-stone strong` as a child selector. It would fix this case
  and is arguably more correct, but it changes a rule six other screens rely on
  to fix a problem that belongs to the tooltip.
- Auditing every other component that could be planted inside another.

## Acceptance criteria

Every text-carrying node inside the tooltip is at tooltip size, in every host
that plants one, and the panel does not overflow.

## Relevant repository instructions

- `AGENTS.md` — verify in proportion to risk; never record a check that did not
  run.
- `design.md` — component 1 (`.stat-stone`) and the tooltip's own sizes.

## Relevant architecture and contracts

None touched.

## Decisions made

- **Scope the rule, do not raise `.custom-tooltip-content strong`.** Making the
  general rule win everywhere means beating whatever host it lands in, which is
  an arms race. `.custom-tooltip-content .privacy-tooltip-reasons strong` is
  `(0,2,1)`, beats `.stat-stone strong`, and cannot touch the tooltip title —
  the title is not inside `.privacy-tooltip-reasons`.
- **The check looks at every text node, not at a list I chose.** The previous
  check asserted five hand-picked elements and walked past the three that were
  broken. The new one enumerates every element in the tooltip carrying text and
  fails on anything above 17px.

## Assumptions

None.

## Completed

The rule, and a check proved to fail without it.

## In progress

Nothing.

## Remaining

Nothing.

## Changed files

- `src/app/globals.css` — one rule with a comment naming the collision.

Pre-existing and unrelated, left alone: `.idea/shalomut-map-demo.iml`,
`next-env.d.ts`.

## Verification evidence

### Passed

- **The check fails without the fix and passes with it**, which is the only
  thing that makes it evidence. Throwaway spec, signed in, on a production
  build: it opens every `.custom-tooltip-trigger` on `/`, `/setup` and
  `/survey`, enumerates all 11 text-carrying nodes in each tooltip and asserts
  none exceeds 17px.
  - Without the rule: `/` reports
    `[{STRONG, 46.4, "הגנה על אנונימיות"}, {STRONG, 46.4, "שיקוף משוב כנה"},
    {STRONG, 46.4, "מהימנות הנתונים"}]` and the test fails.
  - With the rule: all three hosts report `oversized: []` and no sideways
    overflow.
- `npm run verify:core` — exit 0, 739 tests pass, lint clean.
- `npx playwright test` — all 6 e2e pass.
- `npm run build` clean.
- **Confirmed on the deployed endpoint, 2026-08-08**, in the owner's signed-in
  Chrome, after the push and the redeploy. The served chunk
  `1jqn_40hp-si6.css` is byte-identical to the local build (103 928 bytes,
  `cmp` clean) and contains `privacy-tooltip-reasons strong{font-size:.88rem}`.
  With the tooltip open on `/`: all three bullet lead-ins measure 14.08px where
  they measured 46.4px, none of the 11 text nodes exceeds 17px, the panel is
  371x386 fully inside the viewport with `scrollHeight == clientHeight`, and
  `.stat-stone > strong` is still 46.4px — the stone's own number was not
  quieted along with the tooltip. A screenshot shows the bullets reading as
  sentences.
  - The first probe caught the previous bundle still being served; the check
    was repeated once the new chunk went live.

### Failed

None.

### Blocked or not run

- The computed-style fingerprint was not re-run. It would pass vacuously: the
  tooltip is `display: none` when closed, so the harness never sees the element
  this branch changes.
- `verify:db` and `verify:ai` not run: one CSS rule.

### Environment

Local; `npx next start` on port 3100 with the harness's throwaway credentials.
The bug itself was found on `https://shalomut-map-demo.vercel.app/` in the
owner's signed-in Chrome.

### Residual risk

Very low. One rule, two classes deep, scoped to a list that exists in one
component.

## Failed approaches

None on this branch. The failure worth recording belongs to the branch before
it and is written up under Context.

## Known risks

The same collision can happen to any component planted inside another that
styles bare elements by descendant selector. Nothing in the build catches that
class of bug; `design.md`'s naming rule and the comment on this rule are the
only guards.

## Approval gates

None.

## Questions requiring an owner decision

The throwaway check was deleted rather than added to the suite, because
`playwright.config.ts` argues at length for one smoke path instead of a broad
e2e suite and this would be the first departure. If you would rather have a
standing guard against tooltip text rendering at headline size, say so and it
becomes a seventh test.

## Next concrete step

None. The work is in `main`, confirmed on the endpoint, and this file is
archived. The one question it leaves behind — whether the tooltip check becomes
a standing test — is carried in `docs/shalomut-tracker-handoff.md`.
