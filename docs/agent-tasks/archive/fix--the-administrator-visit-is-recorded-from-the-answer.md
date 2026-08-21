# The administrator's visit is recorded from the school that answered

## Metadata

- Branch: `feat/what-the-administrator-sees` (shared with the archived phase-4
  record beside this one; this work landed on the same branch afterwards)
- Base branch: `main`
- Base commit: `29ac8ec`
- Current HEAD: `bbcc41b`
- Status: complete, pushed and proved on the deployed endpoint
- Last updated: 2026-08-21
- Last agent/tool: Claude Opus 5 / Claude Code

## Objective

Close the audit gap found while walking the deployed endpoint's new Google
sign-in: a platform administrator who belongs to no school read that school's
screens without leaving a row in `audit_events`, whenever exactly one school
existed.

## User-visible outcome

Nothing a manager sees changes. What changes is what an administrator's reading
leaves behind: a row naming the school whose data was on the screen.

## Context

The gap was found rather than reported. Signing in with Google on the deployed
endpoint lands on `/setup/`, that screen rendered the demo school's name, city,
staff count and round dates, and `audit_events` stayed at 0; the same page with
`?school=<id>` recorded a row immediately.

`loadManagerContext` recorded from the request: the school had to arrive in
`MANAGER_ORGANIZATION_HEADER`, which the middleware sets from `?school=` or the
remembered-school cookie. For an administrator with no memberships and no
cookie the middleware sets no header at all — `defaultSchool` is
`schools[0]` of an empty membership list — and `resolveOrganizationId` then
hands back the only school that exists to a request that named none.

Most manager requests name no school: the choice is made once on the setup
screen and every other screen carries a round in its URL. So the gap was not an
edge case but the ordinary path, and on a one-school deployment it was every
reading there is.

## Scope

- `recordManagerScreenVisit` in `src/lib/server/manager-scope.ts`, given the
  loaded `ManagerContext`.
- `loadManagerContext` records after the load instead of before it.
- Tests for the header-less administrator, the context that reached no school,
  the refusal when the store is broken, and the school user who is not affected.
- The documents that claimed the chokepoint already did this.

## Non-goals

- Changing `resolveOrganizationId`. Adopting the only school is the behaviour
  that makes a one-school deployment usable; it was the recording that was
  wrong, not the adoption.
- Making the administrator name a school before any screen renders. That was
  the other option and the owner chose this one.
- Anything about who may *read* `audit_events`, which is still undecided and
  has no addressee until there are real schools.

## Acceptance criteria

- An administrator's request that names no school leaves a row naming the school
  that was shown.
- A request naming a school that does not exist leaves a row naming the school
  that was shown, not the one asked for.
- A context that reached no school leaves nothing.
- A read whose visit cannot be recorded is still refused.

## Relevant repository instructions

- `AGENTS.md` — never expose respondent identity below the privacy threshold;
  this touches the audit log, not results.
- `.agents/skills/shalomut-verification/SKILL.md` — checks chosen from the diff.

## Relevant architecture and contracts

`PROJECT_CONTEXT.md`, the `audit_events` section: the two chokepoints, the
fail-closed rule for an administrator's read, and the fifteen-minute
deduplication window. The correction is recorded there.

## Decisions made

- **The record is taken after the context resolves.** The school a request was
  answered with is only known once it has been answered, so a page that is then
  refused has already paid for its reads. `authorizeManagerRound` already made
  this trade for the round routes.
- **A context with no organization records nothing** — there was no reading.

## Assumptions

- `recordAdministratorSchoolVisit` returning `true` for members and for
  non-administrators stays the definition of "not an event". Unchanged here.

## Completed

- `dc6c176` — the fix and its tests.
- `179600c` — `PROGRESS.md`, `PROJECT_CONTEXT.md` and the handoff, which all
  claimed the chokepoint already recorded every reading.
- `083cbe4` — the deployed evidence.
- `bbcc41b` — the backlog's §12 state, which was stale, and a next step that
  does not name unstartable work.

## In progress

Nothing.

## Remaining

Nothing on this branch.

## Changed files

- `src/lib/server/manager-scope.ts`, `src/lib/server/manager-context.ts`
- `src/lib/server/__tests__/administrator-visit-audit.test.ts`
- `PROGRESS.md`, `PROJECT_CONTEXT.md`,
  `docs/shalomut-tracker-handoff.md`, `docs/product-behaviour-backlog.md`

## Verification evidence

### Passed

- `npm test` — 1346/1346, including four new tests.
- `npm run typecheck`, `npm run lint`, `npm run build`.
- `npm run lint:composition`, `lint:doc-numbers`, `lint:skills`.
- `npm run verify:core` at close of session.
- **Deployed, against `179600c`.** Signed in with Google, landed on `/setup/`
  with no `?school=`, saw the demo school; `audit_events` went 1 → 2, the new
  row naming the demo school with no round, 11:38:06Z. Then
  `/setup/?school=00000000-0000-0000-0000-000000000000`: the screen fell back to
  the demo school and the row names **the demo school**, not the id asked for —
  the case that separates this version from the one before it, and one that does
  not depend on whether the browser still held a remembered-school cookie.

### Failed

None.

### Blocked or not run

- `verify:db` — no migration; `prisma/` is untouched.
- `verify:ai`, `lint:fixtures`, mutation testing — nothing here touches the AI
  contract or the Python service.

### Environment

Local worktree plus the deployed endpoint and its database, read through
`.env.deployed.local`. No local dev server was needed.

### Residual risk

A third row appeared 72 seconds after the second, same administrator and school:
the fifteen-minute deduplication window is process-local and two Vercel
instances do not share it. Documented behaviour — the log would rather hold a
visit twice than miss it — and worth knowing before a duplicate is read as a
defect.

## Failed approaches

Reproducing the original observation in the connected Chrome was not conclusive
on its own: the remembered-school cookie is `httpOnly` and may have survived
from the earlier `?school=` walk, which would have supplied the header and made
the old code record too. The nonexistent-school request was used instead,
because its row is wrong under the old version and right under the new one
whatever the cookie held.

## Known risks

None outstanding for this change.

## Approval gates

None. The owner's standing items — rotating `GEMINI_API_KEY` and deleting the
unused Google client secret — are unrelated to this work.

## Questions requiring an owner decision

None. The choice between recording the adopted school and forcing the
administrator to name one was put to the owner and answered: record it.

## Next concrete step

None on this branch. The session's step is in
[`shalomut-tracker-handoff.md`](../../shalomut-tracker-handoff.md).
