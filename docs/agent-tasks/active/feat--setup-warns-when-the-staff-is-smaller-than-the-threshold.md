# Setup warns while typing when the staff is smaller than the privacy threshold

## Metadata

- Branch: `feat/setup-warns-when-the-staff-is-smaller-than-the-threshold`
- Base branch: `main`
- Base commit: `a6728fc`
- Current HEAD: see the branch tip; the work is one commit on top of `a6728fc`
- Status: implementation complete, verified locally, waiting on the owner's push
- Last updated: 2026-08-11
- Last agent/tool: Claude Opus 5, Claude Code

## Objective

Cheap win 10 in `docs/product-strategy-axes-2026-08-10.md`: warn at setup when
`totalStaffCount` is below the round's privacy threshold.

## User-visible outcome

On `/setup`, typing a staff count smaller than the privacy threshold shows the
refusal text under the field immediately, naming both numbers. Raising the
threshold above an already-typed staff count brings the same warning back. A
staff that can reach the threshold shows nothing.

## Context

The rule already existed and was already tested — `src/lib/rounds/staff-floor.ts`,
used by `PUT /api/manager/setup`, which answers `422` with the same message.
What was missing is *when* the manager heard it: only after filling the whole
screen and pressing save. Nothing about the rule changed here.

## Scope

- Client-side surfacing of the existing refusal on the setup form.

## Non-goals

- Changing the rule, its wording, or the server's `422`.
- Blocking submit in the client. The server stays the authority; the button is
  deliberately left enabled.
- Axis 7 (how small a staff room is too small to measure safely) stays open.

## Acceptance criteria

- The warning appears while typing, not only on save.
- It moves with the threshold field, not only with the staff field.
- An empty or non-numeric field is silent — `required` owns that case.
- The input points `aria-describedby` at the warning only when it exists.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md`: RTL-first, WCAG AA, status never by
  colour alone, prefer existing components and tokens.
- `.agents/skills/shalomut-verification/SKILL.md`: component/CSS changes need
  targeted tests, `npm run lint`, `npm run build` and a browser smoke.

## Decisions made

- The message comes from `describeStaffFloorRefusal`, not a second copy, so the
  form and the API can never disagree.
- The staff-count input becomes controlled; every other field on the form stays
  uncontrolled and read from `FormData` on submit.
- `role="status"` rather than `alert`: the manager is typing and has not asked
  for anything yet.
- A small presentational component (`staff-floor-warning.tsx`) rather than JSX
  inline in the form, so the rendering is testable without a router.

## Assumptions

- Local production build with the repository's own throwaway smoke fixtures is
  representative of the deployed setup screen for this change. No server code
  changed, so nothing here depends on the deployed environment.

## Completed

- `src/components/round/staff-floor-warning.tsx` — new.
- `src/components/round/setup-form.tsx` — controlled staff count, `useId`,
  warning wired with `aria-describedby`.
- `src/components/round/__tests__/staff-floor-warning.test.tsx` — new, 4 tests.

## In progress

Nothing.

## Remaining

The push. `git push origin feat/setup-warns-when-the-staff-is-smaller-than-the-threshold:main`
is the owner's command.

## Changed files

- `src/components/round/setup-form.tsx`
- `src/components/round/staff-floor-warning.tsx` (new)
- `src/components/round/__tests__/staff-floor-warning.test.tsx` (new)
- `docs/agent-tasks/active/feat--setup-warns-when-the-staff-is-smaller-than-the-threshold.md` (this file)

## Verification evidence

### Passed

- `npx tsx --test src/components/round/__tests__/staff-floor-warning.test.tsx` — 4/4.
- `npm test` — 860 pass, 0 fail.
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeded.
- Browser smoke on a local production build (`next start` on port 3210, signed
  in with the `playwright.config.ts` throwaway fixtures, driven by a temporary
  Playwright script since removed): staff 8 / threshold 10 renders the warning
  and sets `aria-describedby`; staff 30 renders none and clears the attribute;
  staff 14 with the threshold raised to 20 renders it again. Screenshots taken;
  the RTL reading order and the existing error styling are unchanged.

### Failed

None.

### Blocked or not run

- Deployed verification. Not run: no server or contract change, and the
  deployed endpoint would need a school seeded to reach the screen.
- Keyboard-only and screen-reader walk. Not run; the change adds one
  `aria-describedby` and no new focusable control.

### Environment

local

### Residual risk

Low. The one behaviour change beyond the new text is that the staff-count input
is now controlled, so a defect there would show as the field refusing input —
which the browser smoke exercised by typing three different values.

## Failed approaches

None.

## Known risks

None open.

## Approval gates

None. No secrets, credentials, authentication configuration or deployment
alias is touched.

## Questions requiring an owner decision

None for this task. Axis 7 in `docs/product-strategy-axes-2026-08-10.md`
remains the owner's, and this change does not pre-empt it.

## Next concrete step

Owner pushes the branch onto `main`:
`git push origin feat/setup-warns-when-the-staff-is-smaller-than-the-threshold:main`.
