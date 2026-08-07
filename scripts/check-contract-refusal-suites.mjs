import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Fitness check: every way a callback payload can be validated has a suite
 * that proves an invalid one is refused.
 *
 * The gap this exists for is not hypothetical. Until 2026-08-07 the validators
 * for contracts `1.0`–`3.0` and `5.0` had payloads proving a valid callback is
 * accepted and almost nothing proving an invalid one is refused, so a change
 * could delete the provenance binding, the score-to-status agreement or the
 * distribution check and the whole suite stayed green. Mutation testing found
 * it; mutation testing is opt-in and non-blocking, so nothing would find it
 * again on the day a contract `7.0` arrives.
 *
 * The check is deliberately about a validation *path*, not about a version
 * number. `validateStoneMapResult` dispatches on four capability flags, and
 * two versions that answer them identically run the same code — `4.0` reaches
 * the stone validator `3.0` reaches, so it needs no suite of its own. What
 * must never happen is a path that no refusal suite exercises at all.
 *
 * Known limit, and it is the same trade the mutation-config check makes: this
 * proves a suite exists and names the version, not that the suite is complete.
 * A file with one lazy test satisfies it. It is a guard against forgetting,
 * not against half-doing — the report under `reports/mutation/` remains the
 * only thing that answers "are these rules actually pinned?".
 */

const CAPABILITIES_FILE = 'contracts/capabilities.json';
const TEST_ROOT = 'src/lib/__tests__';
const REFUSAL_FILE_PATTERN = /refusals?\.test\.tsx?$/u;

/**
 * The flags `validateStoneMapResult` branches on when it picks a stone
 * validator. Two versions with the same answers are validated by the same
 * code, so one refusal suite covers both.
 */
const DISPATCH_FLAGS = [
  'isSemanticContract',
  'usesStructuredDimensionSummary',
  'supportsScoreDistribution',
  'supportsDynamicQuestions',
];

const VALIDATOR_FILE = 'src/lib/ai-contract.ts';

/**
 * The flags the stone-selection block actually reads, taken from the source
 * rather than from the list above.
 *
 * Without this the check has a silent way to go stale: the day the validator
 * branches on a fifth capability, a version that differs only in that flag
 * would share a signature with an existing one and its unguarded path would
 * report as covered. Re-deriving turns that into a failure that says what to
 * update — the same trade `check-mutation-config.mjs` makes with its test
 * list.
 */
export function dispatchFlagsInSource(source) {
  const block = source.match(
    /for \(const dimensionId of AI_ANALYTICS_DIMENSION_IDS\)[\s\S]*?if \(!isValidStone\)/u,
  );
  if (!block) return null;
  return [...new Set([...block[0].matchAll(/caps\.(\w+)/gu)].map((m) => m[1]))].sort();
}

export function validationPathSignature(capabilities) {
  return DISPATCH_FLAGS.map((flag) => `${flag}=${Boolean(capabilities[flag])}`).join(
    ',',
  );
}

/**
 * Group the supported versions by the code that validates them.
 * Returns `[{ signature, versions }]`, versions in manifest order.
 */
export function groupVersionsByPath(versions) {
  const groups = new Map();
  for (const [version, capabilities] of Object.entries(versions)) {
    const signature = validationPathSignature(capabilities);
    if (!groups.has(signature)) groups.set(signature, []);
    groups.get(signature).push(version);
  }
  return [...groups.entries()].map(([signature, group]) => ({
    signature,
    versions: group,
  }));
}

/**
 * Which contract versions a source file names.
 *
 * Both spellings count: the literal a fixture writes into a payload, and the
 * exported constant a suite imports instead of repeating the number.
 *
 * Comments do not count, and that is not a detail. The first draft of this
 * check read them, and it passed with the `5.0` suite deleted — because the
 * `6.0` suite's header prose mentions `5.0` while explaining its own history.
 * A check that a comment can satisfy cannot find the omission it exists for.
 */
export function versionsMentionedIn(source, versions) {
  return versionsMentionedInCode(stripComments(source), versions);
}

/** Line and block comments, removed before anything is read as a claim. */
export function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//gu, ' ').replace(/\/\/[^\n]*/gu, ' ');
}

