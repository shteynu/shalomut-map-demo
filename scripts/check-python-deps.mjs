import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The AI service installs from a lock, and the lock still says what the
 * project declares.
 *
 * Until 2026-08-22 `ai-analytics-service/requirements.txt` was four `>=` lines
 * and there was no lockfile at all, so every rebuild of the Render image
 * resolved the tree again against whatever PyPI served that day. A local
 * virtualenv, a CI runner and the deployed container held three different sets
 * of packages, and nothing recorded the difference — an untested release or a
 * hijacked package reached a paid pipeline by arriving on time.
 *
 * Three things can quietly undo that, and this gate is each of them:
 *
 * 1. A dependency changes in `pyproject.toml` and the locks are not
 *    regenerated. Then the declaration and the installation disagree, and the
 *    one nobody installs is the one everybody reads.
 * 2. A requirement loses its hashes. `--require-hashes` is all-or-nothing per
 *    file, so one unhashed line is not a small gap: pip refuses the install,
 *    and the tempting repair is to drop the flag.
 * 3. An install path drops `--require-hashes`. The lock still pins versions,
 *    so nothing looks broken — it just stops being checked against the bytes.
 *
 * What it cannot check is freshness. Whether today's pins are the right ones is
 * a decision about upgrade cadence, and `ai-analytics-service/README.md` owns
 * it. A passing check means the three files agree, not that they are current.
 */

const SERVICE_DIR = 'ai-analytics-service';
const PYPROJECT = `${SERVICE_DIR}/pyproject.toml`;
const RUNTIME_LOCK = `${SERVICE_DIR}/requirements.txt`;
const DEV_LOCK = `${SERVICE_DIR}/requirements-dev.txt`;

/**
 * Files that install from a lock. The `Dockerfile` is what Render builds; the
 * two workflows are the gates that are supposed to run the same packages.
 * `docs/local-environment.md` and the service README carry the same command
 * for a human and are checked too — a documented install without the flag is
 * how the next virtualenv stops matching the deployment.
 */
const INSTALL_SITES = [
  'Dockerfile',
  '.github/workflows/verify-core.yml',
  '.github/workflows/deploy-vercel.yml',
  'docs/local-environment.md',
  `${SERVICE_DIR}/README.md`,
];

const ADVICE =
  'Regenerate both locks with the `uv pip compile` commands in ' +
  '`ai-analytics-service/README.md`.';

/** `name[extra] >= 1.2` — the only requirement forms this project declares. */
const DECLARED = /^([A-Za-z0-9._-]+)\s*(?:\[[^\]]*\])?\s*(.*)$/;

/** PyPI normalization: `PyYAML`, `pyyaml` and `typing_extensions` are one name. */
export function normalize(name) {
  return name.trim().toLowerCase().replace(/[-_.]+/g, '-');
}

/**
 * The two dependency arrays out of `pyproject.toml`, without a TOML parser.
 *
 * Narrow on purpose: it reads `dependencies` under `[project]` and `dev` under
 * `[project.optional-dependencies]`, and it throws when either is missing
 * rather than returning an empty list. An empty list is what a silently
 * passing check looks like when the file has been restructured underneath it.
 */
