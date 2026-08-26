# A skill for the repository's fitness gates, and one language for the skills

## Metadata

- Branch: `claude/useful-repo-skill-wfad6a`
- Base branch: `main`
- Base commit: `24ed8bc`
- Current HEAD: see `git log -1` — the English-language batch follows `8cde693`
- Status: implementation complete, awaiting review
- Last updated: 2026-08-26
- Last agent/tool: Claude Code (remote session)

## Objective

Add the skill the repository was missing — the one that owns how a rule becomes
a gate — make its inventory enforceable rather than prose, and then, at the
owner's decision, move every skill to English so a rule is stated in one
language.

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
- Translation of all four `SKILL.md` files and all three `references/` files
  into English, with the `Language` rule recorded in `AGENTS.md`.

## Non-goals

- Changing any existing gate's rule, message or coverage.
- Documenting `openapi:check` / `docs:endpoints:check` as `lint:*` gates; they
  belong to their generators and the inventory says so in prose.
- Product, UI or contract behaviour: nothing under `src/` changed.
- Rewriting dated documents. `docs/critical-audit-2026-08-21.md`, the archived
  plans and the archived task files keep their Russian, and the audit's Russian
  status vocabulary stays the input `lint:audit-count` reads. Hebrew product
  copy is untouched.

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
- The skills moved to English rather than the guardrails skill staying Russian
  for consistency with its siblings. The deciding argument: the same rule was
  stated in English in `AGENTS.md` and in Russian in a skill, and no gate
  compares two translations of one rule.
- `READING_MAP_HEADING` in `check-agent-skills.mjs` became
  `How to read this skill`, so the reading-map rule follows the skills into
  English; its fixtures moved with it.

## Assumptions

- `verify:core` stays the single chain CI runs; `.github/workflows/verify-core.yml`
  still runs exactly that.

## Completed

- `.agents/skills/shalomut-guardrails/SKILL.md` and `references/inventory.md`.
- `scripts/check-gate-inventory.mjs` and `scripts/check-gate-inventory.test.mjs`.
- `package.json`: `lint:gate-inventory` added and chained after `lint:skills`.
- Routing in `AGENTS.md` and `.github/copilot-instructions.md`; matrix row in
  `.agents/skills/shalomut-verification/SKILL.md`.
- All seven skill files translated to English; no Cyrillic remains under
  `.agents/skills/` or in the two gate scripts and their tests.
- `AGENTS.md` gained a `Language` section stating the rule and its exceptions.

## In progress

None.

## Remaining

Two reviews the gates cannot do: whether each inventory row describes its check
truthfully, and whether the English translation preserved every rule's meaning.
Both are read-only review questions, not code.

## Changed files

Two batches. `b679fc3` — the guardrails skill, its inventory, the
`lint:gate-inventory` gate and its wiring; `8cde693` — this task file. The
English batch that follows them translates the four `SKILL.md` files and three
`references/` files, updates `READING_MAP_HEADING` and its fixtures in
`scripts/check-agent-skills{,.test}.mjs`, the Russian fixture lines in
`scripts/check-gate-inventory.test.mjs`, and `AGENTS.md`.

## Verification evidence

### Passed

- `node --test scripts/check-gate-inventory.test.mjs` — 12/12.
- `node --test scripts/check-agent-skills.test.mjs` — 28/28 after the fixtures
  moved to English.
- `npm run lint:gate-inventory` — 16 gates, each listed, chained and tested.
- `npm run lint:skills` — 4 canonical skills, 4 declared entrypoints. It first
  failed on three sections whose names the map wrapped across a line break
  (`Product and UI`, `Role or model escalation`,
  `Browser and runtime scenarios`); the map lines were rewrapped and it passed.
- Every other `lint:*` gate that needs no dependencies: `lint:literals`,
  `lint:interpreter`, `lint:composition`, `lint:deploy-migrations`,
  `lint:tenant-chokepoints`, `lint:fixtures`, `lint:mutation-config`,
  `lint:contract-refusals`, `lint:fonts`, `lint:doc-numbers`,
  `lint:audit-count`, `lint:error-bodies`, `lint:python-deps`,
  `lint:docs-publish`.
- `git diff --check`.

### Failed

None.

### Blocked or not run

`npm run verify:core` as a whole, and the steps needing dependencies:
`typecheck`, `npm test`, `npm run lint`, `npm run build`, `verify:ai`. This
container has no `node_modules` and no `.venv`. The diff touches no `.ts`,
`.tsx` or Python file; `package.json` changed only by one script line and one
`verify:core` step, and `lint:deploy-migrations` — the gate that reads those
strings — passed. Every `lint:*` gate ran individually, which is `verify:core`
minus those five steps.

### Environment

local (remote session container, dependencies not installed)

### Residual risk

Low for the mechanism, moderate for the prose. CI runs the full `verify:core` on
this branch. What no check can answer: whether each inventory row describes its
gate correctly, and whether a translated rule still says exactly what the
Russian said. Both are read-only reviews of text that no longer has a second
copy to compare against.

## Failed approaches

None.

## Known risks

- The inventory is a second place a gate's name appears, so a rename now touches
  two files. `lint:gate-inventory` fails rather than lets them drift.
- The translation is a large diff with no behavioural change: a lost nuance
  would be silent. The archived task files still quote the Russian section
  names, which is correct — they are historical records of what the skills said
  then.

## Approval gates

None. No credentials, secrets, aliases or database state involved.

## Questions requiring an owner decision

Whether the guardrails skill should also own the generated-artifact pairs
(`openapi:check`, `docs:endpoints:check`) as gates in the inventory, or leave
them where they are — described in prose and enforced by their generators.

## Next concrete step

Read the four translated `SKILL.md` files against `git show 8cde693^:<path>` for
each, confirming that no rule changed meaning in translation, and correct
anything that drifted.