function versionsMentionedInCode(source, versions) {
  const constants = {
    '1.0': 'AI_ANALYTICS_V1_CONTRACT_VERSION',
    '2.0': 'AI_ANALYTICS_CONTRACT_VERSION',
    '3.0': 'AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION',
    '4.0': 'AI_ANALYTICS_V4_CONTRACT_VERSION',
    '5.0': 'AI_ANALYTICS_V5_CONTRACT_VERSION',
    '6.0': 'AI_ANALYTICS_V6_CONTRACT_VERSION',
  };

  return versions.filter((version) => {
    const quoted = new RegExp(`['"]${version.replace('.', '\\.')}['"]`, 'u');
    const constant = constants[version];
    return (
      quoted.test(source) ||
      (constant !== undefined && source.includes(constant))
    );
  });
}

export function collectRefusalSuites(dir) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectRefusalSuites(fullPath));
    } else if (REFUSAL_FILE_PATTERN.test(entry.name)) {
      found.push(fullPath.split(path.sep).join('/'));
    }
  }
  return found;
}

/**
 * A path is covered when some suite names one of its versions. A suite that
 * borrows a fixture module is read together with it, because the version a
 * payload declares usually lives in the fixture rather than in the test.
 */
export function findUncoveredPaths({ groups, suites }) {
  const errors = [];

  if (suites.length === 0) {
    return [
      'No refusal suite was found under ' +
        `${TEST_ROOT}. Every contract version would be unguarded.`,
    ];
  }

  for (const { versions } of groups) {
    const covered = suites.some((suite) =>
      suite.versions.some((version) => versions.includes(version)),
    );
    if (!covered) {
      errors.push(
        `No refusal suite exercises contract ${versions.join(' / ')}. ` +
          'A validator with only accepting tests can lose a rule silently: ' +
          'write one suite that starts from a valid payload and breaks one ' +
          'rule per case, then name the version in it.',
      );
    }
  }

  return errors;
}

/** The fixture modules a suite imports from its own `fixtures/` directory. */
export function importedFixtures(source, suitePath) {
  const directory = path.dirname(suitePath);
  return [...source.matchAll(/from\s+'(\.\/fixtures\/[\w-]+)'/gu)].map((match) =>
    path.join(directory, `${match[1]}.ts`).split(path.sep).join('/'),
  );
}

async function main() {
  const errors = [];
  const capabilities = JSON.parse(fs.readFileSync(CAPABILITIES_FILE, 'utf-8'));
  const versions = Object.keys(capabilities.versions ?? {});

  if (versions.length === 0) {
    console.error(
      `Contract refusal suite check failed: ${CAPABILITIES_FILE} lists no ` +
        'versions, so the check would pass by accident.',
    );
    process.exit(1);
  }

  const actualFlags = dispatchFlagsInSource(
    fs.readFileSync(VALIDATOR_FILE, 'utf-8'),
  );
  if (actualFlags === null) {
    errors.push(
      `The stone-selection block was not found in ${VALIDATOR_FILE}, so the ` +
        'validation paths cannot be derived. Update this check to match the ' +
        'validator.',
    );
  } else {
    const expected = [...DISPATCH_FLAGS].sort();
    if (actualFlags.join(',') !== expected.join(',')) {
      errors.push(
        `${VALIDATOR_FILE} selects a stone validator using ` +
          `${actualFlags.join(', ')}, but this check groups versions by ` +
          `${expected.join(', ')}. Update DISPATCH_FLAGS, or a version that ` +
          'differs only in the new flag will report as covered by an ' +
          'existing suite.',
      );
    }
  }

  const groups = groupVersionsByPath(capabilities.versions);

  const suites = collectRefusalSuites(TEST_ROOT).map((file) => {
    const source = fs.readFileSync(file, 'utf-8');
    const sources = [source];
    for (const fixture of importedFixtures(source, file)) {
      if (fs.existsSync(fixture)) sources.push(fs.readFileSync(fixture, 'utf-8'));
    }
    return {
      file,
      versions: versionsMentionedIn(sources.join('\n'), versions),
    };
  });

  errors.push(...findUncoveredPaths({ groups, suites }));

  if (errors.length > 0) {
    console.error('Contract refusal suite check failed:');
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }

  console.log(
    `Contract refusal suite check passed: ${suites.length} suites cover ` +
      `${groups.length} validation paths across ${versions.length} contract ` +
      'versions.',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
