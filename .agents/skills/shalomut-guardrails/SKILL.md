---
name: shalomut-guardrails
description: Work on the repository's fitness gates in shalomut-map-demo — the `scripts/check-*.mjs` scripts, the `lint:*` commands and the `verify:core` chain. Use when one of the gates has failed and the rule it defends has to be understood; when a rule should become checkable rather than prose; when adding, changing, weakening or removing a check or a generated artifact.
---

# Shalomut Guardrails

## How to read this skill

Always in force: `Purpose` — what this skill decides and where the rest goes;
`A red gate` — the most common way in here, and the place a rule is most often
lost by "fixing" the check; `What deserves a gate` — the boundary between an
ordinary test, a gate and prose.

On condition: `The shape of a gate` — you are writing or editing a
`scripts/check-*.mjs`; `Wiring a gate in` — you are adding, renaming or removing
a gate; `Generated artifacts` — the task touches a pair of editable source and
generated copy; `Inventory` and
[references/inventory.md](references/inventory.md) — you need to know which gate
owns a rule, or whether one already exists.

## Purpose

This skill is about the mechanism: how a repository rule becomes checkable and
what shape it takes. Which checks to run for a given diff is decided by
`../shalomut-verification/SKILL.md`; what the product's invariants are by
`../shalomut-map/SKILL.md`; branch state and handoff by
`../shalomut-tracker/SKILL.md`.

The repository currently has sixteen `lint:*` commands, all of them steps of
`verify:core`, and almost every one is a `scripts/check-*.mjs` with a paired
test. This is not an accidental pile of linters but the way the project moves a
rule out of prose that can go unread and into a refusal that cannot be missed.

## A red gate

1. Read the doc-comment at the top of the `scripts/check-*.mjs` itself. It
   states the rule, usually names the specific incident that produced it, and
   often lists honestly what the check cannot see. That beats any retelling,
   [references/inventory.md](references/inventory.md) included.
2. Treat the violation as real until proven otherwise. The message names the
   file and the rule; look for how the diff broke it.
3. Weakening a check, adding a file to an exemption list, narrowing its scope or
   dropping a step is a change to the rule, not a fix to the build. Do it only
   deliberately: update the gate's doc-comment and its tests so that the new
   rule is stated and checked from both sides.
4. Never bring a gate's test into line with current behaviour to make things
   green. The gate's test is the record of the rule.
5. `verify:core` is an `&&` chain: it stops at the first failing step. The steps
   after it did not run; do not report them as passed.
6. If a gate really is wrong, state which behaviour it must let through, add a
   test for that side, and change the check itself rather than only its message.

## What deserves a gate

- A rule that lives inside a module and is expressed through its API → an
  ordinary test in `src/**/__tests__`. No gate needed.
- A rule about the shape of the repository — what may not be imported, where a
  literal may stand, which interpreter runs, which copy of a document is
  generated, where skills live — cannot be expressed by an ordinary test: the
  violation arrives in a new file the test does not know about. That is the case
  for a `scripts/check-*.mjs`.
- An editable source with a derived copy → a `--check` mode on the generator
  itself, not a second equality check. See `Generated artifacts`.
- A rule a machine cannot check — whether an architectural decision is right,
  what a paragraph means, whether an audit record is genuinely closed — stays
  prose in `AGENTS.md` or in a skill. Then say so plainly in the gate's
  doc-comment, the way `check-doc-numbers.mjs` and `check-audit-count.mjs` do: a
  green gate must not read as proof of what it never checked.
- The main sign that a gate is needed: the violation is silent. Tests are green,
  the build passes, a reviewer sees nothing — and the rule is already broken. If
  a violation fails the suite anyway, a test is enough.

## The shape of a gate

Every existing check has the same shape, and it is worth keeping:

- An ESM file `scripts/check-<subject>.mjs`, run from the repository root.
- A doc-comment at the top: the rule, why it exists and what the check cannot
  see. Write only what actually happened; an invented incident is worse than
  none.
- Pure exported functions: they take text or a structure and return an array of
  violation messages. Reading files and `process.exit` belong in `main()` only.
- `main()` is called only as an entrypoint:
  `if (process.argv[1] === fileURLToPath(import.meta.url)) main();` — otherwise
  the test cannot import the module.
- On failure: `console.error('<Subject> check failed:')`, then one line per
  violation, then `process.exit(1)`. The message names the file, the rule and
  what to do instead.
- On success: one `<Subject> check passed: …` line stating how much was actually
  checked. A silent success is indistinguishable from a check that read nothing.
- A paired `scripts/check-<subject>.test.mjs` on `node:test` and
  `node:assert/strict` that exercises both sides: what is caught, what is
  legitimately let through, and which blind spot is accepted. A check that has
  never failed on purpose is a check whose shape nobody knows. A thin wrapper
  such as `check-version-literals-python.mjs`, which only runs a checker written
  in another language, has no test of its own and is run from `lint:literals`.

## Wiring a gate in

1. `package.json`:
   `"lint:<name>": "node --test scripts/check-<subject>.test.mjs && node scripts/check-<subject>.mjs"`.
   The gate's test comes first: prove the check works, then trust it.
2. Add the step to `verify:core`. A gate outside that chain is run neither by CI
   (`.github/workflows/verify-core.yml`) nor by a person locally, and it becomes
   prose with an extra file attached.
3. Add a row to [references/inventory.md](references/inventory.md).
   `npm run lint:gate-inventory` requires every `lint:*` command to be in the
   inventory, to be a step of `verify:core` and to run an existing test of its
   own, and requires the inventory to name no gate that does not exist.
4. If the gate defends a rule an agent reads as a product or process rule, name
   it where that rule is stated: `AGENTS.md`, `Canonical boundaries` in
   `../shalomut-map/SKILL.md`, or the selection matrix in
   `../shalomut-verification/SKILL.md`.
5. Removing or renaming a gate means removing or renaming it in all of those
   places in one change.

After editing any file under `.agents/skills/**`, run `npm run lint:skills`: it
checks frontmatter, that every link resolves, that no `references/` file is
orphaned, and that every section is classified by the reading map.

## Generated artifacts

- `docs/openapi.yaml` is the single editable source of the API description;
  `public/openapi.json` is produced by `npm run openapi:generate`, and
  `npm run openapi:check` compares the whole document (it is run by
  `src/app/api/__tests__/openapi.test.ts`).
- `npm run docs:endpoints` and `npm run docs:endpoints:check` do the same for
  the documented endpoint surface.
- Editing a generated file by hand is drift, not a change. Edit the source and
  regenerate.
- For a new pair of this kind, give the generator a `--check` flag instead of
  writing a separate comparison script: one piece of code builds the artifact
  and verifies it, so "generated" and "checked" cannot drift apart.

## Inventory

[references/inventory.md](references/inventory.md) is the table of every gate:
what each one refuses and where its rule is stated. Open it when a gate has
failed and you need the route from the message to the rule, or when deciding
whether a rule already has a check. The script's own doc-comment is always more
accurate than a row of the table.
