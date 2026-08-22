import assert from 'node:assert/strict';
import test from 'node:test';
import { describeUnusablePooler, resolveMigrationPlan } from './deploy-migrate.mjs';

const DIRECT = 'postgresql://user:pass@aws-1.pooler.supabase.com:5432/postgres';
const POOLED = 'postgresql://user:pass@aws-1.pooler.supabase.com:6543/postgres';

test('a local build migrates nothing', () => {
  // `npm run build` is part of `npm run verify:core`. A verification command
  // that writes to a database is not a verification command.
  const plan = resolveMigrationPlan({ DIRECT_URL: DIRECT });

  assert.equal(plan.run, false);
  assert.equal(plan.fatal, undefined);
  assert.match(plan.reason, /VERCEL_ENV is unset/);
});

test('a preview build migrates nothing, even with a connection string', () => {
  // Previews share the one deployed database. A branch that is not merged has
  // no business moving its schema.
  const plan = resolveMigrationPlan({
    VERCEL_ENV: 'preview',
    DIRECT_URL: DIRECT,
  });

  assert.equal(plan.run, false);
  assert.equal(plan.fatal, undefined);
  assert.match(plan.reason, /"preview"/);
});

test('a production build migrates', () => {
  const plan = resolveMigrationPlan({
    VERCEL_ENV: 'production',
    DIRECT_URL: DIRECT,
  });

  assert.deepEqual(plan, { run: true, url: DIRECT });
});

test('a production build with no direct connection fails instead of shipping', () => {
  // The whole point. Continuing here would deploy code against a schema nobody
  // migrated, which is the defect this script exists to close.
  const plan = resolveMigrationPlan({
    VERCEL_ENV: 'production',
    DATABASE_URL: POOLED,
  });

  assert.equal(plan.run, false);
  assert.equal(plan.fatal, true);
  assert.match(plan.reason, /DIRECT_URL is not set/);
});

test('the pooled connection string is refused by port and by flag', () => {
  // DATABASE_URL copied into DIRECT_URL is the same database and the same
  // credentials; only the port and the pooling mode differ, so it looks right.
  assert.match(describeUnusablePooler(POOLED), /transaction-mode pooler/);
  assert.match(
    describeUnusablePooler(`${DIRECT}?pgbouncer=true`),
    /pooled connection/,
  );
  assert.equal(describeUnusablePooler(DIRECT), null);
});

test('a production build refuses a pooled DIRECT_URL rather than failing on a lock', () => {
  const plan = resolveMigrationPlan({
    VERCEL_ENV: 'production',
    DIRECT_URL: POOLED,
  });

  assert.equal(plan.run, false);
  assert.equal(plan.fatal, true);
  assert.match(plan.reason, /6543/);
});

test('an unreadable DIRECT_URL is named as unreadable', () => {
  assert.match(describeUnusablePooler('not-a-url'), /not a URL/);
});