export function parseDeclared(toml) {
  const read = (heading, key) => {
    const section = toml.split(`[${heading}]`)[1];
    if (section === undefined) throw new Error(`${PYPROJECT}: no [${heading}] section.`);

    const array = new RegExp(`^${key}\\s*=\\s*\\[([^\\]]*)\\]`, 'm').exec(
      section.split(/^\[/m)[0],
    );
    if (array === null) throw new Error(`${PYPROJECT}: no \`${key}\` under [${heading}].`);

    return [...array[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
  };

  return {
    runtime: read('project', 'dependencies'),
    dev: read('project.optional-dependencies', 'dev'),
  };
}

/**
 * A compiled lock, as name → { version, hashes, line }.
 *
 * Continuations matter: a requirement is one logical line spread over as many
 * physical ones as it has hashes, so the parser tracks which requirement the
 * `--hash` it is reading belongs to.
 */
export function parseLock(text) {
  const entries = new Map();
  let current = null;

  text.split('\n').forEach((raw, index) => {
    const line = raw.replace(/\\$/, '').trim();
    if (line === '' || line.startsWith('#')) return;

    if (line.startsWith('--hash=')) {
      if (current !== null) current.hashes.push(line.slice('--hash='.length));
      return;
    }

    // `name==version ; marker` — markers are kept out of the version.
    const pinned = /^([A-Za-z0-9._-]+)\s*==\s*([^\s;]+)/.exec(line);
    if (pinned === null) {
      current = null;
      return;
    }

    current = { version: pinned[2], hashes: [], line: index + 1 };
    entries.set(normalize(pinned[1]), current);
  });

  return entries;
}

/** PEP 440 is larger than this; these locks are numeric, and anything else throws. */
export function compareVersions(left, right) {
  const parse = (version) => {
    const parts = version.split('.');
    return parts.map((part) => {
      if (!/^\d+$/.test(part)) {
        throw new Error(`cannot compare the version \`${version}\` numerically`);
      }
      return Number(part);
    });
  };

  const a = parse(left);
  const b = parse(right);

  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }

  return 0;
}

/**
 * Whether a pinned version satisfies a declared specifier.
 *
 * Only the operators this project actually writes are implemented, and an
 * unknown one throws rather than passing. A specifier a gate cannot evaluate is
 * a specifier it is not checking, and silence there reads exactly like success.
 */
export function satisfies(version, specifier) {
  const clauses = specifier.split(',').map((clause) => clause.trim()).filter(Boolean);

  return clauses.every((clause) => {
    const parsed = /^(>=|<=|==|<|>|!=)\s*(.+)$/.exec(clause);
    if (parsed === null) throw new Error(`unsupported version specifier \`${clause}\``);

    const comparison = compareVersions(version, parsed[2].trim());

    switch (parsed[1]) {
      case '>=':
        return comparison >= 0;
      case '<=':
        return comparison <= 0;
      case '==':
        return comparison === 0;
      case '<':
        return comparison < 0;
      case '>':
        return comparison > 0;
      default:
        return comparison !== 0;
    }
  });
}

/** Every declared requirement is pinned in the lock, at a version it allows. */
export function checkDeclaredAreLocked(declared, lock, lockPath) {
  const errors = [];

  for (const requirement of declared) {
    const parsed = DECLARED.exec(requirement.trim());
    if (parsed === null) {
      errors.push(`${PYPROJECT}: cannot read the requirement \`${requirement}\`.`);
      continue;
    }

    const name = normalize(parsed[1]);
    const entry = lock.get(name);

    if (entry === undefined) {
      errors.push(
        `${lockPath}: \`${name}\` is declared in ${PYPROJECT} and is not in the ` +
          `lock. ${ADVICE}`,
      );
      continue;
    }

    const specifier = parsed[2].trim();
    if (specifier === '') continue;

    try {
      if (!satisfies(entry.version, specifier)) {
        errors.push(
          `${lockPath}:${entry.line}: \`${name}\` is pinned at ${entry.version}, ` +
            `which ${PYPROJECT} does not allow (\`${specifier}\`). ${ADVICE}`,
        );
      }
    } catch (error) {
      errors.push(`${lockPath}: \`${name}\`: ${error.message}.`);
    }
  }

  return errors;
}

/** One unhashed requirement makes the whole file unusable under the flag. */
export function checkEveryRequirementIsHashed(lock, lockPath) {
  const errors = [];

  for (const [name, entry] of lock) {
    if (entry.hashes.length === 0) {
      errors.push(
        `${lockPath}:${entry.line}: \`${name}\` carries no \`--hash\`, so ` +
          `\`--require-hashes\` refuses the whole file. ${ADVICE}`,
      );
    }
  }

  return errors;
}

/**
 * The dev lock is the runtime lock plus test tools, at identical versions.
 *
 * If they diverge, the suite proves something about packages the deployment
 * does not run — which is the defect this whole arrangement exists to remove,
 * rebuilt one file over.
 */
export function checkDevLockAgrees(runtime, dev) {
  const errors = [];

  for (const [name, entry] of runtime) {
    const devEntry = dev.get(name);

    if (devEntry === undefined) {
      errors.push(
        `${DEV_LOCK}: \`${name}\` is in ${RUNTIME_LOCK} and missing here, so the ` +
          `suite runs without a package the deployment has. ${ADVICE}`,
      );
      continue;
    }

    if (devEntry.version !== entry.version) {
      errors.push(
        `${DEV_LOCK}:${devEntry.line}: \`${name}\` is ${devEntry.version} here and ` +
          `${entry.version} in ${RUNTIME_LOCK}, so the suite tests a version the ` +
          `deployment does not run. ${ADVICE}`,
      );
    }
  }

  return errors;
}

/**
 * Any `pip install` of a lock passes `--require-hashes`.
 *
 * Prose is not a violation, and this file and its test have to name the flag to
 * explain it — so only lines that actually run pip against one of the two lock
 * filenames are read, and a line inside a fenced block in a document counts
 * exactly like a line in a workflow, because a reader will run it.
 */
export function findUnhashedInstalls(text, filePath) {
  const errors = [];

  text.split('\n').forEach((line, index) => {
    if (!/\bpip install\b/.test(line)) return;
    if (!/requirements(?:-dev)?\.txt/.test(line)) return;
    if (line.includes('--require-hashes')) return;

    errors.push(
      `${filePath}:${index + 1}: installs a lock without \`--require-hashes\`, ` +
        `so the pinned versions are no longer checked against their hashes.`,
    );
  });

  return errors;
}

function main() {
  const errors = [];

  const declared = parseDeclared(fs.readFileSync(PYPROJECT, 'utf-8'));
  const runtime = parseLock(fs.readFileSync(RUNTIME_LOCK, 'utf-8'));
  const dev = parseLock(fs.readFileSync(DEV_LOCK, 'utf-8'));

  errors.push(...checkDeclaredAreLocked(declared.runtime, runtime, RUNTIME_LOCK));
  errors.push(...checkDeclaredAreLocked(declared.runtime, dev, DEV_LOCK));
  errors.push(...checkDeclaredAreLocked(declared.dev, dev, DEV_LOCK));
  errors.push(...checkEveryRequirementIsHashed(runtime, RUNTIME_LOCK));
  errors.push(...checkEveryRequirementIsHashed(dev, DEV_LOCK));
  errors.push(...checkDevLockAgrees(runtime, dev));

  for (const site of INSTALL_SITES) {
    if (!fs.existsSync(site)) {
      errors.push(`${site}: is missing, and it is one of the paths that installs.`);
      continue;
    }

    errors.push(...findUnhashedInstalls(fs.readFileSync(site, 'utf-8'), site));
  }

  if (errors.length > 0) {
    console.error('Python dependency lock check failed:');
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }

  console.log(
    `Python dependency lock check passed: ${runtime.size} runtime and ` +
      `${dev.size} development requirements, all pinned and hashed.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
