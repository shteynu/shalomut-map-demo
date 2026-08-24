# The audit log gets a reader

## Metadata

- Branch: `feat/the-audit-log-gets-a-reader`
- Base branch: `main`
- Base commit: `fcfe20f`
- Current HEAD: `fcfe20f`
- Status: in progress
- Last updated: 2026-08-24
- Last agent/tool: Claude Opus 5 / Claude Code

## Objective

Give the administrative audit log a screen. Every administrative mutation has
been recorded since 2026-08-23 and the read side has been paginated,
cursor-bounded and tested since `66cc19d` — but `getOrganizationAuditLogs` has
**zero production callers**, so nothing in the product can show what was
recorded.

## User-visible outcome

A platform administrator opens a school and reads what was done in it: who
acted, when, on which round, newest first, one bounded page at a time.

## Context

- Owner decision 2026-08-23: the administrative audit is mandatory — the write
  and its record commit together. A record nobody can read is half of that.
- `ManagerAuditService.getOrganizationAuditLogs` already decides who may read a
  school's log: a platform administrator may read any school's, a member may
  read their own. That authorization is written and untested against a caller.
- `docs/critical-audit-2026-08-21.md` closed the retention finding «в части
  чтения» and noted that the read is bounded *before* a screen exists. This is
  that screen.

## Scope

- One administrator-only screen for one school's log, reached from the
  administrator console and from the main navigation.
- Cursor pagination carried in the URL, matching the console's «the address bar
  is the state».
- Hebrew labels for every `AuditActionType`.

## Non-goals

- No cross-school log. The repository reads one school and this screen does not
  change that.
- No retention or deletion. That is an owner question, still open.
- No new API route: the screen is server-rendered, so nothing is added to the
  endpoint surface or to `docs/openapi.yaml`.
- Not deciding whether a school's own user may read their school's log — kept
  administrator-only, which is what the service's own comment leaves open.

## Acceptance criteria

- A platform administrator reaches the log for any school and reads it.
- A school user cannot: the middleware turns the path away and the tab is not
  rendered.
- Opening the screen over a school the administrator is not a member of is
  recorded, like every other manager screen, through `loadManagerContext`.
- `npm run lint:tenant-chokepoints` and `npm run lint:composition` still pass —
  the page reads through the chokepoint rather than resolving repositories.

## Relevant repository instructions

- `AGENTS.md`, `.agents/skills/shalomut-map/SKILL.md` (screens enter through
  `loadManagerContext`; RTL-first; WCAG AA; existing components first),
  `.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

- ADR-026 — an administrator's read of a school they do not belong to is
  refused when it cannot be written down.
- ADR-049 — the audit log's bounded read and its cursor.
- Phase 6 of `docs/multi-tenancy-plan-2026-08-20.md` — a school user reads and
  does not act; administrator-only screens are one list in `navigation.ts`.

## Decisions made

_To be recorded as the work lands._

## Assumptions

- Administrator-only. The service's own comment leaves «whether a school's own
  user should see the visits made to it» open, so the screen takes the narrower
  answer and the question stays open rather than being answered by a screen.

## Completed

_Nothing yet._

## In progress

- Implementation.

## Remaining

- Implementation, tests, verification.

## Changed files

_None yet._

## Verification evidence

### Passed

- Before any change, on `fcfe20f`: all thirteen cheap checks green —
  `lint:skills`, `lint:doc-numbers`, `lint:audit-count`, `lint:composition`,
  `lint:literals`, `lint:fonts`, `lint:error-bodies`, `lint:deploy-migrations`,
  `lint:tenant-chokepoints`, `lint:interpreter`, `lint:mutation-config`,
  `lint:contract-refusals`, `lint:fixtures`.

### Failed

_None._

### Blocked or not run

- `npm test`, `typecheck`, `lint`, `build` — not run yet on this branch.

### Environment

- Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`.

### Residual risk

_To be recorded._

## Failed approaches

_None yet._

## Known risks

_To be recorded._

## Approval gates

- None. No secret, no credential, no authentication configuration, no alias.

## Questions requiring an owner decision

- Whether a school's own user may read their school's audit log. Left open
  deliberately; the screen is administrator-only until it is answered.

## Next concrete step

Add the route, the loader and the screen, then the tests.
