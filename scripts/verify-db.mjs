/**
 * The PostgreSQL half of `npm run verify`.
 *
 * The unique indexes that stop a double submission are database behaviour, and
 * the in-memory repository cannot prove them: it is single-threaded and never
 * races. So these run against a real PostgreSQL, on a database of their own
 * that they are free to empty between tests.
 *
 * TEST_DATABASE_URL chooses the target. CI sets it to its service container;
 * locally it defaults to the `compose.yaml` container on port 5433. It is never
 * read from `.env`, so this can neither reach the deployed database nor disturb
 * the local development one.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

const LOCAL_TEST_DATABASE_URL =
  'postgresql://shalomut:shalomut@127.0.0.1:5433/shalomut_test';

const databaseUrl = process.env.TEST_DATABASE_URL?.trim() || LOCAL_TEST_DATABASE_URL;

if (/supabase|amazonaws|render\.com/i.test(databaseUrl)) {
  console.error(
    'verify:db refuses a managed host: these tests empty the database ' +
      'between cases. Point TEST_DATABASE_URL at a disposable one.',
  );
  process.exit(1);
}

const childEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  // prisma.config.ts prefers DIRECT_URL, so both have to name the same target
  // or the migration would land somewhere the tests do not read.
  DIRECT_URL: databaseUrl,
  TEST_DATABASE_URL: databaseUrl,
};

function run(command, args, description) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: childEnv,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    console.error(`${description} could not start: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    if (description === 'Migrations') {
      console.error(
        '\nMigrations failed. If the database is not up, start it with:\n' +
          '  docker compose up -d\n' +
          `and create the test database:\n` +
          `  docker exec shalomut-local-db psql -U shalomut -d postgres ` +
          `-c "CREATE DATABASE shalomut_test OWNER shalomut;"\n`,
      );
    }
    process.exit(result.status ?? 1);
  }
}

console.log(`verify:db -> ${databaseUrl.replace(/\/\/[^@]*@/, '//')}`);

run('npx', ['prisma', 'generate'], 'Prisma client generation');

run('npx', ['prisma', 'migrate', 'deploy'], 'Migrations');

/**
 * Every file in `__dbtests__`, read rather than listed.
 *
 * The list used to be written out by hand, and a suite added beside it ran
 * nowhere until someone noticed — a green `verify:db` that had skipped the
 * tests it was added for is worse than a red one.
 */
const suiteDirectory = path.join(
  repositoryRoot,
  'src/lib/repositories/__dbtests__',
);
const suites = readdirSync(suiteDirectory)
  .filter((name) => name.endsWith('.test.ts'))
  .sort()
  .map((name) => path.join(suiteDirectory, name));

if (suites.length === 0) {
  console.error(`No PostgreSQL suites found in ${suiteDirectory}`);
  process.exit(1);
}

run(
  process.execPath,
  ['--import', 'tsx', '--test', '--test-concurrency=1', ...suites],
  'PostgreSQL suite',
);
