import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Apply pending migrations as part of the deployed build.
 *
 * Until 2026-08-22 no deploy path applied migrations at all. The build command
 * ran `prisma generate` and never `prisma migrate deploy`; the CI job ran
 * `vercel deploy --prod` with no migration step; and Vercel builds every push
 * to `main` on its own, so even a CI job would not have covered the path most
 * deployments actually take. A schema change therefore reached production code
 * before it reached the production schema, and in that window Prisma selects
 * the model's columns by name and every read of the changed table answers 500
 * rather than falling back. That cost a broken deployment on 2026-08-04 and a
 * hand step after every schema change since.
 *
 * The build is the only place that covers every path, because every path ends
 * in a Vercel build. So this runs there, and the build fails when it cannot.
 *
 * What this buys and what it costs, stated rather than discovered: the schema
 * now moves *ahead* of the alias, because the build finishes before the new
 * deployment starts serving. An additive migration is safe in that window; a
 * destructive one breaks the deployment that is still serving, which is the
 * old failure with the two sides swapped. Additive-first is now a rule rather
 * than a preference — see ADR-031.
 */

const TRANSACTION_POOLER_PORT = '6543';

/**
 * Whether this build should migrate, and with which connection string.
 *
 * Keyed on `VERCEL_ENV` rather than on an opt-in variable of our own. An
 * opt-in would be one more switch that can sit quietly in the off position,
 * which is the shape of the defect this replaces.
 */
export function resolveMigrationPlan(env) {
  if (env.VERCEL_ENV !== 'production') {
    return {
      run: false,
      reason:
        `VERCEL_ENV is ${env.VERCEL_ENV ? `"${env.VERCEL_ENV}"` : 'unset'}, ` +
        'so this build serves nothing and migrates nothing',
    };
  }

  const url = env.DIRECT_URL;

  if (!url) {
    return {
      run: false,
      fatal: true,
      reason:
        'DIRECT_URL is not set on this deployment. Migrations need a session-' +
        'mode connection, which DATABASE_URL is not: it points at the ' +
        'transaction-mode pooler, where the advisory lock `prisma migrate` ' +
        'takes does not survive. Set DIRECT_URL to the direct connection ' +
        'string for the same database.',
    };
  }

  const misread = describeUnusablePooler(url);
  if (misread) {
    return { run: false, fatal: true, reason: misread };
  }

  return { run: true, url };
}

/**
 * The one misconfiguration worth naming, because it is the one that looks
 * right: DATABASE_URL copied into DIRECT_URL. Both are the same database and
 * the same credentials, and only the port and the pooling mode differ, so the
 * error Prisma gives for it is about a lock rather than about a variable.
 */
export function describeUnusablePooler(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return 'DIRECT_URL is not a URL this script can read.';
  }

  if (parsed.searchParams.get('pgbouncer') === 'true') {
    return (
      'DIRECT_URL carries `pgbouncer=true`, so it is the pooled connection ' +
      'string rather than the direct one. Migrations need the direct one.'
    );
  }

  if (parsed.port === TRANSACTION_POOLER_PORT) {
    return (
      `DIRECT_URL points at port ${TRANSACTION_POOLER_PORT}, which is the ` +
      'transaction-mode pooler and is almost certainly DATABASE_URL copied ' +
      'by mistake. Migrations need the direct connection string.'
    );
  }

  return null;
}

function prismaBinary() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const local = path.join(here, '..', 'node_modules', '.bin', 'prisma');
  return existsSync(local) ? local : 'prisma';
}

function main() {
  const plan = resolveMigrationPlan(process.env);

  if (!plan.run) {
    if (plan.fatal) {
      console.error(`[deploy-migrate] refusing to build: ${plan.reason}`);
      process.exit(1);
    }

    console.log(`[deploy-migrate] skipped: ${plan.reason}`);
    return;
  }

  console.log('[deploy-migrate] applying pending migrations before the build');

  const result = spawnSync(prismaBinary(), ['migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DIRECT_URL: plan.url },
  });

  if (result.error) {
    console.error(`[deploy-migrate] could not run: ${result.error.message}`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
