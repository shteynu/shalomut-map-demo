import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The deployed build must still apply migrations.
 *
 * `scripts/deploy-migrate.mjs` only runs if something runs it, and the only
 * thing that does is one string in `package.json`. That string is edited for
 * unrelated reasons — a flag, a cache step, a different Next command — and
 * nothing about dropping the migration step from it would fail: the suite
 * passes, the build succeeds, and the next schema change deploys against the
 * old schema exactly as it did before 2026-08-22.
 *
 * Vercel also prefers a `vercel-build` script over `build` when one exists, so
 * adding that script is a second way to bypass the step without touching the
 * first. Both are checked.
 */

const MIGRATE_STEP = 'scripts/deploy-migrate.mjs';
const BUILD_STEP = 'next build';

export function check(packageJson) {
  const problems = [];
  const scripts = packageJson.scripts ?? {};

  for (const name of ['build', 'vercel-build']) {
    const command = scripts[name];

    // `build` must exist; `vercel-build` is checked only if somebody adds one.
    if (command === undefined) {
      if (name === 'build') {
        problems.push('package.json has no `build` script.');
      }
      continue;
    }

    const migrateAt = command.indexOf(MIGRATE_STEP);
    if (migrateAt === -1) {
      problems.push(
        `\`${name}\` does not run ${MIGRATE_STEP}, so a deployed build would ` +
          'ship code against a schema nobody migrated.',
      );
      continue;
    }

    const buildAt = command.indexOf(BUILD_STEP);
    if (buildAt !== -1 && buildAt < migrateAt) {
      problems.push(
        `\`${name}\` runs \`${BUILD_STEP}\` before ${MIGRATE_STEP}. The ` +
          'migration has to be the step that can stop the build.',
      );
    }
  }

  return problems;
}

function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const packageJson = JSON.parse(
    readFileSync(path.join(here, '..', 'package.json'), 'utf8'),
  );

  const problems = check(packageJson);

  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`Deployed-migration check failed: ${problem}`);
    }
    process.exit(1);
  }

  console.log(
    'Deployed-migration check passed: the build applies migrations before it builds.',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
