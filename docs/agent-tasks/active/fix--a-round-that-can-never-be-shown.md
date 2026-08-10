# The round that could never be shown is refused

## Metadata

- Branch: `fix/a-round-that-can-never-be-shown`
- Base branch: `main`
- Base commit: `c30a5fc`
- Current HEAD: `c30a5fc` plus one commit on this branch.
- Status: complete and verified locally. Waits on a push.
- Last updated: 2026-08-10
- Last agent/tool: Claude Code (Opus 5)

## Objective

The provable half of axis 7 of `docs/product-strategy-axes-2026-08-10.md`: a
hard block, not a warning, below a staff-size floor.

## User-visible outcome

Saving setup for a school whose staff is smaller than the round's privacy
threshold is refused with `422` and a Hebrew sentence naming both numbers. No
school and no round is written.

## Decisions made

- **The floor is the round's own privacy threshold, not a judgement about small
  staff rooms.** Below it the round is arithmetically incapable of ever
  unlocking: answers are collected that can never be displayed, and the teachers
  who gave them get nothing back. That is provable from two numbers the manager
  already typed. How small a staff room is too small to measure *safely* — the
  deanonymisation question axis 7 actually opens — needs a human and stays open.
- **Equal is allowed.** A staff of exactly ten with a threshold of ten is a hard
  round to run, not an impossible one. This refuses the impossible.
- **Refused in the route, phrased in `src/lib/rounds/staff-floor.ts`.** The
  manager has to be told which two numbers disagree, so a generic 400 from the
  payload parser would not do.

## Not in this slice

The other half of axis 7: the one-page `שימוש הוגן` commitment a manager accepts
at round creation, and any rule about using a round's result in a performance
conversation. Both are product decisions with wording the owner should own.

## Verification evidence

### Passed

- `npm test` — 826 tests, 0 failures, including four new ones: three on the rule
  and one through the route, which also asserts nothing was written.
- `npm run typecheck`, `npm run lint`, `npm run build`.
- `npx playwright test e2e/` — 11 passed.

### Blocked or not run

- Not walked in a browser: the refusal is a server answer, and the setup screen
  renders whatever the route returns. The API test is the evidence.
- `verify:db` and `verify:ai` were not run: no schema, contract, prompt or
  version changed.

### Residual risk

An existing school that shrinks below the floor keeps its running round; this
guards the save, not the past. Nothing in the product re-checks a round already
collecting answers.

## Approval gates

`git push origin fix/a-round-that-can-never-be-shown:main` is the owner's.

## Next concrete step

Push. Then the fair-use half of axis 7, which needs the owner's wording, or the
rest of axis 6 listed in `docs/agent-tasks/active/fix--deltas-stop-overclaiming.md`.
