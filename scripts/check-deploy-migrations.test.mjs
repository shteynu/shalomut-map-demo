import assert from 'node:assert/strict';
import test from 'node:test';
import { check } from './check-deploy-migrations.mjs';

const GOOD =
  'node scripts/deploy-migrate.mjs && prisma generate && next build';

test('the real build command passes', () => {
  assert.deepEqual(check({ scripts: { build: GOOD } }), []);
});

test('a build that stopped migrating is caught', () => {
  const problems = check({
    scripts: { build: 'prisma generate && next build' },
  });

  assert.equal(problems.length, 1);
  assert.match(problems[0], /does not run scripts\/deploy-migrate\.mjs/);
});

test('a build that migrates after building is caught', () => {
  // Migrating after `next build` would still leave the window open: the build
  // has already succeeded, so nothing can stop the deployment any more.
  const problems = check({
    scripts: { build: 'next build && node scripts/deploy-migrate.mjs' },
  });

  assert.equal(problems.length, 1);
  assert.match(problems[0], /before scripts\/deploy-migrate\.mjs/);
});

test('a vercel-build script that bypasses the step is caught', () => {
  // Vercel prefers `vercel-build` over `build` when both exist, so adding one
  // is a way to drop the migration step without editing the checked command.
  const problems = check({
    scripts: { build: GOOD, 'vercel-build': 'next build' },
  });

  assert.equal(problems.length, 1);
  assert.match(problems[0], /^`vercel-build` does not run/);
});

test('a vercel-build script that keeps the step passes', () => {
  assert.deepEqual(
    check({ scripts: { build: GOOD, 'vercel-build': GOOD } }),
    [],
  );
});

test('a missing build script is a problem, a missing vercel-build is not', () => {
  assert.match(check({ scripts: {} })[0], /no `build` script/);
  assert.deepEqual(check({ scripts: { build: GOOD } }), []);
});
