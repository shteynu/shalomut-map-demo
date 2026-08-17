# The round says how it was filled

## Metadata

- Branch: `feat/the-round-says-how-it-was-filled`
- Base branch: `feat/how-long-a-round-took-to-fill` (task B), at `01a0bc7`
- Base commit: `01a0bc7`
- Current HEAD: `01a0bc7`
- Status: opened and scoped, not started
- Last updated: 2026-08-17
- Last agent/tool: Claude Code (Opus 5)

## Objective

Put the filling report on `/round`: a panel that says how long the round's
questionnaires took against the estimate the questionnaire gave, in the warm
design language, with the states that are not "ready" rendered as answers rather
than as failures.

## User-visible outcome

A manager opening the round screen reads how the collection went — the
questionnaire's own estimate, the middle session's length, and how many came
back faster than the instrument can be read. And reads, in the same panel, that
the product will not remove any of them.

## Context

Task C of
[`response-quality-plan-2026-08-17.md`](../../response-quality-plan-2026-08-17.md).
Depends on task B, which is on `feat/how-long-a-round-took-to-fill` and unpushed:
this branch is stacked on it, so landing this one lands both.

`PROJECT_CONTEXT.md` ADR-022 owns what this panel is allowed to say. It is on
the base branch, not on `main`.

## Scope

- A server-side loader beside `loadRoundFunnel`, following its stated reason for
  being a separate read.
- A `RoundFilling` component in `src/components/round/`, RTL-first, WCAG AA,
  status never carried by colour alone.
- Its place on `/round`, next to the funnel.
- Styles grouped with the funnel's rather than duplicated.
- Component tests through `renderToStaticMarkup`, as the round components are
  tested now.

## Non-goals

- No API route. `/round` is a server component and the funnel loads the same
  way.
- No exclusion control, no per-response row, no individual duration, no "what
  would change if". ADR-022.
- No change to task B's service or module. If the screen wants a number that is
  not there, that is a finding to record, not a field to add quietly.

## Acceptance criteria

- All four states render something a manager can act on: no questionnaire, below
  the privacy threshold, ready with nothing measurable, ready with a report.
- No string says or implies that a respondent may be removed, and no string says
  "spent" — a duration here is a session's lifetime.
- A round where nobody was fast says so plainly. That is the case the whole
  shape of task B was chosen for.
- Nothing carries meaning by colour alone.
- `npm run verify:core` passes.

## Relevant repository instructions

- `AGENTS.md` — never expose respondent identity or detailed results below the
  configured privacy threshold.
- `.agents/skills/shalomut-map/SKILL.md` — RTL-first, warm tokens, first-class
  empty/loading/error/privacy-locked states.
- `.agents/skills/shalomut-verification/SKILL.md` — before claiming completion.

## Relevant architecture and contracts

- `RoundFunnel` is the nearest neighbour in purpose and shape: a panel of
  counts about sessions rather than people, with the one detail that could
  describe an individual suppressed until it describes a pattern.
- `loadRoundFunnel` in `src/lib/server/manager-context.ts` is the loader shape,
  including why it is a separate read rather than folded into
  `ManagerContextService.load`.
- `RoundFillingService.getRoundFilling` returns `no-questionnaire`,
  `below-privacy-threshold` or `ready`.

## Decisions made

None yet beyond the scope above.

## Assumptions

- The panel appears as soon as the round's privacy threshold is met, whether or
  not the round is closed. That is what the service gates on and what the owner
  asked for on 2026-08-17; §10 of the research left "before or after closing"
  open, and gating on the threshold answers it without adding a second rule.

## Completed

Nothing yet.

## In progress

Nothing.

## Remaining

Everything in Scope.

## Changed files

- `docs/agent-tasks/active/feat--the-round-says-how-it-was-filled.md` (new, this
  file)

`next-env.d.ts` carries a pre-existing unstaged modification that predates this
branch and is not part of this task.

## Verification evidence

### Passed

None for this branch yet.

### Failed

None.

### Blocked or not run

Everything. No code has changed.

### Environment

Local worktree only. Nothing deployed, no database read or written.

### Residual risk

None yet — no code has changed.

## Failed approaches

None yet.

## Known risks

- This is the first screen the feature has, and the first chance for the copy to
  overstate what the number means. A duration is an upper bound on attention,
  never a measurement of it, and the panel has to say so where a manager will
  read it rather than in a docblock.
- The panel is a signed-in manager screen, so verifying it in a browser needs
  the owner's own session. Component tests cover the markup; they do not cover
  how it looks.

## Approval gates

None. No secrets, credentials, authentication configuration or deployment alias
is touched.

## Questions requiring an owner decision

- None blocking.

## Next concrete step

Write `loadRoundFilling` beside `loadRoundFunnel`, then the `RoundFilling`
component with its four states, starting from the state that decided task B's
shape: a round nobody rushed has to read as good news, not as an absence.
