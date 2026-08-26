# A skill for the repository's fitness gates

## Metadata

- Branch: `claude/useful-repo-skill-wfad6a`
- Base branch: `main`
- Base commit: `24ed8bc`
- Current HEAD: `b679fc3`
- Status: implementation complete, awaiting review
- Last updated: 2026-08-26
- Last agent/tool: Claude Code (remote session)

## Objective

Add the skill the repository was missing: the one that owns how a rule becomes
a gate, and make the new inventory of gates enforceable rather than prose.

## User-visible outcome

An agent that meets a red `lint:*` gate, or that wants to make a new rule
checkable, is routed to `.agents/skills/shalomut-guardrails/SKILL.md` and finds
the mechanism, the required shape and the route from a failure message to the
rule it defends.

## Context

The repository had three skills — product, tracker, verification. Sixteen
`lint:*` commands (fifteen before this task) carry rules nothing else states,
all of them chained into `verify:core`, almost all of them a
`scripts/check-*.mjs` with a paired test and a doc-comment recording the
incident that produced the rule. Nothing described that mechanism, and
`lint:deploy-migrations`, `lint:error-bodies` and `lint:docs-publish` were named
in no skill and no living document.

## Scope

- New canonical skill `shalomut-guardrails` with a `references/inventory.md`.
- New gate `lint:gate-inventory` with `scripts/check-gate-inventory.mjs` and its
  paired test, chained into `verify:core`.
- Routing in `AGENTS.md`, the Copilot adapter, and a matrix row in
  `shalomut-verification`.

## Non-goals

- Changing any existing gate's rule, message or coverage.
- Documenting `openapi:check` / `docs:endpoints:check` as `lint:*` gates; they
  belong to their generators and the inventory says so in prose.
- Product, UI or contract behaviour: nothing under `src/` changed.

## Acceptance criteria

- `npm run lint:skills` passes with four canonical skills and four adapters.
- `npm run lint:gate-inventory` passes and fails on each of its four rules in
  its own test.
- Every `lint:*` command is a `verify:core` step and is named in the inventory.

## Relevant repository instructions

`AGENTS.md` (skill routing, one canonical set, branch-scoped task state),
`.agents/skills/shalomut-verification/SKILL.md` (which checks a diff owes).

## Relevant architecture and contracts

None touched. The change is agent instructions plus one repository-shape check.

## Decisions made

- The inventory lives inside the skill as a `references/` file, so the skill
  that routes a failure owns the route.
- Enforcement is a new gate rather than a rule bolted onto
  `check-agent-skills.mjs`: one check, one concern, and it builds the new gate
  by the recipe the new skill documents.
- The gate checks the `lint:*` family only. Membership in `verify:core` is
  matched per `&&` step, not by substring, so `lint:doc` cannot pass on
  `lint:doc-numbers`.
- The skill is written in Russian, like its three siblings.

## Assumptions

- `verify:core` stays the single chain CI runs; `.github/workflows/verify-core.yml`
  still runs exactly that.

## Completed

- `.agents/skills/shalomut-guardrails/SKILL.md` and `references/inventory.md`.
- `scripts/check-gate-inventory.mjs` and `scripts/check-gate-inventory.test.mjs`.
- `package.json`: `lint:gate-inventory` added and chained after `lint:skills`.
- Routing in `AGENTS.md` and `.github/copilot-instructions.md`; matrix row in
  `.agents/skills/shalomut-verification/SKILL.md`.

## In progress

None.

## Remaining

Review of the inventory's prose: the gate proves each row exists, never that the
row describes its check truthfully.

## Changed files

Committed in `b679fc3`; nothing staged, unstaged or untracked apart from this
task file.

## Verification evidence

### Passed

- `node --test scripts/check-gate-inventory.test.mjs` — 12/12.
- `npm run lint:gate-inventory` — 16 gates, each listed, chained and tested.
- `npm run lint:skills` — 4 canonical skills, 4 declared entrypoints.
- `npm run lint:deploy-migrations`, `lint:doc-numbers`, `lint:audit-count`,
  `lint:fixtures`, `lint:error-bodies`, `lint:composition`, `lint:interpreter`.
- `git diff --check`.

### Failed

None.

### Blocked or not run

`npm run verify:core` as a whole, and every step needing dependencies —
`typecheck`, `npm test`, `lint`, `build`, `verify:ai`, `lint:literals`,
`lint:python-deps`, `lint:fonts`, `lint:mutation-config`,
`lint:contract-refusals`, `lint:tenant-chokepoints`, `lint:docs-publish`. This
container has no `node_modules` and no `.venv`. The diff touches no `.ts`,
`.tsx` or Python file; `package.json` changed only by one script line and one
`verify:core` step, and `lint:deploy-migrations` — the gate that reads those
strings — passed.

### Environment

local (remote session container, dependencies not installed)

### Residual risk

Low. CI runs the full `verify:core` on this branch. The unverified half is
prose: whether each inventory row describes its gate correctly is a review
question no check can answer.

## Failed approaches

None.

## Known risks

The inventory is a second place a gate's name appears, so a rename now touches
two files. `lint:gate-inventory` fails rather than lets them drift.

## Approval gates

None. No credentials, secrets, aliases or database state involved.

## Questions requiring an owner decision

Whether the guardrails skill should also own the generated-artifact pairs
(`openapi:check`, `docs:endpoints:check`) as gates in the inventory, or leave
them where they are — described in prose and enforced by their generators.

## Next concrete step

Read `.agents/skills/shalomut-guardrails/references/inventory.md` row by row
against each `scripts/check-*.mjs` doc-comment and correct any description that
does not match the check it names.
