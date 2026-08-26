import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The gates themselves, checked the way they check everything else.
 *
 * This repository states its rules as fitness gates: sixteen `lint:*` scripts,
 * each a `scripts/check-*.mjs` with a paired test, each chained into
 * `verify:core`. Three properties hold that arrangement together, and none of
 * them is visible while reading a diff:
 *
 * 1. A gate outside `verify:core` runs nowhere. `.github/workflows/verify-core.yml`
 *    runs that one chain and nothing else, so a gate added to `package.json`
 *    and not to the chain is a file that passes review, never executes, and
 *    reports nothing on the day its rule is broken.
 * 2. A gate nobody can find is a message with no route back to its rule. When
 *    this check was written, `lint:deploy-migrations`, `lint:error-bodies` and
 *    `lint:docs-publish` were named in no skill and no living document — an
 *    agent meeting one of them red had only the script itself to go on, and no
 *    way to learn the gate existed before breaking it.
 * 3. A gate that does not run its own test first is trusted without evidence.
 *    Every command in the family runs `node --test` on its test file and only
 *    then the check, which is what makes "the check passed" mean something.
 *
 * So the inventory in `.agents/skills/shalomut-guardrails/references/inventory.md`
 * is re-derived against `package.json` rather than trusted, in the same shape
 * as `check-doc-numbers.mjs` and `check-audit-count.mjs`: the scripts are the
 * source, the table is the copy, and a disagreement is a failed check rather
 * than a discovery somebody makes later.
 *
 * **What this cannot see.** It checks that a gate is listed, not that the line
 * describing it is true — a row may name the wrong file or describe a rule the
 * check stopped enforcing, and that stays a review question. It also covers the
 * `lint:*` family only: `openapi:check` and `docs:endpoints:check` belong to
 * their generators, and the inventory says so in prose that nothing verifies.
 */
const PACKAGE_FILE = 'package.json';
const INVENTORY_FILE =
  '.agents/skills/shalomut-guardrails/references/inventory.md';
const GATE_PREFIX = 'lint:';

/** A gate is named in the inventory when it appears there as code. */
const GATE_IN_CODE_SPAN = /`(lint:[a-z0-9-]+)`/g;

/** The test files a command runs before the check it guards. */
const TEST_FILE = /scripts\/[\w.-]+\.test\.mjs/g;

export function gateNames(scripts) {
  return Object.keys(scripts)
    .filter((name) => name.startsWith(GATE_PREFIX))
    .sort();
}

export function parseInventoryGates(source) {
  return [...source.matchAll(GATE_IN_CODE_SPAN)].map((match) => match[1]);
}

export function checkInventoryCoverage(scripts, inventoryGates) {
  const errors = [];
  const listed = new Set(inventoryGates);

  for (const gate of gateNames(scripts)) {
    if (!listed.has(gate)) {
      errors.push(
        `${INVENTORY_FILE}: does not name \`${gate}\`. A gate the inventory ` +
          'omits is a failure message with no route back to its rule.',
      );
    }
  }

  for (const gate of new Set(inventoryGates)) {
    if (scripts[gate] === undefined) {
      errors.push(
        `${INVENTORY_FILE}: names \`${gate}\`, which ${PACKAGE_FILE} does not ` +
          'define. A row for a gate that does not exist is a rule nobody runs.',
      );
    }
  }

  return errors;
}

/**
 * Membership in the chain, by exact step. `verify:core` is `&&`-joined, so a
 * substring match would let `npm run lint:doc` pass on the strength of
 * `npm run lint:doc-numbers` being there.
 */
export function checkVerifyCore(scripts) {
  const chain = scripts['verify:core'];
  if (chain === undefined) {
    return [`${PACKAGE_FILE}: has no \`verify:core\` script to chain gates into.`];
  }

  const steps = new Set(chain.split('&&').map((step) => step.trim()));

  return gateNames(scripts)
    .filter((gate) => !steps.has(`npm run ${gate}`))
    .map(
      (gate) =>
        `${PACKAGE_FILE}: \`${gate}\` is not a step of \`verify:core\`. CI ` +
          'runs that chain and nothing else, so the gate would never execute.',
    );
}

export function checkGateTests(scripts, exists) {
  const errors = [];

  for (const gate of gateNames(scripts)) {
    const [first] = scripts[gate].split('&&');
    if (!first.trim().startsWith('node --test ')) {
      errors.push(
        `${PACKAGE_FILE}: \`${gate}\` does not run \`node --test\` first. A ` +
          'check is trusted only after its own test has proved it can fail.',
      );
      continue;
    }

    const testFiles = first.match(TEST_FILE) ?? [];
    if (testFiles.length === 0) {
      errors.push(
        `${PACKAGE_FILE}: \`${gate}\` runs \`node --test\` on no ` +
          '`scripts/*.test.mjs` file.',
      );
    }

    for (const file of testFiles) {
      if (!exists(file)) {
        errors.push(
          `${PACKAGE_FILE}: \`${gate}\` runs \`${file}\`, which does not exist.`,
        );
      }
    }
  }

  return errors;
}

function main() {
  const errors = [];

  if (!fs.existsSync(INVENTORY_FILE)) {
    console.error(
      `Gate inventory check failed:\n${INVENTORY_FILE}: missing. It is the ` +
        'route from a failing gate to the rule it defends.',
    );
    process.exit(1);
  }

  const { scripts } = JSON.parse(fs.readFileSync(PACKAGE_FILE, 'utf8'));
  const inventory = fs.readFileSync(INVENTORY_FILE, 'utf8');

  errors.push(
    ...checkInventoryCoverage(scripts, parseInventoryGates(inventory)),
    ...checkVerifyCore(scripts),
    ...checkGateTests(scripts, (file) => fs.existsSync(file)),
  );

  if (errors.length > 0) {
    console.error('Gate inventory check failed:');
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }

  console.log(
    `Gate inventory check passed: ${gateNames(scripts).length} gates, each ` +
      'listed, chained into `verify:core` and tested before it is trusted.',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
